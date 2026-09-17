import type { NextRequest } from "next/server";
import { transitionSchema } from "@/schemas/article";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { transitionArticle, type TransitionAction } from "@/server/services/articles";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** POST /api/admin/articles/[id]/transition — workflow de statuts (§11.2) */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requireApiSession();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = transitionSchema.parse(body);
    const result = await transitionArticle(session, id, input.action as TransitionAction, {
      scheduled_at: input.scheduled_at,
      note: input.note,
    });
    return apiOk(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
