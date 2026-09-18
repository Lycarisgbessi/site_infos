import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { settingsBulkSchema } from "@/schemas/settings";
import { requireApiSession, apiOk, toErrorResponse } from "@/lib/api/respond";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/audit";
import { CACHE_TAGS, invalidateTags } from "@/lib/cache";
import { getRequestContext } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * Route Handler admin de référence — implémente intégralement le modèle
 * obligatoire du §07.2 (session → Zod → permission → écriture → audit →
 * revalidateTag) avec le transport Route Handler (D-07).
 *
 * GET  /api/admin/settings  — liste des réglages (permission settings.manage)
 * PUT  /api/admin/settings  — mise à jour groupée (permission settings.manage)
 */

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession();
    await requirePermission(session.user, "settings.manage");

    const settings = await db.setting.findMany({
      orderBy: [{ group_key: "asc" }, { key: "asc" }],
      select: {
        key: true,
        value: true,
        group_key: true,
        label: true,
        updated_at: true,
      },
    });

    await auditLog({
      userId: session.user.id,
      action: "settings.list",
      resourceType: "settings",
      request: getRequestContext(request.headers),
    });

    return apiOk(settings, { count: settings.length });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireApiSession();
    await requirePermission(session.user, "settings.manage");
    const ctx = getRequestContext(request.headers);

    const body = await request.json().catch(() => null);
    const input = settingsBulkSchema.parse(body);

    const before = await db.setting.findMany({
      where: { key: { in: input.settings.map((s) => s.key) } },
    });

    for (const setting of input.settings) {
      await db.setting.upsert({
        where: { key: setting.key },
        create: {
          key: setting.key,
          value: setting.value,
          group_key: setting.group_key ?? "identity",
          label: setting.label ?? null,
          updated_by: session.user.id,
        },
        update: {
          value: setting.value,
          label: setting.label ?? undefined,
          updated_by: session.user.id,
        },
      });
    }

    await auditLog({
      userId: session.user.id,
      action: "settings.update",
      resourceType: "settings",
      before: before.map((s) => ({ key: s.key, value: s.value })),
      after: input.settings.map((s) => ({ key: s.key, value: s.value })),
      request: ctx,
    });

    invalidateTags([CACHE_TAGS.settings, CACHE_TAGS.publicSettings]);

    const updated = await db.setting.findMany({
      where: { key: { in: input.settings.map((s) => s.key) } },
    });
    return apiOk(updated, { count: updated.length });
  } catch (error) {
    return toErrorResponse(error);
  }
}
