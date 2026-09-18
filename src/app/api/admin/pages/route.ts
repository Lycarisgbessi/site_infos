import type { NextRequest } from "next/server";
import { pageSaveSchema } from "@/schemas/media-structure";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { hasPermission } from "@/lib/permissions";
import { PermissionError } from "@/lib/permissions";
import { listPages, savePage, getPage, deletePage } from "@/server/services/structure";

export const runtime = "nodejs";

/** GET ?id=… — liste ou page détaillée ; POST création/mise à jour */
export async function GET(request: NextRequest) {
  try {
    await requireApiSession();
    const id = new URL(request.url).searchParams.get("id");
    if (id) return apiOk(await getPage(id));
    const pages = await listPages();
    return apiOk(pages, { count: pages.length });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const allowed = await hasPermission(session.user, "page.manage");
    if (!allowed) throw new PermissionError("Permission requise : page.manage.");
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = pageSaveSchema.parse(body);
    return apiOk(await savePage({ ...input, id: (body.id as string) ?? undefined }, session.user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const allowed = await hasPermission(session.user, "page.manage");
    if (!allowed) throw new PermissionError("Permission requise : page.manage.");
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new ValidationError("Paramètre id manquant.");
    return apiOk(await deletePage(id, session.user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
