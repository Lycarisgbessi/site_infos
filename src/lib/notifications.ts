import { db } from "@/lib/db";
import { stringifyJsonObject } from "@/lib/json";

/**
 * Notifications in-app du workflow éditorial (§11.2 « Workflow de statuts
 * avec transitions et notifications »). Table additive `notifications`
 * (DECISIONS.md D-13). Les destinataires sont résolus par rôle ; un e-mail
 * transactionnel s'ajoutera en Phase 7 (Resend, D-10).
 */

export type NotificationType =
  | "workflow.submit"
  | "workflow.publish"
  | "workflow.schedule"
  | "workflow.return"
  | "workflow.changes_requested";

export interface WorkflowNotificationPayload {
  article_id: string;
  title: string;
  from_status: string;
  to_status: string;
  actor_name: string;
  note?: string;
}

/**
 * Notifie tous les utilisateurs actifs porteurs d'au moins un des rôles
 * donnés (hors l'auteur de l'action).
 */
export async function notifyRoles(
  roleKeys: string[],
  type: NotificationType,
  payload: WorkflowNotificationPayload,
  opts?: { excludeUserId?: string }
): Promise<void> {
  try {
    const recipients = await db.user.findMany({
      where: {
        deleted_at: null,
        status: { in: ["active"] },
        userRoles: { some: { role: { key: { in: roleKeys } } } },
      },
      select: { id: true },
    });

    const targets = recipients.filter((r) => r.id !== opts?.excludeUserId);
    if (targets.length === 0) return;

    await db.notification.createMany({
      data: targets.map((t) => ({
        user_id: t.id,
        type,
        payload: stringifyJsonObject(payload as unknown as Record<string, unknown>),
      })),
    });
  } catch (error) {
    // Une notification ne doit jamais bloquer la transition métier
    console.error("[notifications] échec d'envoi :", error);
  }
}

/** Notifie un utilisateur précis (ex. l'auteur d'un article). */
export async function notifyUser(
  userId: string,
  type: NotificationType,
  payload: WorkflowNotificationPayload
): Promise<void> {
  try {
    await db.notification.create({
      data: {
        user_id: userId,
        type,
        payload: stringifyJsonObject(payload as unknown as Record<string, unknown>),
      },
    });
  } catch (error) {
    console.error("[notifications] échec d'envoi :", error);
  }
}
