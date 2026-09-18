import type { NextRequest } from "next/server";
import {
  homepageBlocksSaveSchema,
  homepageLayoutSaveSchema,
} from "@/schemas/media-structure";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { hasPermission } from "@/lib/permissions";
import { PermissionError } from "@/lib/permissions";
import {
  getHomepageBlocks,
  saveHomepageBlocks,
  duplicateHomepageBlock,
  saveHomepageLayout,
  listHomepageLayouts,
} from "@/server/services/structure";

export const runtime = "nodejs";

/** GET /api/admin/homepage — blocs + configurations nommées */
export async function GET() {
  try {
    await requireApiSession();
    const [blocks, layouts] = await Promise.all([getHomepageBlocks(), listHomepageLayouts()]);
    return apiOk({ blocks, layouts });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** POST /api/admin/homepage — enregistrement ordre+config, duplication, layouts */
export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const allowed = await hasPermission(session.user, "homepage.compose");
    if (!allowed) throw new PermissionError("Permission requise : homepage.compose.");
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) throw new ValidationError("Corps de requête manquant.");

    if (body.action === "duplicate") {
      return apiOk(await duplicateHomepageBlock(String(body.id), session.user.id));
    }
    if (body.action === "save_layout") {
      const input = homepageLayoutSaveSchema.parse(body);
      return apiOk(await saveHomepageLayout(input, session.user.id));
    }
    const input = homepageBlocksSaveSchema.parse(body);
    return apiOk(await saveHomepageBlocks(input, session.user.id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
