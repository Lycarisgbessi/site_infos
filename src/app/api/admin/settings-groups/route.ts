import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { hasPermission } from "@/lib/permissions";
import { PermissionError } from "@/lib/permissions";
import {
  SETTING_GROUPS,
  getSettingsByGroup,
  updateSettingsGroup,
} from "@/server/services/settings";

export const runtime = "nodejs";

const updateSchema = z.object({
  updates: z.array(z.object({ key: z.string().min(1), value: z.string().max(100_000) })).min(1).max(100),
});

/**
 * GET  /api/admin/settings-groups — registre des 9 groupes + valeurs (§11.2)
 * PUT  — mise à jour d'un lot de clés du registre (autonomie totale)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const allowed = await hasPermission(session.user, "settings.manage");
    if (!allowed) throw new PermissionError("Permission requise : settings.manage.");
    const group = new URL(request.url).searchParams.get("group") ?? undefined;
    const values = await getSettingsByGroup(group);
    return apiOk({ groups: SETTING_GROUPS, values });
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
    const input = updateSchema.parse(body);
    return apiOk(await updateSettingsGroup(session.user.id, input.updates));
  } catch (error) {
    return toErrorResponse(error);
  }
}
