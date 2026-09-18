import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireApiSession, apiOk, toErrorResponse } from "@/lib/api/respond";

export const runtime = "nodejs";

/**
 * GET /api/admin/users/options — liste minimale (id, nom, slug) pour les
 * panneaux Signature et attribution ; n'expose aucun champ sensible.
 */
export async function GET(_request: NextRequest) {
  try {
    await requireApiSession();
    const users = await db.user.findMany({
      where: { deleted_at: null, status: { in: ["active", "invited"] } },
      orderBy: { display_name: "asc" },
      select: { id: true, display_name: true, slug: true },
      take: 500,
    });
    return apiOk(users, { count: users.length });
  } catch (error) {
    return toErrorResponse(error);
  }
}
