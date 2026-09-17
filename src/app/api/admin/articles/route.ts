import type { NextRequest } from "next/server";
import { articleCreateSchema, articleListQuerySchema } from "@/schemas/article";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { auditLog } from "@/lib/audit";
import { getRequestContext } from "@/lib/auth/session";
import { createArticle, listArticles } from "@/server/services/articles";

export const runtime = "nodejs";

/**
 * GET  /api/admin/articles — liste filtrée (§11.2) avec portée par rôle
 * POST /api/admin/articles — création (article.create)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const url = new URL(request.url);
    const query = articleListQuerySchema.parse(Object.fromEntries(url.searchParams));
    const result = await listArticles(session, query);
    return apiOk(result.items, result.meta);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const body = await request.json().catch(() => null);
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = articleCreateSchema.parse(body);
    const article = await createArticle(session, input);
    await auditLog({
      userId: session.user.id,
      action: "article.create",
      resourceType: "article",
      resourceId: article.id,
      request: getRequestContext(request.headers),
    });
    return apiOk(article);
  } catch (error) {
    return toErrorResponse(error);
  }
}
