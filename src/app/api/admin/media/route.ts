import type { NextRequest } from "next/server";
import { mediaListQuerySchema } from "@/schemas/media-structure";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { uploadMedia, listMedia } from "@/server/services/media";
import { hasPermission } from "@/lib/permissions";
import { PermissionError } from "@/lib/permissions";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET  /api/admin/media — liste filtrée (type, q, période, corbeille)
 * POST /api/admin/media — téléversement multipart (§11.2)
 *      champs : file (obligatoire), title, alt_text, caption, credit, license
 *      réponses : {duplicate:true, warning} en cas de checksum identique
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const url = new URL(request.url);
    const query = mediaListQuerySchema.parse(Object.fromEntries(url.searchParams));
    const result = await listMedia(session.user, query);
    return apiOk(result.items, result.meta);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const allowed = await hasPermission(session.user, "media.upload");
    if (!allowed) throw new PermissionError("Permission requise : media.upload.");

    const form = await request.formData().catch(() => null);
    if (!form) throw new ValidationError("Formulaire multipart manquant.");
    const file = form.get("file");
    if (!(file instanceof File)) throw new ValidationError("Fichier manquant.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadMedia(
      {
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        buffer,
        title: (form.get("title") as string) ?? undefined,
        alt_text: (form.get("alt_text") as string) ?? undefined,
        caption: (form.get("caption") as string) ?? undefined,
        credit: (form.get("credit") as string) ?? undefined,
        license: (form.get("license") as string) ?? undefined,
      },
      session.user.id,
      { skipDuplicate: form.get("force") === "1" }
    );
    return apiOk(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
