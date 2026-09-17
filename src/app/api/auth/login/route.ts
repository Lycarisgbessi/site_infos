import type { NextRequest } from "next/server";
import { loginSchema } from "@/schemas/auth";
import { authenticateWithPassword } from "@/server/services/auth";
import {
  LockedAccountError,
  InvalidCredentialsError,
} from "@/server/services/auth";
import {
  apiError,
  apiOk,
  requireRateLimit,
  toErrorResponse,
} from "@/lib/api/respond";
import { getRequestContext } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * POST /api/auth/login — étape 1 de la connexion (§08.3).
 * Rate limit 5 / 15 min (§17.1). Renvoie une session ou un défi MFA.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = getRequestContext(request.headers);
    await requireRateLimit("auth", ctx.ip ?? "inconnue");

    const body = await request.json().catch(() => null);
    const input = loginSchema.parse(body);

    const outcome = await authenticateWithPassword(
      input.email,
      input.password,
      ctx
    );

    if (outcome.kind === "mfa_required") {
      return apiOk({
        mfaRequired: true,
        challengeToken: outcome.challengeToken,
      });
    }

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
    if (error instanceof LockedAccountError) {
      return apiError(423, "ACCOUNT_LOCKED", error.message, {
        "Retry-After": String(error.retryAfterSec),
      });
    }
    if (error instanceof InvalidCredentialsError) {
      return apiError(401, "INVALID_CREDENTIALS", error.message);
    }
    return toErrorResponse(error);
  }
}
