import type { NextRequest } from "next/server";
import { requireApiSession, apiOk, toErrorResponse, ValidationError } from "@/lib/api/respond";
import { requirePermission } from "@/lib/permissions";
import { subscriberStatusUpdateSchema } from "@/schemas/newsletter";
import { setSubscriberStatus, deleteSubscriber } from "@/server/services/newsletter";

export const runtime = "nodejs";

/**
 * Mutations sur un inscrit newsletter (§06.3) — ordre contractuel §07.2 :
 * session → validation Zod → permission (subscriber.manage) → écriture →
 * audit (dans le service).
 */

/** PATCH /api/admin/newsletter/subscribers/[id] — changement de statut. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiSession();
    await requirePermission(session.user, "subscriber.manage");
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = subscriberStatusUpdateSchema.parse(body);
    return apiOk(await setSubscriberStatus(session.user.id, id, input.status));
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** DELETE /api/admin/newsletter/subscribers/[id] — suppression définitive. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiSession();
    await requirePermission(session.user, "subscriber.manage");
    const { id } = await params;
    return apiOk(await deleteSubscriber(session.user.id, id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
