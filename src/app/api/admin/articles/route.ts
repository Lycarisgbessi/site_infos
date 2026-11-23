import type { NextRequest } from "next/server";
import { articleCreateSchema, articleListQuerySchema } from "@/schemas/article";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
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
    // Journalisation d'audit assurée par createArticle (§07.2 — un seul audit).
    const article = await createArticle(session, input);
    return apiOk(article);
  } catch (error) {
    return toErrorResponse(error);
  }
}
