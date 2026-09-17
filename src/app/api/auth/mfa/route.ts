import type { NextRequest } from "next/server";
import { mfaSchema } from "@/schemas/auth";
import { InvalidCredentialsError, authenticateWithMfa } from "@/server/services/auth";
import { verifyMfaChallenge } from "@/lib/auth/challenge";
import { apiError, apiOk, requireRateLimit, toErrorResponse } from "@/lib/api/respond";
import { getRequestContext } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * POST /api/auth/mfa — étape 2 de la connexion : code TOTP ou code de
 * secours à usage unique (§08.3).
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = getRequestContext(request.headers);
    await requireRateLimit("auth", ctx.ip ?? "inconnue");

    const body = await request.json().catch(() => null);
    const input = mfaSchema.parse(body);

    const userId = verifyMfaChallenge(input.challengeToken);
    if (!userId) {
      return apiError(401, "MFA_CHALLENGE_INVALID", "Défi expiré ou invalide. Reconnectez-vous.");
    }

    const outcome = await authenticateWithMfa(userId, input.code, input.rememberMe, ctx);

    return apiOk({
      mfaRequired: false,
      user: {
        id: outcome.session.user.id,
        displayName: outcome.session.user.displayName,
        slug: outcome.session.user.slug,
        roles: outcome.session.user.roles.map((r) => r.key),
        twoFactorEnabled: outcome.session.user.twoFactorEnabled,
      },
    });
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      return apiError(401, "INVALID_CODE", error.message);
    }
    return toErrorResponse(error);
  }
}
