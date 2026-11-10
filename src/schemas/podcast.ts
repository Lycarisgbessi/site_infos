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

/** Type de média d'un épisode : audio (défaut) ou vidéo (YouTube/Drive/mp4). */
export const podcastMediaKindSchema = z.enum(["audio", "video"]);

export type PodcastMediaKind = z.infer<typeof podcastMediaKindSchema>;

/**
 * URL vidéo : lien http(s) YouTube (watch, youtu.be, embed, shorts),
 * Google Drive (converti en aperçu intégré côté service) ou fichier
 * direct (.mp4). Obligatoire si media_kind = "video", interdite sinon.
 */
const videoUrl = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine(
    (value) => /^https?:\/\//i.test(value),
    "URL vidéo invalide : lien http(s) YouTube, Google Drive ou .mp4 direct attendu.",
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

/**
 * Champs d'épisode (audio OU vidéo) :
 *  - audio : `audio_url` obligatoire, `video_url` interdite ;
 *  - video : `video_url` obligatoire, `audio_url` inutilisée (facultative).
 * Les règles croisées sont appliquées par superRefine (create) et côté
 * service pour la mise à jour (état « before » nécessaire).
 */
const podcastEpisodeObject = z.object({
  title: z.string().trim().min(1).max(300),
  slug,
  season_id: z.string().uuid(),
  description: z.string().trim().max(5000).nullable().optional(),
  position: z.number().int().min(0).optional(),
  audio_url: audioUrl.optional(),
  media_kind: podcastMediaKindSchema.default("audio"),
  video_url: videoUrl.nullable().optional(),
  duration_sec: z.number().int().min(0).max(86_400).nullable().optional(),
  cover_media_id: z.string().uuid().nullable().optional(),
  published_at: isoDate.optional(),
  is_active: z.boolean().optional(),
});

export const podcastEpisodeCreateSchema = podcastEpisodeObject.superRefine((data, ctx) => {
  if (data.media_kind === "video") {
    if (data.video_url == null || data.video_url.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["video_url"],
        message: "L'URL vidéo (YouTube, Google Drive ou .mp4) est obligatoire pour un épisode vidéo.",
      });
    }
  } else {
    if (data.video_url != null && data.video_url.trim() !== "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["video_url"],
        message: "L'URL vidéo est réservée aux épisodes de type « vidéo ».",
      });
    }
    if (data.audio_url == null || data.audio_url.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["audio_url"],
        message: "L'URL audio (directe ou Google Drive) est obligatoire pour un épisode audio.",
      });
    }
  }
});

export const podcastEpisodeUpdateSchema = podcastEpisodeObject.partial().superRefine((data, ctx) => {
  // En mise à jour partielle, on ne valide que les incohérences locales ;
  // les règles nécessitant l'état en base (ex. passer en vidéo sans URL)
  // sont vérifiées côté service (updateEpisode).
  if (data.media_kind === "audio" && data.video_url != null && data.video_url.trim() !== "") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["video_url"],
      message: "L'URL vidéo est réservée aux épisodes de type « vidéo ».",
    });
  }
  if (data.media_kind === "video" && data.video_url !== undefined && (data.video_url === null || data.video_url.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["video_url"],
      message: "L'URL vidéo (YouTube, Google Drive ou .mp4) est obligatoire pour un épisode vidéo.",
    });
  }
});

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
