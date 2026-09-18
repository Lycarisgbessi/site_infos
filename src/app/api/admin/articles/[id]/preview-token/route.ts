import type { NextRequest } from "next/server";
import { requireApiSession, apiOk, toErrorResponse } from "@/lib/api/respond";
import { signPreviewToken } from "@/lib/auth/preview";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** GET /api/admin/articles/[id]/preview-token — jeton d'aperçu 24 h (§11.1) */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireApiSession();
    const { id } = await params;
    return apiOk({ token: signPreviewToken(id), url: `/admin/preview/${id}` });
  } catch (error) {
    return toErrorResponse(error);
  }
}
