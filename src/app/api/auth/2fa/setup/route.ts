import type { NextRequest } from "next/server";
import { setupTwoFactor } from "@/server/services/auth";
import { apiOk, requireApiSession, toErrorResponse } from "@/lib/api/respond";

export const runtime = "nodejs";

/**
 * POST /api/auth/2fa/setup — génère le secret TOTP + QR + codes de secours.
 * Les codes de secours ne sont renvoyés qu'une seule fois (§08.3).
 */
export async function POST(_request: NextRequest) {
  try {
    const session = await requireApiSession();
    const setup = await setupTwoFactor(session.user.id, session.user.email);
    return apiOk(setup);
  } catch (error) {
    return toErrorResponse(error);
  }
}
