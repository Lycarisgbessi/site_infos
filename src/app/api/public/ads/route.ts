import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiOk, apiError } from "@/lib/api/respond";
import { rateLimit } from "@/lib/rate-limit";
import { isMobileUserAgent, type PublicAdCampaign } from "@/lib/public/homepage-data";

export const runtime = "nodejs";

/**
 * GET /api/public/ads?placement=KEY&category=slug&count=N — sélection
 * pondérée par weight parmi les créas ÉLIGIBLES d'un emplacement :
 * campagne running + fenêtre de dates valide, créative active, slot actif,
 * ciblage appareil (User-Agent) et rubrique (CSV category_targeting).
 * `placement` accepte un code d'emplacement (AD-02…) ou un placement
 * métier (header, sidebar, in_read…). `count` > 1 → N créas DISTINCTES
 * (tirage pondéré sans remise). Réponse : { banner, banners }.
 * Rate-limit 30/min/IP (RATE_LIMITS.ads). Ne touche pas aux routes
 * click/impression existantes.
 */

const MAX_COUNT = 10;

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

/** Une créative est-elle éligible pour la rubrique consultée ? */
function matchesCategory(categoryTargeting: string | null, categorySlug: string | null): boolean {
  if (!categoryTargeting || !categorySlug) return true;
  return categoryTargeting
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(categorySlug.toLowerCase());
}

/** Tirage pondéré sans remise : N créas distinctes par weight. */
function pickWeightedDistinct(pool: PublicAdCampaign[], count: number): PublicAdCampaign[] {
  const remaining = [...pool];
  const picked: PublicAdCampaign[] = [];
  while (picked.length < count && remaining.length > 0) {
    const total = remaining.reduce((sum, c) => sum + Math.max(1, c.weight), 0);
    let roll = Math.random() * total;
    let index = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      roll -= Math.max(1, remaining[i].weight);
      if (roll < 0) {
        index = i;
        break;
      }
    }
    picked.push(remaining[index]);
    remaining.splice(index, 1);
  }
  return picked;
}

export async function GET(request: NextRequest) {
  try {
    const rl = await rateLimit("ads", `public-ads:${clientIp(request)}`);
    if (!rl.allowed) {
      return apiError(429, "rate_limited", "Trop de requêtes — réessayez dans une minute.");
    }

    const { searchParams } = new URL(request.url);
    const placement = searchParams.get("placement")?.trim() ?? "";
    if (!placement) {
      return apiError(400, "missing_placement", "Paramètre `placement` requis (ex. AD-02 ou header).");
    }
    const categorySlug = searchParams.get("category")?.trim() || null;
    const countRaw = Number.parseInt(searchParams.get("count") ?? "1", 10);
    const count = Number.isFinite(countRaw) ? Math.min(Math.max(countRaw, 1), MAX_COUNT) : 1;

    const now = new Date();
    const rows = await db.adCampaign.findMany({
      where: {
        deleted_at: null,
        status: "running",
        starts_at: { lte: now },
        ends_at: { gt: now },
        creatives: {
          some: {
            is_active: true,
            slot: { is_active: true, OR: [{ code: placement }, { placement }] },
          },
        },
      },
      orderBy: { priority: "desc" },
      select: {
        id: true,
        name: true,
        priority: true,
        advertiser: { select: { name: true } },
        creatives: {
          where: { is_active: true, slot: { is_active: true, OR: [{ code: placement }, { placement }] } },
          orderBy: { weight: "desc" },
          select: {
            id: true,
            slot_code: true,
            type: true,
            video_url: true,
            click_url: true,
            alt_text: true,
            weight: true,
            device_targeting: true,
            category_targeting: true,
            html_code: true,
            media: { select: { url: true, alt_text: true, mime_type: true } },
          },
        },
      },
    });

    const isMobile = isMobileUserAgent(request.headers.get("user-agent"));
    const eligible: PublicAdCampaign[] = [];
    for (const row of rows) {
      for (const creative of row.creatives) {
        if (creative.device_targeting === "MOBILE" && !isMobile) continue;
        if (creative.device_targeting === "DESKTOP" && isMobile) continue;
        if (!matchesCategory(creative.category_targeting, categorySlug)) continue;
        const mediaKind: PublicAdCampaign["mediaKind"] =
          creative.type === "video" || creative.video_url
            ? "video"
            : creative.media?.mime_type === "image/gif"
              ? "gif"
              : "image";
        eligible.push({
          creativeId: creative.id,
          campaignId: row.id,
          slotCode: creative.slot_code,
          advertiser: row.advertiser.name,
          name: row.name,
          priority: row.priority,
          weight: creative.weight > 0 ? creative.weight : row.priority + 1,
          mediaKind,
          imageUrl: creative.media?.url ?? null,
          alt: creative.media?.alt_text || creative.alt_text || row.name,
          videoUrl: creative.video_url ?? null,
          clickUrl: creative.click_url,
          deviceTargeting: creative.device_targeting,
          categoryTargeting: creative.category_targeting ?? null,
          htmlCode: creative.html_code ?? null,
        });
        // Une créative principale par campagne suffit pour ce canal.
        break;
      }
    }

    const banners = pickWeightedDistinct(eligible, count);
    return apiOk({ banner: banners[0] ?? null, banners });
  } catch (error) {
    console.error("[ads] échec de la sélection publique :", error);
    return apiError(500, "ads_select_error", "Sélection impossible.");
  }
}
