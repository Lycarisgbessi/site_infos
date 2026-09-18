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
import type { comment_status } from "@prisma/client";

export const runtime = "nodejs";

/**
 * GET /api/admin/moderation (§11.2 — « Boîte unifiée ») :
 * file des commentaires et boîte de réception (contacts, alertes info,
 * droits de réponse…) avec filtres, recherche et pagination.
 *
 * Permissions : `comment.moderate` pour l'onglet commentaires,
 * `inbox.read` pour l'onglet boîte de réception.
 */

const COMMENT_STATUSES = ["pending", "approved", "rejected", "spam"] as const;
const INBOX_STATUSES = ["new", "read", "assigned", "closed", "spam"] as const;
const INBOX_KINDS = [
  "contact",
  "tip",
  "right_of_reply",
  "advertising",
  "correction",
  "job",
] as const;

const querySchema = z.object({
  tab: z.enum(["comments", "inbox"]).default("comments"),
  status: z.string().max(20).optional(),
  kind: z.string().max(30).optional(),
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const url = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(url.searchParams));
    const { tab, page, per_page: perPage } = query;
    const q = query.q?.trim() ?? "";
    const skip = (page - 1) * perPage;

    if (tab === "comments") {
      await requirePermission(session.user, "comment.moderate");

      const status = query.status ?? "all";
      if (
        status !== "all" &&
        !COMMENT_STATUSES.includes(status as (typeof COMMENT_STATUSES)[number])
      ) {
        throw new ValidationError("Statut de commentaire inconnu.");
      }

      const where = {
        ...(status !== "all" ? { status: status as comment_status } : {}),
        ...(q !== ""
          ? {
              OR: [
                { author_name: { contains: q } },
                { author_email: { contains: q } },
                { body: { contains: q } },
                { article: { title: { contains: q } } },
              ],
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        db.comment.findMany({
          where,
          include: {
            article: { select: { title: true, slug: true, category_id: true } },
            moderatedBy: { select: { display_name: true } },
          },
          orderBy: { created_at: "desc" },
          skip,
          take: perPage,
        }),
        db.comment.count({ where }),
      ]);

      return apiOk(items, { page, per_page: perPage, total, tab });
    }

    // tab === "inbox"
    await requirePermission(session.user, "inbox.read");

    const status = query.status ?? "all";
    if (
      status !== "all" &&
      !INBOX_STATUSES.includes(status as (typeof INBOX_STATUSES)[number])
    ) {
      throw new ValidationError("Statut de message inconnu.");
    }
    const kind = query.kind ?? "all";
    if (
      kind !== "all" &&
      !INBOX_KINDS.includes(kind as (typeof INBOX_KINDS)[number])
    ) {
      throw new ValidationError("Type de message inconnu.");
    }

    const where = {
      ...(status !== "all" ? { status } : {}),
      ...(kind !== "all" ? { kind } : {}),
      ...(q !== ""
        ? {
            OR: [
              { name: { contains: q } },
              { email: { contains: q } },
              { subject: { contains: q } },
              { body: { contains: q } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      db.inboxMessage.findMany({
        where,
        include: { assignedTo: { select: { display_name: true } } },
        orderBy: { created_at: "desc" },
        skip,
        take: perPage,
      }),
      db.inboxMessage.count({ where }),
    ]);

    return apiOk(items, { page, per_page: perPage, total, tab });
  } catch (error) {
    return toErrorResponse(error);
  }
}
