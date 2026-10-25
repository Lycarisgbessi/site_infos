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

export const AD_DEVICE_TARGETS = ["ALL", "MOBILE", "DESKTOP"] as const;
export type AdDeviceTarget = (typeof AD_DEVICE_TARGETS)[number];

const isoDate = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Date invalide (ISO 8601 attendue).");

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
  // Système « taquin » 2026-10 : ciblage + créative HTML de repli.
  device_targeting: z.enum(AD_DEVICE_TARGETS).optional(),
  category_targeting: z
    .string()
    .trim()
    .max(500, "Liste de rubriques trop longue (500 caractères max).")
    .nullable()
    .optional(),
  html_code: z.string().max(20_000, "Code HTML trop volumineux (20 000 caractères max).").nullable().optional(),
};

export const adCampaignCreateSchema = z.object(adCampaignFields).superRefine((data, ctx) => {
  // Créative HTML de repli : dispense de média/vidéo (rendu sanitizé).
  const hasHtmlFallback = Boolean(data.html_code && data.html_code.trim());
  if (data.media_kind === "video" && !data.video_url && !hasHtmlFallback) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["video_url"],
      message: "Une URL vidéo (YouTube ou mp4) est requise pour une campagne vidéo.",
    });
  }
  if (data.media_kind !== "video" && !data.media_id && !hasHtmlFallback) {
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
  const hasHtmlFallback = Boolean(data.html_code && data.html_code.trim());
  if (data.media_kind === "video" && data.video_url === undefined && !hasHtmlFallback) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["video_url"],
      message: "Une URL vidéo (YouTube ou mp4) est requise pour une campagne vidéo.",
    });
  }
  if (data.media_kind !== undefined && data.media_kind !== "video" && data.media_id === undefined && !hasHtmlFallback) {
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
