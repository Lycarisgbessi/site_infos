import type { NextRequest } from "next/server";
import { menuSaveSchema } from "@/schemas/media-structure";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { hasPermission } from "@/lib/permissions";
import { PermissionError } from "@/lib/permissions";
import { listMenusWithItems, saveMenuTree } from "@/server/services/structure";

export const runtime = "nodejs";

/** GET /api/admin/menus — les 6 menus avec leurs items */
export async function GET() {
  try {
    await requireApiSession();
    const menus = await listMenusWithItems();
    return apiOk(menus, { count: menus.length });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** PUT ?id=… — enregistre l'arbre complet d'un menu (drag & drop) */
export async function PUT(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const allowed = await hasPermission(session.user, "menu.manage");
    if (!allowed) throw new PermissionError("Permission requise : menu.manage.");
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new ValidationError("Paramètre id manquant.");
    const body = await request.json().catch(() => null);
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = menuSaveSchema.parse(body);
    return apiOk(await saveMenuTree(id, input, session.user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
