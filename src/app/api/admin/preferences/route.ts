import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { getUserPreference, setUserPreference } from "@/server/services/settings";

export const runtime = "nodejs";

/**
 * Préférences utilisateur (D-13) : vues enregistrées §11.2, widgets tableau
 * de bord, dernier onglet de l'éditeur…
 * GET  ?key=articles.saved_views
 * PUT  {key, value}
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const key = new URL(request.url).searchParams.get("key");
    if (!key) throw new ValidationError("Paramètre key manquant.");
    const value = await getUserPreference(session.user.id, key);
    return apiOk({ key, value });
  } catch (error) {
    return toErrorResponse(error);
  }
}

const putSchema = z.object({
  key: z.string().min(1).max(200).regex(/^[a-z0-9_.-]+$/i),
  value: z.unknown(),
});

export async function PUT(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const body = await request.json().catch(() => null);
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = putSchema.parse(body);
    await setUserPreference(session.user.id, input.key, input.value);
    return apiOk({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
