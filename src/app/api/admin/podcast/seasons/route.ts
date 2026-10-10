import type { NextRequest } from "next/server";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { hasPermission, PermissionError } from "@/lib/permissions";
import { podcastSeasonCreateSchema, podcastSeasonReorderSchema } from "@/schemas/podcast";
import { listSeasonsWithEpisodes, createSeason, reorderSeasons } from "@/server/services/podcast";

export const runtime = "nodejs";

/** GET /api/admin/podcast/seasons — saisons (ordre position) avec épisodes. */
export async function GET() {
  try {
    const session = await requireApiSession();
    const allowed = await hasPermission(session.user, "page.manage");
    if (!allowed) throw new PermissionError("Permission requise : page.manage.");
    const seasons = await listSeasonsWithEpisodes();
    return apiOk(seasons, { count: seasons.length });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** POST /api/admin/podcast/seasons — création d'une saison. */
export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const allowed = await hasPermission(session.user, "page.manage");
    if (!allowed) throw new PermissionError("Permission requise : page.manage.");
    const body = await request.json().catch(() => null);
    if (!body) throw new ValidationError("Corps de requête manquant.");
    // Réordonnancement complet : { items: [{id, position}] } (monter/descendre).
    if (body && typeof body === "object" && "items" in body && !("title" in body)) {
      const reorder = podcastSeasonReorderSchema.parse(body);
      return apiOk(await reorderSeasons(session.user.id, reorder.items));
    }
    const input = podcastSeasonCreateSchema.parse(body);
    return apiOk(await createSeason(session.user.id, input));
  } catch (error) {
    return toErrorResponse(error);
  }
}
