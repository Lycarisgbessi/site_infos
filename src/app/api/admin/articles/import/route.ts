import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/audit";
import { getRequestContext } from "@/lib/auth/session";
import { docxToHtml } from "@/lib/import/docx";
import { htmlToBlocks } from "@/lib/import/html-to-blocks";
import { uploadMedia } from "@/server/services/media";

export const runtime = "nodejs";

/**
 * POST /api/admin/articles/import — Import Word/Google Docs → blocs
 * (§20 Phase 2, tâche 10 ; §11.2 collage intelligent).
 *
 * Deux modes :
 * - multipart/form-data avec champ `file` (.docx, max 25 Mo) — import de
 *   document, les images embarquées sont téléversées en médiathèque ;
 * - application/json `{ html }` (max 5 Mo) — collage riche depuis Word ou
 *   Google Docs (text/html du presse-papiers), mêmes conversions.
 *
 * Réponse : `{ blocks, warnings }`. Les images importées reçoivent un
 * `alt` provisoire « À compléter » : le contrôle bloquant de publication
 * (§11.2) oblige ensuite le journaliste à le renseigner réellement.
 */

const htmlBodySchema = z.object({
  html: z.string().min(1).max(5 * 1024 * 1024),
});

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

async function uploadDataUrlImage(
  dataUrl: string,
  suggestedName: string,
  userId: string
): Promise<string | null> {
  const match = /^data:([^;,]+)(;base64)?,([\s\S]*)$/.exec(dataUrl);
  if (!match) return null;
  const [, mime, isBase64, payload] = match;
  if (!mime.startsWith("image/")) return null;
  const buffer = isBase64
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload), "utf8");
  const result = await uploadMedia(
    {
      name: suggestedName,
      mimeType: mime,
      buffer,
      title: suggestedName.replace(/\.[a-z]+$/i, ""),
      alt_text: "À compléter — image importée",
      license: "À vérifier — document importé",
    },
    userId,
    { skipDuplicate: false }
  );
  return result.media.id;
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    await requirePermission(session.user, "article.create");

    const contentType = request.headers.get("content-type") ?? "";
    let html: string;
    let source: "docx" | "html";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        throw new ValidationError("Fichier manquant (champ « file » attendu).");
      }
      const name = file.name || "document.docx";
      if (!/\.(docx)$/i.test(name) || (file.type !== "" && file.type !== DOCX_MIME)) {
        throw new ValidationError(
          "Format non pris en charge : importez un fichier .docx (Word). Un Google Docs s'exporte d'abord en .docx (Fichier → Télécharger)."
        );
      }
      if (file.size > 25 * 1024 * 1024) {
        throw new ValidationError("Fichier trop volumineux (max 25 Mo).");
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      html = await docxToHtml(buffer);
      source = "docx";
    } else {
      const body = htmlBodySchema.parse(await request.json().catch(() => null));
      html = body.html;
      source = "html";
    }

    const result = await htmlToBlocks(html, {
      uploadImage: (dataUrl, suggestedName) =>
        uploadDataUrlImage(dataUrl, suggestedName, session.user.id),
    });

    if (result.blocks.length === 0) {
      throw new ValidationError(
        "Aucun contenu exploitable n'a été trouvé dans le document ou le collage."
      );
    }

    await auditLog({
      userId: session.user.id,
      action: "article.import",
      resourceType: "article",
      after: { source, blocks: result.blocks.length, warnings: result.warnings.length },
      request: getRequestContext(request.headers),
    });

    return apiOk({ blocks: result.blocks, warnings: result.warnings, source });
  } catch (error) {
    return toErrorResponse(error);
  }
}
