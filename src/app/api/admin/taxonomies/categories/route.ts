import type { NextRequest } from "next/server";
import {
  categoryCreateSchema,
  categoryReorderSchema,
  categoryUpdateSchema,
  categoryDeleteSchema,
} from "@/schemas/taxonomy";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import {
  listCategoryTree,
  createCategory,
  updateCategory,
  reorderCategories,
  deleteCategory,
} from "@/server/services/taxonomies";

export const runtime = "nodejs";

/**
 * /api/admin/taxonomies/categories
 * GET    — arbre complet (§11.2, 3 niveaux)
 * POST   — création | {action:"reorder"} réordonnancement
 * PATCH  — mise à jour (?id=…) avec redirection 301 au renommage
 * DELETE — suppression avec réaffectation obligatoire si articles (?id=&reassign_to=)
 */
export async function GET() {
  try {
    await requireApiSession();
    const tree = await listCategoryTree();
    return apiOk(tree, { count: tree.length });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) throw new ValidationError("Corps de requête manquant.");

    if (body.action === "reorder") {
      const input = categoryReorderSchema.parse(body);
      const result = await reorderCategories(input, session.user.id);
      return apiOk(result);
    }
    const input = categoryCreateSchema.parse(body);
    const category = await createCategory(input, session.user.id);
    return apiOk(category);
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
    const input = categoryUpdateSchema.parse(body);
    const result = await updateCategory(id, input, session.user.id);
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
    const input = categoryDeleteSchema.parse({
      reassign_to: url.searchParams.get("reassign_to") ?? undefined,
    });
    const result = await deleteCategory(id, session.user.id, input);
    return apiOk(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
