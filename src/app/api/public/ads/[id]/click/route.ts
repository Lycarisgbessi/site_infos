import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiOk, apiError } from "@/lib/api/respond";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * POST /api/public/ads/[id]/click — [id] = identifiant de la créative.
 * Incrémente le compteur de clics de la campagne (best-effort, jamais
 * bloquant pour l'internaute) et renvoie l'URL de destination.
 */

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rl = await rateLimit("form", `ad-click:${clientIp(request)}`);
    if (!rl.allowed) {
      // Même throttled, on renvoie l'URL : le clic public ne doit jamais échouer.
      const creative = await db.adCreative.findUnique({ where: { id }, select: { click_url: true } });
      if (!creative) return apiError(404, "not_found", "Créative introuvable.");
      return apiOk({ url: creative.click_url });
    }

    const creative = await db.adCreative.findUnique({
      where: { id },
      select: { id: true, click_url: true, campaign_id: true, slot_code: true },
    });
    if (!creative) return apiError(404, "not_found", "Créative introuvable.");

    await Promise.allSettled([
      db.adCampaign.update({
        where: { id: creative.campaign_id },
        data: { clicks: { increment: 1 } },
      }),
      db.adEvent.create({
        data: {
          creative_id: creative.id,
          campaign_id: creative.campaign_id,
          slot_code: creative.slot_code,
          event_type: "click",
          page_path: request.headers.get("referer")?.slice(0, 500) ?? null,
        },
      }),
    ]);

    return apiOk({ url: creative.click_url });
  } catch (error) {
    console.error("[ads] échec du comptage de clic :", error);
    return apiError(500, "ad_click_error", "Comptage impossible.");
  }
}
