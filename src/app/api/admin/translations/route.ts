import type { NextRequest } from "next/server";
import { translationsBulkSchema } from "@/schemas/media-structure";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { hasPermission } from "@/lib/permissions";
import { PermissionError } from "@/lib/permissions";
import { listTranslations, updateTranslations } from "@/server/services/settings";

export const runtime = "nodejs";

/**
 * GET  /api/admin/translations?locale=fr — textes d'interface (§11.2)
 * PUT  — mise à jour en lot (autonomie éditoriale totale)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const allowed = await hasPermission(session.user, "settings.manage");
    if (!allowed) throw new PermissionError("Permission requise : settings.manage.");
    const locale = new URL(request.url).searchParams.get("locale") ?? "fr";
    const items = await listTranslations(locale);
    return apiOk(items, { count: items.length, locale });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const allowed = await hasPermission(session.user, "settings.manage");
    if (!allowed) throw new PermissionError("Permission requise : settings.manage.");
    const body = await request.json().catch(() => null);
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = translationsBulkSchema.parse(body);
    return apiOk(await updateTranslations(session.user.id, input));
  } catch (error) {
    return toErrorResponse(error);
  }
}
