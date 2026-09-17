import type { NextRequest } from "next/server";
import { bannerSaveSchema, redirectSaveSchema } from "@/schemas/media-structure";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { hasPermission } from "@/lib/permissions";
import { PermissionError } from "@/lib/permissions";
import {
  listBanners,
  saveBanner,
  deleteBanner,
  listRedirects,
  saveRedirect,
  deleteRedirect,
} from "@/server/services/structure";

export const runtime = "nodejs";

/** GET ?kind=banners|redirects */
export async function GET(request: NextRequest) {
  try {
    await requireApiSession();
    const kind = new URL(request.url).searchParams.get("kind");
    if (kind === "banners") return apiOk(await listBanners());
    if (kind === "redirects") return apiOk(await listRedirects());
    throw new ValidationError("Paramètre kind invalide (banners|redirects).");
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** POST {kind:"banner"|"redirect", …} */
export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) throw new ValidationError("Corps de requête manquant.");
    if (body.kind === "banner") {
      const allowed = await hasPermission(session.user, "banner.manage");
      if (!allowed) throw new PermissionError("Permission requise : banner.manage.");
      const { kind: _k, ...rest } = body as { kind?: string } & Record<string, unknown>;
      void _k;
      const input = bannerSaveSchema.parse(rest);
      return apiOk(await saveBanner({ ...input, id: (body.id as string) ?? undefined }, session.user.id));
    }
    if (body.kind === "redirect") {
      const allowed = await hasPermission(session.user, "redirect.manage");
      if (!allowed) throw new PermissionError("Permission requise : redirect.manage.");
      const input = redirectSaveSchema.parse(body);
      return apiOk(await saveRedirect(input, session.user.id));
    }
    throw new ValidationError("Paramètre kind invalide.");
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** DELETE ?kind=&id= */
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind");
    const id = url.searchParams.get("id");
    if (!id) throw new ValidationError("Paramètre id manquant.");
    if (kind === "banner") {
      const allowed = await hasPermission(session.user, "banner.manage");
      if (!allowed) throw new PermissionError("Permission requise : banner.manage.");
      return apiOk(await deleteBanner(id, session.user.id));
    }
    if (kind === "redirect") {
      const allowed = await hasPermission(session.user, "redirect.manage");
      if (!allowed) throw new PermissionError("Permission requise : redirect.manage.");
      return apiOk(await deleteRedirect(id, session.user.id));
    }
    throw new ValidationError("Paramètre kind invalide.");
  } catch (error) {
    return toErrorResponse(error);
  }
}
