import { db } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ValidationError } from "@/lib/api/respond";
import type { Prisma } from "@prisma/client";
import type { SubscriberStatusValue } from "@/schemas/newsletter";

/**
 * Newsletter (§06.3) — écran d'administration /admin/newsletter :
 * consultation des inscrits (Subscriber), indicateurs par statut et par
 * liste de diffusion (NewsletterList), mutations de statut (confirmation
 * manuelle, désabonnement) et suppression, toutes journalisées (§07.2).
 */

// ─── Types de vue (transport JSON vers le client) ──────────────────────

export interface SubscriberListView {
  id: string;
  key: string;
  name: string;
  is_active: boolean;
  subscribers: number;
}

export interface NewsletterStatsView {
  total: number;
  pending: number;
  confirmed: number;
  unsubscribed: number;
  bounced: number;
  complained: number;
}

export interface SubscriberRow {
  id: string;
  email: string;
  first_name: string | null;
  country: string | null;
  status: SubscriberStatusValue;
  source: string | null;
  created_at: string;
  unsubscribed_at: string | null;
  lists: { key: string; name: string }[];
}

export interface SubscriberFilters {
  q?: string;
  status?: SubscriberStatusValue;
  listId?: string;
}

// ─── Indicateurs (cartes) ──────────────────────────────────────────────

/** Compteurs globaux par statut + effectifs par liste de diffusion. */
export async function getNewsletterOverview(): Promise<{
  stats: NewsletterStatsView;
  lists: SubscriberListView[];
}> {
  const [groups, lists] = await Promise.all([
    db.subscriber.groupBy({ by: ["status"], _count: { _all: true } }),
    db.newsletterList.findMany({
      orderBy: { position: "asc" },
      select: {
        id: true,
        key: true,
        name: true,
        is_active: true,
        _count: { select: { subscribers: true } },
      },
    }),
  ]);

  const byStatus = new Map(groups.map((g) => [g.status as SubscriberStatusValue, g._count._all]));
  return {
    stats: {
      total: groups.reduce((sum, g) => sum + g._count._all, 0),
      pending: byStatus.get("pending") ?? 0,
      confirmed: byStatus.get("confirmed") ?? 0,
      unsubscribed: byStatus.get("unsubscribed") ?? 0,
      bounced: byStatus.get("bounced") ?? 0,
      complained: byStatus.get("complained") ?? 0,
    },
    lists: lists.map((l) => ({
      id: l.id,
      key: l.key,
      name: l.name,
      is_active: l.is_active,
      subscribers: l._count.subscribers,
    })),
  };
}

// ─── Liste des inscrits (recherche, filtres, pagination) ───────────────

function buildWhere(filters: SubscriberFilters): Prisma.SubscriberWhereInput {
  // Les e-mails sont normalisés en minuscules à l'inscription (§06.2 citext)
  // — la recherche s'applique donc sur la forme minuscule.
  const email = filters.q?.trim().toLowerCase();
  return {
    ...(email ? { email: { contains: email } } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.listId ? { lists: { some: { list_id: filters.listId } } } : {}),
  };
}

const subscriberInclude = {
  lists: {
    orderBy: { subscribed_at: "asc" },
    select: { list: { select: { key: true, name: true } } },
  },
} as const;

type SubscriberWithLists = Prisma.SubscriberGetPayload<{ include: typeof subscriberInclude }>;

function toRow(s: SubscriberWithLists): SubscriberRow {
  return {
    id: s.id,
    email: s.email,
    first_name: s.first_name,
    country: s.country,
    status: s.status as SubscriberStatusValue,
    source: s.source,
    created_at: s.created_at.toISOString(),
    unsubscribed_at: s.unsubscribed_at ? s.unsubscribed_at.toISOString() : null,
    lists: s.lists.map((sl) => ({ key: sl.list.key, name: sl.list.name })),
  };
}

export async function listSubscribers(
  filters: SubscriberFilters,
  page: number,
  perPage: number
): Promise<{ items: SubscriberRow[]; total: number }> {
  const where = buildWhere(filters);
  const [total, rows] = await Promise.all([
    db.subscriber.count({ where }),
    db.subscriber.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: subscriberInclude,
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);
  return { items: rows.map(toRow), total };
}

/** Export CSV : mêmes filtres, sans pagination, plafonné (§11.2, comme l'audit). */
export const SUBSCRIBER_CSV_LIMIT = 5000;

export async function listSubscribersForExport(filters: SubscriberFilters): Promise<SubscriberRow[]> {
  const rows = await db.subscriber.findMany({
    where: buildWhere(filters),
    orderBy: { created_at: "desc" },
    include: subscriberInclude,
    take: SUBSCRIBER_CSV_LIMIT,
  });
  return rows.map(toRow);
}

// ─── Mutations (statut, suppression) ───────────────────────────────────

/** Confirmation manuelle / désabonnement / changement de statut. */
export async function setSubscriberStatus(
  userId: string,
  id: string,
  status: SubscriberStatusValue
): Promise<SubscriberRow> {
  const existing = await db.subscriber.findUnique({ where: { id } });
  if (!existing) throw new ValidationError("Inscrit introuvable.");

  const data: Prisma.SubscriberUpdateInput = { status };
  if (status === "confirmed") {
    // Confirmation manuelle : le jeton de confirmation devient inutile et un
    // éventuel désabonnement antérieur est levé.
    data.confirm_token = null;
    data.unsubscribed_at = null;
    if (!existing.consent_at) data.consent_at = new Date();
  }
  if (status === "unsubscribed") {
    data.unsubscribed_at = new Date();
  }
  if ((status === "pending" || status === "bounced" || status === "complained") && existing.unsubscribed_at) {
    data.unsubscribed_at = null;
  }

  const updated = await db.subscriber.update({
    where: { id },
    data,
    include: subscriberInclude,
  });
  await auditLog({
    userId,
    action: "newsletter.subscriber_status",
    resourceType: "subscriber",
    resourceId: id,
    before: { email: existing.email, status: existing.status },
    after: { email: updated.email, status: updated.status },
  });
  return toRow(updated);
}

export async function deleteSubscriber(userId: string, id: string): Promise<{ id: string }> {
  const existing = await db.subscriber.findUnique({ where: { id }, select: { email: true, status: true } });
  if (!existing) throw new ValidationError("Inscrit introuvable.");
  // Suppression définitive (RGPD : droit à l'effacement — les inscriptions
  // SubscriberList/EmailEvent sont supprimées en cascade par le schéma).
  await db.subscriber.delete({ where: { id } });
  await auditLog({
    userId,
    action: "newsletter.subscriber_delete",
    resourceType: "subscriber",
    resourceId: id,
    before: { email: existing.email, status: existing.status },
  });
  return { id };
}
