import type { NextRequest } from "next/server";
import { bulkActionSchema } from "@/schemas/article";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { bulkAction } from "@/server/services/articles";

export const runtime = "nodejs";

/** POST /api/admin/articles/bulk — actions groupées (§11.2) */
export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const body = await request.json().catch(() => null);
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = bulkActionSchema.parse(body);
    const results = await bulkAction(session, input);
    return apiOk(results, { count: results.length });
  } catch (error) {
    return toErrorResponse(error);
  }
}
