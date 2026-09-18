import { z } from "zod";

/** Taxonomies (§11.2 /admin/taxonomies) : rubriques, tags, dossiers, zones, entités. */

export const categoryCreateSchema = z.object({
  parent_id: z.string().max(64).nullable().optional(),
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug invalide.")
    .optional(),
  short_name: z.string().max(60).nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  intro_html: z.string().max(20_000).nullable().optional(),
  color_accent: z.string().max(20).nullable().optional(),
  icon: z.string().max(60).nullable().optional(),
  is_visible: z.boolean().optional(),
  show_in_nav: z.boolean().optional(),
});

export const categoryUpdateSchema = categoryCreateSchema.partial().extend({
  seo: z.record(z.string(), z.unknown()).optional(),
});

/** Réordonnancement de l'arbre (glisser-déposer) : liste plate ordonnée. */
export const categoryReorderSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().max(64),
        parent_id: z.string().max(64).nullable(),
        position: z.number().int().min(0).max(1000),
      })
    )
    .min(1)
    .max(300),
});

export const categoryDeleteSchema = z.object({
  /** Cible de réaffectation obligatoire si la rubrique contient des articles (§11.2). */
  reassign_to: z.string().max(64).optional(),
});

export const tagCreateSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  description: z.string().max(1000).nullable().optional(),
  synonyms: z.array(z.string().max(120)).max(50).optional(),
  is_featured: z.boolean().optional(),
});

export const tagUpdateSchema = tagCreateSchema.partial();

export const tagMergeSchema = z.object({
  /** Tag absorbé (supprimé) → conservé dans le tag cible. Réversible 30 j (§11.2). */
  source_id: z.string().max(64),
  target_id: z.string().max(64),
});

export const simpleTaxonomyCreateSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  description: z.string().max(2000).nullable().optional(),
});

export const simpleTaxonomyUpdateSchema = simpleTaxonomyCreateSchema.partial();

export const geoZoneCreateSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  type: z.enum(["continent", "region", "country", "city"]),
  parent_id: z.string().max(64).nullable().optional(),
  iso_code: z.string().max(10).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
});

export const geoZoneUpdateSchema = geoZoneCreateSchema.partial();

export const dossierSaveSchema = z.object({
  title: z.string().min(1).max(300),
  slug: z
    .string()
    .max(220)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  lede: z.string().max(1000).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  cover_media_id: z.string().max(64).nullable().optional(),
  is_active: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  started_at: z.string().datetime({ offset: true }).nullable().optional(),
  ended_at: z.string().datetime({ offset: true }).nullable().optional(),
});

export const entitySaveSchema = z.object({
  name: z.string().min(1).max(300),
  slug: z
    .string()
    .max(300)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  type: z.string().max(60),
  description: z.string().max(3000).nullable().optional(),
});
