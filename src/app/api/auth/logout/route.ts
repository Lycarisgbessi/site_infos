import type { NextRequest } from "next/server";
import { logout } from "@/server/services/auth";
import { apiOk, toErrorResponse } from "@/lib/api/respond";
import { getRequestContext } from "@/lib/auth/session";

export const runtime = "nodejs";

/** POST /api/auth/logout — révoque la session courante (§08.3). */
export async function POST(request: NextRequest) {
  try {
    const ctx = getRequestContext(request.headers);
    await logout(ctx);
    return apiOk({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
