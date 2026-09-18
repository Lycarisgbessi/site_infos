import type { NextRequest } from "next/server";
import { tagCreateSchema, tagUpdateSchema, tagMergeSchema } from "@/schemas/taxonomy";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import {
  listTags,
  createTag,
  updateTag,
  deleteTag,
  mergeTags,
} from "@/server/services/taxonomies";
import { z } from "zod";

export const runtime = "nodejs";

const unmergeSchema = z.object({ audit_id: z.number().int() });

/**
 * /api/admin/taxonomies/tags
 * GET    — liste (usage_count desc)
 * POST   — création | {action:"merge"} fusion | {action:"unmerge"} annulation
 * PATCH  — mise à jour (?id=…) — renommage → 301 /tags/{ancien}
 * DELETE — suppression (?id=…)
 */
export async function GET() {
  try {
    await requireApiSession();
    const tags = await listTags();
    return apiOk(tags, { count: tags.length });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) throw new ValidationError("Corps de requête manquant.");

    if (body.action === "merge") {
      const input = tagMergeSchema.parse(body);
      const result = await mergeTags(input, session.user.id);
      return apiOk(result);
    }
    if (body.action === "unmerge") {
      const input = unmergeSchema.parse(body);
      const { unmergeLastTag } = await import("@/server/services/taxonomies");
      const result = await unmergeLastTag(input.audit_id, session.user.id);
      return apiOk(result);
    }
    const input = tagCreateSchema.parse(body);
    const tag = await createTag(input, session.user.id);
    return apiOk(tag);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) throw new ValidationError("Paramètre id manquant.");
    const body = await request.json().catch(() => null);
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = tagUpdateSchema.parse(body);
    const result = await updateTag(id, input, session.user.id);
    return apiOk(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) throw new ValidationError("Paramètre id manquant.");
    const result = await deleteTag(id, session.user.id);
    return apiOk(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
