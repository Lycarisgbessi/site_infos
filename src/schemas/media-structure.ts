import { z } from "zod";

/** Médiathèque (§11.2 /admin/medias) et structures (§11.2 pages, menus, bannières, redirections, composeurs). */

export const mediaMetaUpdateSchema = z.object({
  title: z.string().max(300).nullable().optional(),
  alt_text: z.string().max(1000).nullable().optional(),
  caption: z.string().max(1000).nullable().optional(),
  credit: z.string().max(300).optional(),
  license: z.string().max(200).nullable().optional(),
  shot_at: z.string().datetime({ offset: true }).nullable().optional(),
  location: z.string().max(300).nullable().optional(),
  focal_point: z
    .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
    .optional(),
  crops: z
    .record(
      z.string(),
      z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
    )
    .optional(),
});

export const mediaListQuerySchema = z.object({
  q: z.string().max(200).optional(),
  type: z.enum(["image", "video", "audio", "document"]).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  trash: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(6).max(120).optional(),
});

// ─── Pages (§11.2) ─────────────────────────────────────────────────────
export const pageSaveSchema = z.object({
  title: z.string().min(1).max(300),
  slug: z
    .string()
    .max(220)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  body: z.array(z.unknown()).max(1000).optional(),
  template: z.enum(["default", "contact", "about", "advertising", "legal"]).optional(),
  is_published: z.boolean().optional(),
  seo: z.record(z.string(), z.unknown()).optional(),
});

// ─── Menus (§11.2 drag & drop) ─────────────────────────────────────────
export const menuItemSchema = z.object({
  id: z.string().max(64).optional(), // absent → création
  parent_id: z.string().max(64).nullable(),
  label: z.string().min(1).max(200),
  target_type: z.enum(["category", "page", "dossier", "tag", "url", "home", "section"]),
  target_id: z.string().max(64).nullable().optional(),
  target_url: z.string().max(2000).nullable().optional(),
  icon: z.string().max(60).nullable().optional(),
  open_new_tab: z.boolean().optional(),
  highlight: z.boolean().optional(),
  position: z.number().int().min(0).max(1000),
  is_visible: z.boolean().optional(),
});

export const menuSaveSchema = z.object({
  items: z.array(menuItemSchema).max(300),
});

// ─── Bannières (§11.2) ─────────────────────────────────────────────────
export const bannerSaveSchema = z.object({
  message: z.string().min(1).max(500),
  link_url: z.string().max(2000).nullable().optional(),
  link_label: z.string().max(100).nullable().optional(),
  style: z.enum(["alert", "info", "promo"]).optional(),
  is_dismissible: z.boolean().optional(),
  target_paths: z.array(z.string().max(300)).max(50).optional(),
  starts_at: z.string().datetime({ offset: true }).nullable().optional(),
  ends_at: z.string().datetime({ offset: true }).nullable().optional(),
  is_active: z.boolean().optional(),
});

// ─── Redirections (§11.2) ──────────────────────────────────────────────
export const redirectSaveSchema = z.object({
  source_path: z
    .string()
    .min(1)
    .max(2000)
    .regex(/^\//, "Le chemin source doit commencer par /."),
  target_path: z
    .string()
    .min(1)
    .max(2000)
    .regex(/^\//, "Le chemin cible doit commencer par /."),
  status_code: z.union([z.literal(301), z.literal(302)]).optional(),
});

// ─── Composeur page d'accueil (§11.2 /admin/homepage) ─────────────────
export const homepageBlockUpdateSchema = z.object({
  id: z.string().max(64),
  title: z.string().max(200).nullable().optional(),
  subtitle: z.string().max(300).nullable().optional(),
  variant: z.string().max(60).nullable().optional(),
  source_type: z
    .enum(["category", "dossier", "tag", "manual", "auto", "format"])
    .nullable()
    .optional(),
  source_id: z.string().max(64).nullable().optional(),
  manual_article_ids: z.array(z.string().max(64)).max(30).optional(),
  item_count: z.number().int().min(1).max(20).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  is_active: z.boolean().optional(),
  starts_at: z.string().datetime({ offset: true }).nullable().optional(),
  ends_at: z.string().datetime({ offset: true }).nullable().optional(),
});

export const homepageBlocksSaveSchema = z.object({
  blocks: z.array(homepageBlockUpdateSchema).min(1).max(40),
});

export const homepageLayoutSaveSchema = z.object({
  name: z.string().min(1).max(120),
  restore: z.boolean().optional(),
  layout_id: z.string().max(64).optional(),
});

// ─── Composeur de la une (§11.2 /admin/une) ────────────────────────────
export const featuredSlotInputSchema = z.object({
  zone: z.enum(["home_lead", "home_secondary"]),
  article_id: z.string().max(64),
  position: z.number().int().min(0).max(20),
  pinned: z.boolean().optional(),
  starts_at: z.string().datetime({ offset: true }).nullable().optional(),
  ends_at: z.string().datetime({ offset: true }).nullable().optional(),
  override_title: z.string().max(300).nullable().optional(),
  override_media_id: z.string().max(64).nullable().optional(),
});

export const uneSaveSchema = z.object({
  slots: z.array(featuredSlotInputSchema).max(30),
});

// ─── Textes d'interface (§11.2) ────────────────────────────────────────
export const translationUpdateSchema = z.object({
  key: z.string().min(1).max(200),
  locale: z.string().min(2).max(5),
  value: z.string().max(10_000),
});

export const translationsBulkSchema = z.object({
  translations: z.array(translationUpdateSchema).min(1).max(200),
});
