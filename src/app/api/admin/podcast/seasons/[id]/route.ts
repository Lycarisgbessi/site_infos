import type { NextRequest } from "next/server";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { hasPermission, PermissionError } from "@/lib/permissions";
import { podcastSeasonUpdateSchema } from "@/schemas/podcast";
import { updateSeason, deleteSeason } from "@/server/services/podcast";

export const runtime = "nodejs";

/** PATCH /api/admin/podcast/seasons/[id] — modification (activer/désactiver inclus). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiSession();
    const allowed = await hasPermission(session.user, "page.manage");
    if (!allowed) throw new PermissionError("Permission requise : page.manage.");
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = podcastSeasonUpdateSchema.parse(body);
    return apiOk(await updateSeason(session.user.id, id, input));
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** DELETE /api/admin/podcast/seasons/[id] — suppression (bloquée si épisodes). */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiSession();
    const allowed = await hasPermission(session.user, "page.manage");
    if (!allowed) throw new PermissionError("Permission requise : page.manage.");
    const { id } = await params;
    return apiOk(await deleteSeason(session.user.id, id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
