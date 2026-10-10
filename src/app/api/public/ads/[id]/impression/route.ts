import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiOk, apiError } from "@/lib/api/respond";

export const runtime = "nodejs";

/**
 * POST /api/public/ads/[id]/impression — [id] = identifiant de la créative.
 * Incrément d'impression best-effort (fire-and-forget côté client) :
 * jamais d'erreur visible, réponse minimale.
 */

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const creative = await db.adCreative.findUnique({
      where: { id },
      select: { id: true, campaign_id: true, slot_code: true },
    });
    if (!creative) return apiOk({ ok: false });

    await Promise.allSettled([
      db.adCampaign.update({
        where: { id: creative.campaign_id },
        data: { impressions: { increment: 1 } },
      }),
      db.adEvent.create({
        data: {
          creative_id: creative.id,
          campaign_id: creative.campaign_id,
          slot_code: creative.slot_code,
          event_type: "impression",
          page_path: request.headers.get("referer")?.slice(0, 500) ?? null,
        },
      }),
    ]);

    return apiOk({ ok: true });
  } catch (error) {
    console.error("[ads] échec du comptage d'impression :", error);
    return apiError(500, "ad_impression_error", "Comptage impossible.");
  }
}
