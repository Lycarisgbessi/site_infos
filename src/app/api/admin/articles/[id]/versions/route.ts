import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { listVersions, getVersionDiff, restoreVersion } from "@/server/services/articles";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const restoreSchema = z.object({ version: z.number().int().min(1) });

/** GET /api/admin/articles/[id]/versions?a=&b= — historique ou diff (§11.2) */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await requireApiSession();
    const { id } = await params;
    const url = new URL(request.url);
    const a = url.searchParams.get("a");
    const b = url.searchParams.get("b");
    if (a && b) {
      const diff = await getVersionDiff(session, id, Number(a), Number(b));
      return apiOk(diff);
    }
    const versions = await listVersions(session, id);
    return apiOk(versions, { count: versions.length });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** POST /api/admin/articles/[id]/versions — restauration (§11.2) */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requireApiSession();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = restoreSchema.parse(body);
    const result = await restoreVersion(session, id, input.version);
    return apiOk(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
