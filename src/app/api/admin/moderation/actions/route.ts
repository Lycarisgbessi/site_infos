import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  requireApiSession,
  apiOk,
  toErrorResponse,
  ValidationError,
} from "@/lib/api/respond";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/audit";
import { getRequestContext } from "@/lib/auth/session";
import type { comment_status } from "@prisma/client";

export const runtime = "nodejs";

/**
 * POST /api/admin/moderation/actions (§11.2 — « Boîte unifiée ») :
 * actions de modération par lot sur les commentaires et la boîte de
 * réception, réponse officielle identifiée, bannissement d'auteur.
 *
 * Décisions de périmètre (documentées au worklog, tâche 2-d) :
 * - Commentaires : `comment.moderate` requis pour toutes les actions.
 * - Boîte de réception : `inbox.read` requis pour toutes les actions
 *   (lecture, clôture, indésirable, assignation, suppression) — boîte
 *   d'équipe partagée, chaque décision est tracée dans audit_log.
 * - `ban` : ajoute l'e-mail normalisé (minuscules) au réglage
 *   `moderation.banned_emails` (créé au besoin, group_key « moderation »)
 *   ET rejette les commentaires sélectionnés — la file est réellement
 *   vidée, pas seulement marquée.
 * - `reply` (et `official_reply` fournie avec approve/reject/spam) : crée
 *   une réponse enfant `is_staff: true`, approuvée, signée du nom affiché
 *   de l'agent — la « réponse officielle identifiée visuellement ».
 *   Son e-mail n'est pas stocké (minimisation des données, §17.3).
 * - Audit : une entrée par lot (`comment.moderate` / `inbox.update`),
 *   avant/après sérialisés (D-01), contexte de requête inclus.
 */

const COMMENT_ACTION_VALUES = [
  "approve",
  "reject",
  "spam",
  "delete",
  "reply",
  "ban",
] as const;
const INBOX_ACTION_VALUES = ["read", "assigned", "closed", "spam", "delete"] as const;

const bodySchema = z.discriminatedUnion("target", [
  z.object({
    target: z.literal("comment"),
    ids: z.array(z.string().min(1)).min(1).max(100),
    action: z.enum(COMMENT_ACTION_VALUES),
    official_reply: z.string().trim().max(2000).optional(),
  }),
  z.object({
    target: z.literal("inbox"),
    ids: z.array(z.string().min(1)).min(1).max(100),
    action: z.enum(INBOX_ACTION_VALUES),
    assigned_to: z.string().min(1).nullable().optional(),
  }),
]);

/** Clé du réglage des e-mails bannis (§11.2 — bannissement). */
const BANNED_EMAILS_KEY = "moderation.banned_emails";

/** Lit la liste des e-mails bannis ([] si le réglage n'existe pas encore). */
async function readBannedEmails(): Promise<string[]> {
  const setting = await db.setting.findUnique({
    where: { key: BANNED_EMAILS_KEY },
    select: { value: true },
  });
  if (!setting) return [];
  try {
    const parsed: unknown = JSON.parse(setting.value);
    return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
  } catch {
    return [];
  }
}

