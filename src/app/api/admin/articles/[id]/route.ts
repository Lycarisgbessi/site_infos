import type { NextRequest } from "next/server";
import { articleUpdateSchema } from "@/schemas/article";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { getRequestContext } from "@/lib/auth/session";
import {
  getArticleForEdit,
  updateArticle,
  trashArticle,
} from "@/server/services/articles";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** GET /api/admin/articles/[id] — données complètes de l'éditeur + droits */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const session = await requireApiSession();
    const { id } = await params;
    const data = await getArticleForEdit(session, id);
    return apiOk(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** PUT /api/admin/articles/[id] — enregistrement (tous panneaux, §11.2) */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await requireApiSession();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = articleUpdateSchema.parse(body);
    const result = await updateArticle(session, id, input);
    void getRequestContext(request.headers);
    return apiOk(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** DELETE /api/admin/articles/[id] — corbeille (§11.1, rétention 30 j) */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await requireApiSession();
    const { id } = await params;
    await trashArticle(session, id);
    void getRequestContext(request.headers);
    return apiOk({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
