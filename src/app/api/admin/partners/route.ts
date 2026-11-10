import type { NextRequest } from "next/server";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { hasPermission, PermissionError } from "@/lib/permissions";
import { partnerCreateSchema } from "@/schemas/partners";
import { listPartners, upsertPartner } from "@/server/services/partners";

export const runtime = "nodejs";

/** GET /api/admin/partners — liste complète des partenaires (admin). */
export async function GET() {
  try {
    const session = await requireApiSession();
    const allowed = await hasPermission(session.user, "page.manage");
    if (!allowed) throw new PermissionError("Permission requise : page.manage.");
    const partners = await listPartners();
    return apiOk(partners, { count: partners.length });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** POST /api/admin/partners — création d'un partenaire. */
export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const allowed = await hasPermission(session.user, "page.manage");
    if (!allowed) throw new PermissionError("Permission requise : page.manage.");
    const body = await request.json().catch(() => null);
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = partnerCreateSchema.parse(body);
    return apiOk(await upsertPartner(session.user.id, input));
  } catch (error) {
    return toErrorResponse(error);
  }
}