/** Ajoute des e-mails normalisés au réglage (upsert, group_key « moderation »). */
async function addToBannedEmails(emails: string[]): Promise<string[]> {
  const current = await readBannedEmails();
  const merged = Array.from(new Set([...current, ...emails]));
  await db.setting.upsert({
    where: { key: BANNED_EMAILS_KEY },
    update: { value: JSON.stringify(merged), updated_at: new Date() },
    create: {
      key: BANNED_EMAILS_KEY,
      value: JSON.stringify(merged),
      group_key: "moderation",
      label: "E-mails bannis",
    },
  });
  return merged;
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const ctx = getRequestContext(request.headers);
    const body = await request.json().catch(() => null);
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = bodySchema.parse(body);

    // ── Commentaires (comment.moderate) ───────────────────────────────
    if (input.target === "comment") {
      await requirePermission(session.user, "comment.moderate");
      const { ids, action } = input;

      const before = await db.comment.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          status: true,
          moderated_by: true,
          author_email: true,
          article_id: true,
          parent_id: true,
        },
      });
      if (before.length === 0) {
        throw new ValidationError("Aucun commentaire correspondant.");
      }

      let updated = 0;
      let deleted = false;
      let afterStatuses: Record<string, string> | null = null;
      let repliesCreated = 0;
      let bannedEmails: string[] | undefined;

      if (action === "approve" || action === "reject" || action === "spam") {
        const status: comment_status =
          action === "approve" ? "approved" : action === "reject" ? "rejected" : "spam";
        const result = await db.comment.updateMany({
          where: { id: { in: ids } },
          data: { status, moderated_by: session.user.id, moderated_at: new Date() },
        });
        updated = result.count;
        afterStatuses = Object.fromEntries(before.map((c) => [c.id, status]));
      } else if (action === "delete") {
        const result = await db.comment.deleteMany({ where: { id: { in: ids } } });
        updated = result.count;
        deleted = true;
      } else if (action === "ban") {
        // E-mails présents sur les commentaires sélectionnés, normalisés.
        const emails = Array.from(
          new Set(
            before
              .map((c) => c.author_email?.trim().toLowerCase() ?? "")
              .filter((e) => e.length > 0)
          )
        );
        if (emails.length === 0) {
          throw new ValidationError(
            "Aucun e-mail d'auteur sur la sélection — bannissement impossible."
          );
        }
        bannedEmails = await addToBannedEmails(emails);
        // Un bannissement retire aussi les messages de la file (rejet).
        const result = await db.comment.updateMany({
          where: { id: { in: ids } },
          data: {
            status: "rejected",
            moderated_by: session.user.id,
            moderated_at: new Date(),
          },
        });
        updated = result.count;
        afterStatuses = Object.fromEntries(before.map((c) => [c.id, "rejected"]));
      } else {
        // action === "reply" : réponse officielle, texte requis.
        const text = input.official_reply ?? "";
        if (text.length === 0) {
          throw new ValidationError("Le texte de la réponse officielle est requis.");
        }
      }

      // Réponse officielle : seule (reply) ou jointe à une décision
      // d'approbation/rejet/spam. Jamais avec delete (parents supprimés).
      const replyText =
        action === "reply"
          ? (input.official_reply ?? "")
          : (action === "approve" || action === "reject" || action === "spam") &&
              input.official_reply &&
              input.official_reply.length > 0
            ? input.official_reply
            : null;
      if (replyText !== null) {
        const result = await db.comment.createMany({
          data: before.map((c) => ({
            article_id: c.article_id,
            parent_id: c.id,
            author_name: session.user.displayName,
            author_email: null, // minimisation : l'e-mail de l'agent n'est pas publié
            body: replyText,
            status: "approved" as const,
            is_staff: true,
            moderated_by: session.user.id,
            moderated_at: new Date(),
          })),
        });
        repliesCreated = result.count;
        updated += result.count;
      }

      const after: Record<string, unknown> = {};
      if (afterStatuses) after.statuses = afterStatuses;
      if (deleted) after.deleted = true;
      if (repliesCreated > 0) after.officialReplies = repliesCreated;
      if (bannedEmails) after.bannedEmails = bannedEmails;

      await auditLog({
        userId: session.user.id,
        action: "comment.moderate",
        resourceType: "comment",
        resourceId: ids.join(",").slice(0, 200),
        before: before.map((c) => ({
          id: c.id,
          status: c.status,
          moderated_by: c.moderated_by,
        })),
        after,
        request: ctx,
      });

      return apiOk({ updated });
    }

    // ── Boîte de réception (inbox.read) ───────────────────────────────
    await requirePermission(session.user, "inbox.read");
    const { ids, action } = input;

    const before = await db.inboxMessage.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true, assigned_to: true },
    });
    if (before.length === 0) {
      throw new ValidationError("Aucun message correspondant.");
    }

    let updated = 0;
    let deleted = false;
    const afterStatuses: Record<string, string> = {};

    if (action === "read" || action === "closed" || action === "spam") {
      const status = action === "read" ? "read" : action === "closed" ? "closed" : "spam";
      const result = await db.inboxMessage.updateMany({
        where: { id: { in: ids } },
        data: { status },
      });
      updated = result.count;
      for (const m of before) afterStatuses[m.id] = status;
    } else if (action === "assigned") {
      if (input.assigned_to != null) {
        const user = await db.user.findFirst({
          where: { id: input.assigned_to, deleted_at: null },
          select: { id: true },
        });
        if (!user) throw new ValidationError("Utilisateur désigné introuvable.");
      }
      // Assignation — ou retrait (assigned_to null : retour à « lu »).
      const status = input.assigned_to != null ? "assigned" : "read";
      const result = await db.inboxMessage.updateMany({
        where: { id: { in: ids } },
        data: { status, assigned_to: input.assigned_to ?? null },
      });
      updated = result.count;
      for (const m of before) afterStatuses[m.id] = status;
    } else {
      // action === "delete"
      const result = await db.inboxMessage.deleteMany({ where: { id: { in: ids } } });
      updated = result.count;
      deleted = true;
    }

    await auditLog({
      userId: session.user.id,
      action: "inbox.update",
      resourceType: "inbox_message",
      resourceId: ids.join(",").slice(0, 200),
      before: before.map((m) => ({
        id: m.id,
        status: m.status,
        assigned_to: m.assigned_to,
      })),
      after: deleted
        ? { deleted: true }
        : {
            statuses: afterStatuses,
            ...(action === "assigned"
              ? { assigned_to: input.assigned_to ?? null }
              : {}),
          },
      request: ctx,
    });

    return apiOk({ updated });
  } catch (error) {
    return toErrorResponse(error);
  }
}
