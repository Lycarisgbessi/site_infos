import type { NextRequest } from "next/server";
import { listUserSessions } from "@/lib/auth/session";
import { requireApiSession, apiOk, toErrorResponse } from "@/lib/api/respond";

export const runtime = "nodejs";

/** GET /api/auth/sessions — liste des sessions actives de l'utilisateur (§08.3). */
export async function GET(_request: NextRequest) {
  try {
    const session = await requireApiSession();
    const sessions = await listUserSessions(session.user.id);
    return apiOk(
      sessions.map((s) => ({
        id: s.id,
        ipHash: s.ip_hash,
        userAgent: s.user_agent,
        createdAt: s.created_at,
        expiresAt: s.expires_at,
        current: s.id === session.sessionId,
      })),
      { count: sessions.length }
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
