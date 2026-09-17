import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiSession, apiOk, toErrorResponse } from "@/lib/api/respond";
import { parseJsonObject } from "@/lib/json";

export const runtime = "nodejs";

/**
 * GET  /api/admin/notifications — centre de notifications du workflow (D-13)
 * POST {ids?: string[], all?: true} — marquage lu
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const unreadOnly = new URL(request.url).searchParams.get("unread") === "1";
    const [items, unread] = await Promise.all([
      db.notification.findMany({
        where: { user_id: session.user.id, ...(unreadOnly ? { is_read: false } : {}) },
        orderBy: { created_at: "desc" },
        take: 50,
      }),
      db.notification.count({ where: { user_id: session.user.id, is_read: false } }),
    ]);
    return apiOk(
      items.map((n) => ({ id: n.id, type: n.type, payload: parseJsonObject(n.payload, {}), is_read: n.is_read, created_at: n.created_at })),
      { count: items.length, unread }
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

const markSchema = z.object({ ids: z.array(z.string()).max(100).optional(), all: z.boolean().optional() });

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const body = await request.json().catch(() => null);
    const input = markSchema.parse(body ?? {});
    if (input.all) {
      await db.notification.updateMany({ where: { user_id: session.user.id, is_read: false }, data: { is_read: true } });
    } else if (input.ids && input.ids.length > 0) {
      await db.notification.updateMany({
        where: { user_id: session.user.id, id: { in: input.ids } },
        data: { is_read: true },
      });
    }
    return apiOk({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
