import type { NextRequest } from "next/server";
import { uneSaveSchema } from "@/schemas/media-structure";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { hasPermission } from "@/lib/permissions";
import { PermissionError } from "@/lib/permissions";
import { getUneState, saveUne, searchCandidates } from "@/server/services/structure";

export const runtime = "nodejs";

/** GET ?q= — état de la une (zones + slots) ou recherche de candidats */
export async function GET(request: NextRequest) {
  try {
    await requireApiSession();
    const url = new URL(request.url);
    if (url.searchParams.get("candidates") === "1") {
      const candidates = await searchCandidates(url.searchParams.get("q") ?? undefined, {
        limit: 24,
        category_id: url.searchParams.get("category_id") ?? undefined,
      });
      return apiOk(candidates, { count: candidates.length });
    }
    return apiOk(await getUneState());
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** PUT /api/admin/une — enregistre la composition des zones home_lead / home_secondary */
export async function PUT(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const allowed = await hasPermission(session.user, "article.feature");
    if (!allowed) throw new PermissionError("Permission requise : article.feature.");
    const body = await request.json().catch(() => null);
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = uneSaveSchema.parse(body);
    return apiOk(await saveUne(input, session.user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
