import type { NextRequest } from "next/server";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { hasPermission, PermissionError } from "@/lib/permissions";
import { podcastEpisodeCreateSchema } from "@/schemas/podcast";
import { createEpisode } from "@/server/services/podcast";

export const runtime = "nodejs";

/** POST /api/admin/podcast/episodes — création (URL directe OU lien Drive converti). */
export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const allowed = await hasPermission(session.user, "page.manage");
    if (!allowed) throw new PermissionError("Permission requise : page.manage.");
    const body = await request.json().catch(() => null);
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = podcastEpisodeCreateSchema.parse(body);
    return apiOk(await createEpisode(session.user.id, input));
  } catch (error) {
    return toErrorResponse(error);
  }
}
