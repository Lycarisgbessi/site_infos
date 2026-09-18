import type { NextRequest } from "next/server";
import { mediaMetaUpdateSchema } from "@/schemas/media-structure";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { getMediaUsage, updateMediaMeta, trashMedia, restoreMedia } from "@/server/services/media";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** GET ?usage=1 — usages du média (§11.2 « affichage avant suppression ») */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    await requireApiSession();
    const { id } = await params;
    const usage = new URL(request.url).searchParams.get("usage");
    if (usage) return apiOk(await getMediaUsage(id));
    throw new ValidationError("Ajoutez ?usage=1 pour consulter les usages.");
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** PATCH — métadonnées + point focal + recadrages */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireApiSession();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = mediaMetaUpdateSchema.parse(body);
    const result = await updateMediaMeta(session.user, id, input);
    return apiOk(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** DELETE ?force=1 — corbeille (bloqué si utilisé, sauf force) ; ?restore=1 restaure */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await requireApiSession();
    const { id } = await params;
    const url = new URL(request.url);
    if (url.searchParams.get("restore") === "1") {
      return apiOk(await restoreMedia(session.user, id));
    }
    const force = url.searchParams.get("force") === "1";
    const result = await trashMedia(session.user, id, { force });
    return apiOk(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
