import type { NextRequest } from "next/server";
import { lockActionSchema } from "@/schemas/article";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { acquireOrHeartbeatLock, releaseLock } from "@/server/services/articles";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** POST /api/admin/articles/[id]/lock — acquisition ou heartbeat (§11.1) */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requireApiSession();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = lockActionSchema.parse(body);
    const result = await acquireOrHeartbeatLock(session, id);
    void input;
    return apiOk(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** DELETE /api/admin/articles/[id]/lock — libère le verrou détenu */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const session = await requireApiSession();
    const { id } = await params;
    await releaseLock(session, id);
    return apiOk({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
