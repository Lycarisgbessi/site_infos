import { z } from "zod";

/**
 * Régie publicitaire simplifiée (2026-10) — validation des campagnes.
 * Une campagne côté back-office porte exactement une créative : le média
 * provient de la médiathèque (image/GIF) ou d'une URL vidéo externe.
 */

const httpUrl = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .regex(/^https?:\/\//i, "L'URL doit commencer par http:// ou https://");

export const AD_MEDIA_KINDS = ["image", "gif", "video"] as const;
export type AdMediaKind = (typeof AD_MEDIA_KINDS)[number];

const isoDate = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Date invalide (ISO 8601 attendu).");

const adCampaignFields = {
  name: z.string().trim().min(1).max(200),
  advertiser: z.string().trim().min(1).max(200),
  slot_code: z.string().trim().regex(/^AD-\d{2}$/, "Emplacement invalide (format AD-01 … AD-19)."),
  media_kind: z.enum(AD_MEDIA_KINDS),
  media_id: z.string().uuid().nullable().optional(),
  video_url: httpUrl.nullable().optional(),
  click_url: httpUrl,
  starts_at: isoDate,
  ends_at: isoDate.nullable().optional(),
  priority: z.number().int().min(1).max(9).optional(),
  is_active: z.boolean().optional(),
};

export const adCampaignCreateSchema = z.object(adCampaignFields).superRefine((data, ctx) => {
  if (data.media_kind === "video" && !data.video_url) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["video_url"],
      message: "Une URL vidéo (YouTube ou mp4) est requise pour une campagne vidéo.",
    });
  }
  if (data.media_kind !== "video" && !data.media_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["media_id"],
      message: "Un média de la médiathèque est requis pour une campagne image ou GIF.",
    });
  }
  if (data.ends_at && new Date(data.ends_at).getTime() <= new Date(data.starts_at).getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ends_at"],
      message: "La date de fin doit être postérieure à la date de début.",
    });
  }
});

// Partial appliqué sur l'objet brut (Zod interdit .partial() après refinement) ;
// la cohérence des champs fournis est revalidée côté service.
export const adCampaignUpdateSchema = z.object(adCampaignFields).partial().superRefine((data, ctx) => {
  if (data.media_kind === "video" && data.video_url === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["video_url"],
      message: "Une URL vidéo (YouTube ou mp4) est requise pour une campagne vidéo.",
    });
  }
  if (data.media_kind !== undefined && data.media_kind !== "video" && data.media_id === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["media_id"],
      message: "Un média de la médiathèque est requis pour une campagne image ou GIF.",
    });
  }
  if (data.ends_at && data.starts_at && new Date(data.ends_at).getTime() <= new Date(data.starts_at).getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ends_at"],
      message: "La date de fin doit être postérieure à la date de début.",
    });
  }
});

export type AdCampaignCreateInput = z.infer<typeof adCampaignCreateSchema>;
export type AdCampaignUpdateInput = z.infer<typeof adCampaignUpdateSchema>;
