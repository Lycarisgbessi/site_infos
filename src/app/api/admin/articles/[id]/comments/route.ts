import type { NextRequest } from "next/server";
import { z } from "zod";
import { reviewCommentSchema } from "@/schemas/article";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { listReviewComments, addReviewComment, resolveReviewComment } from "@/server/services/articles";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** GET /api/admin/articles/[id]/comments — commentaires ancrés (§11.2) */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireApiSession();
    const { id } = await params;
    const comments = await listReviewComments(id);
    return apiOk(comments, { count: comments.length });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** POST — nouveau commentaire de relecture */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requireApiSession();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = reviewCommentSchema.parse(body);
    const comment = await addReviewComment(session, id, input);
    return apiOk(comment);
  } catch (error) {
    return toErrorResponse(error);
  }
}

const resolveSchema = z.object({ comment_id: z.string().min(1), resolved: z.boolean() });

/** PATCH — résoudre / rouvrir un commentaire */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireApiSession();
    await params;
    const body = await request.json().catch(() => null);
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = resolveSchema.parse(body);
    const result = await resolveReviewComment(session, input.comment_id, input.resolved);
    return apiOk(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
