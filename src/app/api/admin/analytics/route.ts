import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireApiSession, apiOk, toErrorResponse } from "@/lib/api/respond";
import { requirePermission } from "@/lib/permissions";
import { getAnalyticsOverview, parsePeriod } from "@/server/services/analytics";

export const runtime = "nodejs";

/**
 * GET /api/admin/analytics?days=7|30|90 — Vue d'ensemble statistiques
 * (§11.2) : total de vues, vues du jour, moyenne/jour, top articles,
 * série quotidienne, répartition par type.
 *
 * Lecture seule : session → permission analytics.read → lecture
 * (ordre contractuel conservé, aucune écriture d'audit pour une lecture).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession();
    await requirePermission(session.user, "analytics.read");

    const days = parsePeriod(request.nextUrl.searchParams.get("days") ?? undefined);
    const overview = await getAnalyticsOverview(days);

    return apiOk(overview, { days });
  } catch (error) {
    return toErrorResponse(error);
  }
}
