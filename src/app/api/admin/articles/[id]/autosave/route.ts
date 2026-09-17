import type { NextRequest } from "next/server";
import { articleUpdateSchema } from "@/schemas/article";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { autosaveArticle } from "@/server/services/articles";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** POST /api/admin/articles/[id]/autosave — enregistrement auto 20 s (§11.1) */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requireApiSession();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = articleUpdateSchema.partial().parse(body);
    const result = await autosaveArticle(session, id, input);
    return apiOk(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
