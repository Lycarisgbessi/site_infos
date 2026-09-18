import type { NextRequest } from "next/server";
import { revokeOwnSession } from "@/server/services/auth";
import { apiError, apiOk, toErrorResponse } from "@/lib/api/respond";

export const runtime = "nodejs";

/** DELETE /api/auth/sessions/:id — révocation d'une session (§08.3). */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const revoked = await revokeOwnSession(id);
    if (!revoked) {
      return apiError(404, "NOT_FOUND", "Session introuvable ou déjà révoquée.");
    }
    return apiOk({ revoked: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
