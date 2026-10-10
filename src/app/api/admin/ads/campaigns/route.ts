import type { NextRequest } from "next/server";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { hasPermission, PermissionError } from "@/lib/permissions";
import { adCampaignCreateSchema } from "@/schemas/ads";
import { listAdCampaigns, listAdSlots, createAdCampaign } from "@/server/services/ads";

export const runtime = "nodejs";

/** GET /api/admin/ads/campaigns — liste des campagnes + catalogue des emplacements. */
export async function GET() {
  try {
    const session = await requireApiSession();
    const allowed = await hasPermission(session.user, "ads.read");
    if (!allowed) throw new PermissionError("Permission requise : ads.read.");
    const [campaigns, slots] = await Promise.all([listAdCampaigns(), listAdSlots()]);
    return apiOk(campaigns, { count: campaigns.length, slots });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** POST /api/admin/ads/campaigns — création (campagne + créative unique). */
export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const allowed = await hasPermission(session.user, "ads.manage");
    if (!allowed) throw new PermissionError("Permission requise : ads.manage.");
    const body = await request.json().catch(() => null);
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = adCampaignCreateSchema.parse(body);
    return apiOk(await createAdCampaign(session.user.id, input));
  } catch (error) {
    return toErrorResponse(error);
  }
}
