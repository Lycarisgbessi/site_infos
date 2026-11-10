import type { NextRequest } from "next/server";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { hasPermission, PermissionError } from "@/lib/permissions";
import { teamMemberUpdateSchema } from "@/schemas/team";
import { upsertTeamMember, deleteTeamMember } from "@/server/services/team";

export const runtime = "nodejs";

/** PATCH /api/admin/team/[id] — modification (activer/désactiver inclus). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiSession();
    const allowed = await hasPermission(session.user, "page.manage");
    if (!allowed) throw new PermissionError("Permission requise : page.manage.");
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = teamMemberUpdateSchema.parse(body);
    return apiOk(await upsertTeamMember(session.user.id, input, id));
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** DELETE /api/admin/team/[id] — suppression définitive. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiSession();
    const allowed = await hasPermission(session.user, "page.manage");
    if (!allowed) throw new PermissionError("Permission requise : page.manage.");
    const { id } = await params;
    return apiOk(await deleteTeamMember(session.user.id, id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
