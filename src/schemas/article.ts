import { z } from "zod";
import { blocksSchema } from "./blocks";

/**
 * Schémas Zod du domaine article (§06.2 articles, §11.2 éditeur + panneaux).
 */

export const ARTICLE_STATUSES = [
  "draft",
  "in_review",
  "changes_requested",
  "approved",
  "scheduled",
  "published",
  "updated",
  "archived",
  "unpublished",
] as const;

export const ARTICLE_FORMATS = [
  "brief",
  "standard",
  "analysis",
  "investigation",
  "interview",
  "opinion",
  "portrait",
  "live",
  "video",
  "infographic",
  "factcheck",
  "press_review",
] as const;

export const ARTICLE_VISIBILITIES = ["public", "unlisted", "restricted"] as const;

// ─── Panneau Publication ───────────────────────────────────────────────
export const publicationPanelSchema = z.object({
  status: z.enum(ARTICLE_STATUSES).optional(),
  scheduled_at: z.string().datetime({ offset: true }).nullable().optional(),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
  visibility: z.enum(ARTICLE_VISIBILITIES).optional(),
  importance: z.number().int().min(1).max(5).optional(),
  is_breaking: z.boolean().optional(),
  send_push: z.boolean().optional(),
  include_newsletter: z.boolean().optional(),
  social_text: z.string().max(1000).nullable().optional(),
});

// ─── Panneau Classement ────────────────────────────────────────────────
export const classificationPanelSchema = z.object({
  category_id: z.string().min(1).max(64).optional(),
  secondary_category_ids: z.array(z.string().max(64)).max(10).optional(),
  tag_ids: z.array(z.string().max(64)).max(30).optional(),
  new_tags: z.array(z.string().min(1).max(100)).max(10).optional(),
  dossier_id: z.string().max(64).nullable().optional(),
  geo_zone_ids: z.array(z.string().max(64)).max(20).optional(),
  format: z.enum(ARTICLE_FORMATS).optional(),
  entity_ids: z.array(z.string().max(64)).max(30).optional(),
});

// ─── Panneau Signature ─────────────────────────────────────────────────
export const signaturePanelSchema = z.object({
  authors: z
    .array(
      z.object({
        user_id: z.string().max(64),
        role: z.enum(["author", "coauthor", "photographer", "translator", "editor"]),
      })
    )
    .max(10)
    .optional(),
  source_agency: z.string().max(200).nullable().optional(),
  dateline: z.string().max(200).nullable().optional(),
});

// ─── Panneau Médias ────────────────────────────────────────────────────
export const mediaPanelSchema = z.object({
  cover_media_id: z.string().max(64).nullable().optional(),
  cover_alt: z.string().max(1000).optional(),
  cover_caption: z.string().max(1000).optional(),
  cover_credit: z.string().max(300).optional(),
  social_image_id: z.string().max(64).nullable().optional(),
});

// ─── Panneau SEO ───────────────────────────────────────────────────────
export const seoPanelSchema = z.object({
  slug: z
    .string()
    .max(220)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug invalide (minuscules et tirets).")
    .optional(),
  meta_title: z.string().max(200).nullable().optional(),
  meta_description: z.string().max(400).nullable().optional(),
  canonical_url: z.string().url().max(2000).nullable().optional(),
  robots_directives: z.string().max(100).optional(),
  focus_keyword: z.string().max(200).nullable().optional(),
});

// ─── Panneau Relecture ─────────────────────────────────────────────────
export const sourcesSchema = z
  .array(z.object({ label: z.string().min(1).max(300), url: z.string().max(2000) }))
  .max(20);

export const reviewPanelSchema = z.object({
  sources: sourcesSchema.optional(),
  correction_note: z.string().max(5000).nullable().optional(),
});

// ─── Charge utile de mise à jour (tous les panneaux + zone centrale) ───
export const articleUpdateSchema = z.object({
  kicker: z.string().max(200).nullable().optional(),
  title: z.string().max(400).optional(),
  short_title: z.string().max(200).nullable().optional(),
  seo_title: z.string().max(200).nullable().optional(),
  lede: z.string().max(2000).nullable().optional(),
  body: blocksSchema.optional(),
  publication: publicationPanelSchema.optional(),
  classification: classificationPanelSchema.optional(),
  signature: signaturePanelSchema.optional(),
  media: mediaPanelSchema.optional(),
  seo: seoPanelSchema.optional(),
  review: reviewPanelSchema.optional(),
  change_note: z.string().max(500).optional(),
});

export type ArticleUpdateInput = z.infer<typeof articleUpdateSchema>;

// ─── Création ──────────────────────────────────────────────────────────
export const articleCreateSchema = z.object({
  title: z.string().min(1).max(400),
  category_id: z.string().min(1).max(64),
  kicker: z.string().max(200).nullable().optional(),
  lede: z.string().max(2000).nullable().optional(),
  format: z.enum(ARTICLE_FORMATS).optional(),
  body: blocksSchema.optional(),
});

export type ArticleCreateInput = z.infer<typeof articleCreateSchema>;

// ─── Transitions de workflow (§11.2) ───────────────────────────────────
export const TRANSITIONS = [
  "submit", // draft → in_review
  "request_changes", // in_review/approved → changes_requested
  "approve", // in_review → approved
  "publish", // (draft|in_review|approved|scheduled|unpublished) → published
  "schedule", // → scheduled (scheduled_at future obligatoire)
  "unpublish", // published → unpublished
  "archive", // → archived
  "restore_draft", // (changes_requested|unpublished) → draft
] as const;

export const transitionSchema = z.object({
  action: z.enum(TRANSITIONS),
  scheduled_at: z.string().datetime({ offset: true }).optional(),
  note: z.string().max(2000).optional(),
});

// ─── Verrou d'édition (§11.1 heartbeat) ────────────────────────────────
export const lockActionSchema = z.object({
  action: z.enum(["acquire", "heartbeat"]),
});

// ─── Commentaires de relecture ─────────────────────────────────────────
export const reviewCommentSchema = z.object({
  block_id: z.string().max(32).nullable().optional(),
  text: z.string().min(1).max(2000),
});

// ─── Liste : filtres §11.2 ─────────────────────────────────────────────
export const articleListQuerySchema = z.object({
  q: z.string().max(200).optional(),
  status: z.enum(ARTICLE_STATUSES).optional(),
  category_id: z.string().max(64).optional(),
  author_id: z.string().max(64).optional(),
  format: z.enum(ARTICLE_FORMATS).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  seo_max: z.coerce.number().int().min(0).max(100).optional(),
  no_image: z.coerce.boolean().optional(),
  no_keyword: z.coerce.boolean().optional(),
  trash: z.coerce.boolean().optional(),
  sort: z.enum(["updated_at", "published_at", "title", "view_count", "seo_score"]).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
  per_page: z.coerce.number().int().min(5).max(100).optional(),
});

export type ArticleListQuery = z.infer<typeof articleListQuerySchema>;

// ─── Actions groupées §11.2 ────────────────────────────────────────────
export const bulkActionSchema = z.object({
  ids: z.array(z.string().min(1).max(64)).min(1).max(100),
  action: z.enum(["move_category", "add_tag", "schedule", "archive", "trash", "restore"]),
  category_id: z.string().max(64).optional(),
  tag_id: z.string().max(64).optional(),
  scheduled_at: z.string().datetime({ offset: true }).optional(),
});
