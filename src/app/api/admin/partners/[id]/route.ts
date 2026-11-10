import type { NextRequest } from "next/server";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { hasPermission, PermissionError } from "@/lib/permissions";
import { partnerUpdateSchema } from "@/schemas/partners";
import { upsertPartner, deletePartner } from "@/server/services/partners";

export const runtime = "nodejs";

/** PATCH /api/admin/partners/[id] — modification (activer/désactiver inclus). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiSession();
    const allowed = await hasPermission(session.user, "page.manage");
    if (!allowed) throw new PermissionError("Permission requise : page.manage.");
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = partnerUpdateSchema.parse(body);
    return apiOk(await upsertPartner(session.user.id, input, id));
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** DELETE /api/admin/partners/[id] — suppression définitive. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiSession();
    const allowed = await hasPermission(session.user, "page.manage");
    if (!allowed) throw new PermissionError("Permission requise : page.manage.");
    const { id } = await params;
    return apiOk(await deletePartner(session.user.id, id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
