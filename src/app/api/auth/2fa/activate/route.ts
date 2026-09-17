import type { NextRequest } from "next/server";
import { totpActivateSchema } from "@/schemas/auth";
import { activateTwoFactor } from "@/server/services/auth";
import { apiOk, requireApiSession, toErrorResponse } from "@/lib/api/respond";

export const runtime = "nodejs";

/** POST /api/auth/2fa/activate — vérifie un premier code et active la 2FA. */
export async function POST(request: NextRequest) {
  try {
    await requireApiSession();
    const body = await request.json().catch(() => null);
    const input = totpActivateSchema.parse(body);
    await activateTwoFactor(input.code);
    return apiOk({ enabled: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
