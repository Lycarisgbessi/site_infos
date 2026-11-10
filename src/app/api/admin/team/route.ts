import type { NextRequest } from "next/server";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { hasPermission, PermissionError } from "@/lib/permissions";
import { teamMemberCreateSchema } from "@/schemas/team";
import { listTeam, upsertTeamMember } from "@/server/services/team";

export const runtime = "nodejs";

/** GET /api/admin/team — liste complète des membres (admin). */
export async function GET() {
  try {
    const session = await requireApiSession();
    const allowed = await hasPermission(session.user, "page.manage");
    if (!allowed) throw new PermissionError("Permission requise : page.manage.");
    const members = await listTeam();
    return apiOk(members, { count: members.length });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** POST /api/admin/team — création d'un membre. */
export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const allowed = await hasPermission(session.user, "page.manage");
    if (!allowed) throw new PermissionError("Permission requise : page.manage.");
    const body = await request.json().catch(() => null);
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = teamMemberCreateSchema.parse(body);
    return apiOk(await upsertTeamMember(session.user.id, input));
  } catch (error) {
    return toErrorResponse(error);
  }
}
