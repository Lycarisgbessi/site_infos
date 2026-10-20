import { z } from "zod";

/**
 * Newsletter (§06.3, écran admin /admin/newsletter) — validation des
 * requêtes de lecture des inscrits (filtres, pagination, export CSV) et
 * des mutations de statut (confirmation manuelle, désabonnement).
 */

/** Statuts possibles d'un Subscriber (enum `subscriber_status` du §06.2). */
export const SUBSCRIBER_STATUSES = [
  "pending",
  "confirmed",
  "unsubscribed",
  "bounced",
  "complained",
] as const;

export type SubscriberStatusValue = (typeof SUBSCRIBER_STATUSES)[number];

export const subscribersQuerySchema = z.object({
  q: z.string().trim().max(254).optional(), // recherche par e-mail
  status: z.enum(SUBSCRIBER_STATUSES).optional(),
  list_id: z.string().trim().min(1).max(64).optional(),
  page: z.coerce.number().int().min(1).max(100000).optional(),
  per_page: z.coerce.number().int().min(1).max(100).optional(),
  format: z.enum(["json", "csv"]).optional(),
});

export type SubscribersQuery = z.infer<typeof subscribersQuerySchema>;

export const subscriberStatusUpdateSchema = z.object({
  status: z.enum(SUBSCRIBER_STATUSES),
});

export type SubscriberStatusUpdateInput = z.infer<typeof subscriberStatusUpdateSchema>;
