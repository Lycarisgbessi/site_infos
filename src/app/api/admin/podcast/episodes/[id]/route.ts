import type { NextRequest } from "next/server";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { hasPermission, PermissionError } from "@/lib/permissions";
import { podcastEpisodeUpdateSchema } from "@/schemas/podcast";
import { updateEpisode, deleteEpisode } from "@/server/services/podcast";

export const runtime = "nodejs";

/** PATCH /api/admin/podcast/episodes/[id] — modification (activer/désactiver inclus). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiSession();
    const allowed = await hasPermission(session.user, "page.manage");
    if (!allowed) throw new PermissionError("Permission requise : page.manage.");
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = podcastEpisodeUpdateSchema.parse(body);
    return apiOk(await updateEpisode(session.user.id, id, input));
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** DELETE /api/admin/podcast/episodes/[id] — suppression définitive. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiSession();
    const allowed = await hasPermission(session.user, "page.manage");
    if (!allowed) throw new PermissionError("Permission requise : page.manage.");
    const { id } = await params;
    return apiOk(await deleteEpisode(session.user.id, id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
