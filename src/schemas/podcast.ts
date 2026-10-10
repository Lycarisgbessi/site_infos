import { z } from "zod";

/**
 * Podcast / FM — validation des saisons et épisodes (§ /admin/podcast).
 * `audio_url` accepte une URL directe (http/https) OU un lien Google Drive
 * (file/d/{id}, open?id=…, ID brut) — la conversion en flux lisible est
 * réalisée côté service (src/lib/drive.ts).
 */

const slug = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug invalide (minuscules, chiffres, tirets).");

const audioUrl = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine(
    (value) => /^https?:\/\//i.test(value) || /drive\.google\.com|docs\.google\.com/.test(value) || /^[A-Za-z0-9_-]{20,}$/.test(value),
    "URL audio invalide : http(s):// direct ou lien Google Drive attendu.",
  );

const isoDate = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Date invalide (ISO 8601 attendu).");

// ─── Saisons ──────────────────────────────────────────────────────────

export const podcastSeasonCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug,
  description: z.string().trim().max(2000).nullable().optional(),
  position: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export const podcastSeasonUpdateSchema = podcastSeasonCreateSchema.partial();

export const podcastSeasonReorderSchema = z.object({
  items: z
    .array(z.object({ id: z.string().uuid(), position: z.number().int().min(0) }))
    .min(1)
    .max(500),
});

// ─── Épisodes ─────────────────────────────────────────────────────────

export const podcastEpisodeCreateSchema = z.object({
  title: z.string().trim().min(1).max(300),
  slug,
  season_id: z.string().uuid(),
  description: z.string().trim().max(5000).nullable().optional(),
  position: z.number().int().min(0).optional(),
  audio_url: audioUrl,
  duration_sec: z.number().int().min(0).max(86_400).nullable().optional(),
  cover_media_id: z.string().uuid().nullable().optional(),
  published_at: isoDate.optional(),
  is_active: z.boolean().optional(),
});

export const podcastEpisodeUpdateSchema = podcastEpisodeCreateSchema.partial();

export const podcastEpisodeReorderSchema = z.object({
  items: z
    .array(z.object({ id: z.string().uuid(), position: z.number().int().min(0) }))
    .min(1)
    .max(1000),
});

export type PodcastSeasonCreateInput = z.infer<typeof podcastSeasonCreateSchema>;
export type PodcastSeasonUpdateInput = z.infer<typeof podcastSeasonUpdateSchema>;
export type PodcastEpisodeCreateInput = z.infer<typeof podcastEpisodeCreateSchema>;
export type PodcastEpisodeUpdateInput = z.infer<typeof podcastEpisodeUpdateSchema>;
