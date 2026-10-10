import type { NextRequest } from "next/server";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { hasPermission, PermissionError } from "@/lib/permissions";
import { adCampaignUpdateSchema } from "@/schemas/ads";
import { updateAdCampaign, deleteAdCampaign } from "@/server/services/ads";

export const runtime = "nodejs";

/** PATCH /api/admin/ads/campaigns/[id] — modification (activer/désactiver inclus). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiSession();
    const allowed = await hasPermission(session.user, "ads.manage");
    if (!allowed) throw new PermissionError("Permission requise : ads.manage.");
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = adCampaignUpdateSchema.parse(body);
    return apiOk(await updateAdCampaign(session.user.id, id, input));
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** DELETE /api/admin/ads/campaigns/[id] — suppression (douce). */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiSession();
    const allowed = await hasPermission(session.user, "ads.manage");
    if (!allowed) throw new PermissionError("Permission requise : ads.manage.");
    const { id } = await params;
    return apiOk(await deleteAdCampaign(session.user.id, id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
