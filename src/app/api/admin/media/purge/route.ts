import type { NextRequest } from "next/server";
import { requireApiSession, apiOk, toErrorResponse } from "@/lib/api/respond";
import { purgeOrphanMedia } from "@/server/services/media";

export const runtime = "nodejs";
export const maxDuration = 120;

/** POST /api/admin/media/purge — purge des orphelins (corbeille > 30 j, §11.2) */
export async function POST(_request: NextRequest) {
  try {
    const session = await requireApiSession();
    const result = await purgeOrphanMedia(session.user);
    return apiOk(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
