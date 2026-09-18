import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { hasPermission } from "@/lib/permissions";
import { PermissionError } from "@/lib/permissions";
import { quickFlash, listFlashNews, expireFlash, deleteFlash } from "@/server/services/structure";

export const runtime = "nodejs";

const flashCreateSchema = z.object({
  text: z.string().min(1).max(300),
  priority: z.number().int().min(1).max(3).optional(),
  link: z.string().max(2000).nullable().optional(),
  expires_in_hours: z.number().int().min(1).max(72).optional(),
});

/** GET /api/admin/flash — liste ; POST — saisie une ligne (§11.2) */
export async function GET() {
  try {
    await requireApiSession();
    const items = await listFlashNews();
    return apiOk(items, { count: items.length });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const allowed = await hasPermission(session.user, "flash.manage");
    if (!allowed) throw new PermissionError("Permission requise : flash.manage.");
    const body = await request.json().catch(() => null);
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = flashCreateSchema.parse(body);
    return apiOk(await quickFlash(session.user.id, input));
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** DELETE ?id=&mode=expire|delete */
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const allowed = await hasPermission(session.user, "flash.manage");
    if (!allowed) throw new PermissionError("Permission requise : flash.manage.");
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) throw new ValidationError("Paramètre id manquant.");
    if (url.searchParams.get("mode") === "delete") {
      return apiOk(await deleteFlash(id, session.user.id));
    }
    return apiOk(await expireFlash(id, session.user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
