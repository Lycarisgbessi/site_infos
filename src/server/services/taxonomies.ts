import { db } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ValidationError } from "@/lib/api/respond";
import { slugify, ensureUniqueSlug } from "@/lib/utils/slug";
import { parseJsonArray, stringifyJsonArray, stringifyJsonObject } from "@/lib/json";
import { invalidateTags, CACHE_TAGS, categoryTag } from "@/lib/cache";
import type {
  categoryCreateSchema,
  categoryReorderSchema,
  categoryUpdateSchema,
  tagCreateSchema,
  tagMergeSchema,
  tagUpdateSchema,
  dossierSaveSchema,
  entitySaveSchema,
  geoZoneCreateSchema,
  simpleTaxonomyCreateSchema,
  simpleTaxonomyUpdateSchema,
} from "@/schemas/taxonomy";
import type { z } from "zod";

/**
 * Service taxonomies (§11.2 /admin/taxonomies) :
 * - arbre de rubriques réordonnable (3 niveaux) ;
 * - renommage → redirection 301 automatique dans `redirects` (§11.2 règle 1) ;
 * - suppression bloquée tant qu'aucune cible de réaffectation n'est choisie
 *   (§11.2 règle 2, critère d'acceptation Phase 2) ;
 * - fusion de mots-clés journalisée et réversible 30 jours (§11.2 règle 3).
 */

const MERGE_REVERSIBILITY_DAYS = 30;

// ─── Rubriques ─────────────────────────────────────────────────────────

export async function listCategoryTree() {
  const rows = await db.category.findMany({
    where: { deleted_at: null },
    orderBy: [{ parent_id: "asc" }, { position: "asc" }],
    include: { coverMedia: { select: { id: true, url: true } }, _count: { select: { articles: true } } },
  });
  return rows.map((c) => ({
    id: c.id,
    parent_id: c.parent_id,
    name: c.name,
    slug: c.slug,
    short_name: c.short_name,
    description: c.description,
    intro_html: c.intro_html,
    color_accent: c.color_accent,
    icon: c.icon,
    position: c.position,
    depth: c.depth,
    is_visible: c.is_visible,
    show_in_nav: c.show_in_nav,
    article_count: c.article_count,
    live_article_count: c._count.articles,
    cover: c.coverMedia,
  }));
}

export async function createCategory(input: z.infer<typeof categoryCreateSchema>, userId: string) {
  const base = slugify(input.slug ?? input.name);
  const slug = await ensureUniqueSlug(base, async (s) => {
    const found = await db.category.findFirst({ where: { slug: s, deleted_at: null }, select: { id: true } });
    return found !== null;
  });

  let depth = 0;
  if (input.parent_id) {
    const parent = await db.category.findFirst({ where: { id: input.parent_id, deleted_at: null } });
    if (!parent) throw new ValidationError("Rubrique parente introuvable.");
    depth = parent.depth + 1;
    if (depth > 2) throw new ValidationError("L'arbre de rubriques est limité à 3 niveaux.");
  }

  const maxPos = await db.category.findFirst({
    where: { parent_id: input.parent_id ?? null, deleted_at: null },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const category = await db.category.create({
    data: {
      parent_id: input.parent_id ?? null,
      name: input.name,
      slug,
      short_name: input.short_name ?? null,
      description: input.description ?? null,
      intro_html: input.intro_html ?? null,
      color_accent: input.color_accent ?? null,
      icon: input.icon ?? null,
      is_visible: input.is_visible ?? true,
      show_in_nav: input.show_in_nav ?? true,
      depth,
      position: (maxPos?.position ?? -1) + 1,
    },
  });

  await auditLog({ action: "taxonomy.category_create", resourceType: "category", resourceId: category.id, userId, after: { name: category.name, slug: category.slug } });
  invalidateTags([CACHE_TAGS.menus, categoryTag(category.id)]);
  return category;
}

export async function updateCategory(
  id: string,
  input: z.infer<typeof categoryUpdateSchema>,
  userId: string
) {
  const current = await db.category.findFirst({ where: { id, deleted_at: null } });
  if (!current) throw new ValidationError("Rubrique introuvable.");

  const data: Record<string, unknown> = {};
  let slugChanged = false;

  if (input.name !== undefined) data.name = input.name;
  if (input.slug !== undefined && input.slug !== current.slug) {
    const newSlug = await ensureUniqueSlug(input.slug, async (s) => {
      const found = await db.category.findFirst({
        where: { slug: s, deleted_at: null, parent_id: current.parent_id, id: { not: current.id } },
        select: { id: true },
      });
      return found !== null;
    });
    data.slug = newSlug;
    slugChanged = true;
  }
  if (input.short_name !== undefined) data.short_name = input.short_name;
  if (input.description !== undefined) data.description = input.description;
  if (input.intro_html !== undefined) data.intro_html = input.intro_html;
  if (input.color_accent !== undefined) data.color_accent = input.color_accent;
  if (input.icon !== undefined) data.icon = input.icon;
  if (input.is_visible !== undefined) data.is_visible = input.is_visible;
  if (input.show_in_nav !== undefined) data.show_in_nav = input.show_in_nav;
  if (input.seo !== undefined) data.seo = stringifyJsonObject(input.seo);

  await db.category.update({ where: { id }, data });

  // ── Redirection 301 automatique au renommage (§11.2, critère d'acceptation)
  if (slugChanged) {
    const oldPath = `/${current.slug}`;
    const newPath = `/${data.slug as string}`;
    if (oldPath === newPath) {
      // Retour au slug d'origine (A→B→A) : toute redirection serait
      // auto-bouclante — on purge au lieu d'upsert.
      await db.redirect.deleteMany({ where: { source_path: oldPath } });
    } else {
      // Redirection réciproque (A→B issue d'un renommage précédent) :
      // redondante après retour au slug d'origine — supprimée au lieu de
      // créer une boucle A→A via l'anti-chaîne.
      await db.redirect.deleteMany({ where: { source_path: newPath, target_path: oldPath } });
      await db.redirect.upsert({
        where: { source_path: oldPath },
        create: { source_path: oldPath, target_path: newPath, status_code: 301, is_auto: true },
        update: { target_path: newPath, status_code: 301, is_auto: true },
      });
      // Anti-chaîne : les redirections pointant vers l'ancien chemin suivent
      await db.redirect.updateMany({
        where: { target_path: oldPath, source_path: { not: oldPath } },
        data: { target_path: newPath },
      });
    }
  }

  await auditLog({
    action: "taxonomy.category_update",
    resourceType: "category",
    resourceId: id,
    userId,
    before: { name: current.name, slug: current.slug },
    after: data,
  });
  invalidateTags([CACHE_TAGS.menus, categoryTag(current.id)]);
  return { ok: true, redirect_created: slugChanged };
}

export async function reorderCategories(
  input: z.infer<typeof categoryReorderSchema>,
  userId: string
) {
  // Vérifie la profondeur : parent/descendant incohérents refusés
  const all = await db.category.findMany({ where: { deleted_at: null }, select: { id: true, parent_id: true, depth: true } });
  const byId = new Map(all.map((c) => [c.id, c]));
  for (const item of input.items) {
    const row = byId.get(item.id);
    if (!row) throw new ValidationError(`Rubrique inconnue : ${item.id}`);
    if (item.parent_id) {
      const parent = byId.get(item.parent_id);
      if (!parent) throw new ValidationError("Parent inconnu.");
      if (parent.id === item.id) throw new ValidationError("Une rubrique ne peut pas être son propre parent.");
      // Refuse si le parent est un descendant de la rubrique (cycle)
      let cursor: string | null = parent.parent_id;
      let guard = 0;
      while (cursor && guard < 5) {
        if (cursor === item.id) throw new ValidationError("Cycle détecté dans l'arbre.");
        cursor = byId.get(cursor)?.parent_id ?? null;
        guard += 1;
      }
    }
  }

  await db.$transaction(
    input.items.map((item) =>
      db.category.update({
        where: { id: item.id },
        data: {
          parent_id: item.parent_id,
          position: item.position,
          depth: item.parent_id ? (byId.get(item.parent_id)?.depth ?? 0) + 1 : 0,
        },
      })
    )
  );

  await auditLog({ action: "taxonomy.category_reorder", resourceType: "category", userId, after: input.items });
  invalidateTags([CACHE_TAGS.menus]);
  return { ok: true };
}

/**
 * Suppression d'une rubrique — BLOQUÉE tant qu'une cible de réaffectation
 * n'est pas choisie si des articles y sont rattachés (§11.2 règle 2).
 */
export async function deleteCategory(
  id: string,
  userId: string,
  opts: { reassign_to?: string } = {}
): Promise<{ ok: true; moved: number }> {
  const current = await db.category.findFirst({
    where: { id, deleted_at: null },
    include: { _count: { select: { articles: true, children: true } } },
  });
  if (!current) throw new ValidationError("Rubrique introuvable.");
  if (current._count.children > 0) {
    throw new ValidationError(
      `Suppression impossible : ${current._count.children} sous-rubrique(s) à déplacer d'abord.`
    );
  }

  const articleCount = current._count.articles;
  if (articleCount > 0 && !opts.reassign_to) {
    throw new ValidationError(
      `Suppression bloquée : ${articleCount} article(s) rattaché(s). Choisissez une rubrique de réaffectation.`
    );
  }
  if (opts.reassign_to) {
    const target = await db.category.findFirst({ where: { id: opts.reassign_to, deleted_at: null } });
    if (!target) throw new ValidationError("Rubrique cible introuvable.");
    if (target.id === id) throw new ValidationError("La cible doit être différente de la rubrique supprimée.");
  }

  const moved = await db.$transaction(async (tx) => {
    if (opts.reassign_to && articleCount > 0) {
      const res = await tx.article.updateMany({
        where: { category_id: id, deleted_at: null },
        data: { category_id: opts.reassign_to },
      });
      await tx.articleCategory.updateMany({
        where: { category_id: id },
        data: { category_id: opts.reassign_to },
      });
      // article_count dénormalisé (couche service en dev, D-01)
      await tx.category.update({
        where: { id: opts.reassign_to },
        data: { article_count: { increment: res.count } },
      });
      return res.count;
    }
    return 0;
  });

  await db.category.update({ where: { id }, data: { deleted_at: new Date() } });

  // L'ancienne URL renvoie vers la cible choisie (ou la racine si vide)
  if (opts.reassign_to) {
    const target = await db.category.findUnique({ where: { id: opts.reassign_to }, select: { slug: true } });
    if (target) {
      await db.redirect.upsert({
        where: { source_path: `/${current.slug}` },
        create: { source_path: `/${current.slug}`, target_path: `/${target.slug}`, status_code: 301, is_auto: true },
        update: { target_path: `/${target.slug}`, status_code: 301, is_auto: true },
      });
    }
  }

  await auditLog({
    action: "taxonomy.category_delete",
    resourceType: "category",
    resourceId: id,
    userId,
    before: { name: current.name, slug: current.slug, article_count: articleCount },
    after: { reassigned_to: opts.reassign_to ?? null, moved },
  });
  invalidateTags([CACHE_TAGS.menus, categoryTag(id)]);
  return { ok: true, moved };
}

// ─── Mots-clés (fusion réversible 30 j — §11.2 règle 3) ────────────────

export async function listTags() {
  return db.tag.findMany({
    where: { deleted_at: null },
    orderBy: { usage_count: "desc" },
    take: 500,
  });
}

export async function createTag(input: z.infer<typeof tagCreateSchema>, userId: string) {
  const slug = await ensureUniqueSlug(slugify(input.slug ?? input.name), async (s) => {
    const found = await db.tag.findFirst({ where: { slug: s, deleted_at: null }, select: { id: true } });
    return found !== null;
  });
  const tag = await db.tag.create({
    data: {
      name: input.name,
      slug,
      description: input.description ?? null,
      synonyms: stringifyJsonArray(input.synonyms ?? []),
      is_featured: input.is_featured ?? false,
    },
  });
  await auditLog({ action: "taxonomy.tag_create", resourceType: "tag", resourceId: tag.id, userId, after: { name: tag.name } });
  return tag;
}

export async function updateTag(id: string, input: z.infer<typeof tagUpdateSchema>, userId: string) {
  const current = await db.tag.findFirst({ where: { id, deleted_at: null } });
  if (!current) throw new ValidationError("Mot-clé introuvable.");

  const data: Record<string, unknown> = {};
  let slugChanged = false;
  if (input.name !== undefined) data.name = input.name;
  if (input.slug !== undefined && input.slug !== current.slug) {
    data.slug = await ensureUniqueSlug(input.slug, async (s) => {
      const found = await db.tag.findFirst({ where: { slug: s, deleted_at: null, id: { not: id } }, select: { id: true } });
      return found !== null;
    });
    slugChanged = true;
  }
  if (input.description !== undefined) data.description = input.description;
  if (input.synonyms !== undefined) data.synonyms = stringifyJsonArray(input.synonyms);
  if (input.is_featured !== undefined) data.is_featured = input.is_featured;

  await db.tag.update({ where: { id }, data });

  if (slugChanged) {
    // Garde anti-boucle : une redirection réciproque (A→B issue d'un
    // renommage précédent) est supprimée avant l'upsert inverse.
    await db.redirect.deleteMany({
      where: { source_path: `/tags/${data.slug as string}`, target_path: `/tags/${current.slug}` },
    });
    await db.redirect.upsert({
      where: { source_path: `/tags/${current.slug}` },
      create: { source_path: `/tags/${current.slug}`, target_path: `/tags/${data.slug as string}`, status_code: 301, is_auto: true },
      update: { target_path: `/tags/${data.slug as string}`, status_code: 301, is_auto: true },
    });
  }

  await auditLog({
    action: "taxonomy.tag_update",
    resourceType: "tag",
    resourceId: id,
    userId,
    before: { name: current.name, slug: current.slug },
    after: data,
  });
  return { ok: true };
}

/**
 * Fusion : les liens article↔tag du tag source sont réattribués au tag
 * cible, le tag source est archivé (soft delete) avec un instantané
 * complet dans l'audit — la fusion est réversible pendant 30 jours.
 */
export async function mergeTags(input: z.infer<typeof tagMergeSchema>, userId: string) {
  if (input.source_id === input.target_id) throw new ValidationError("Les deux mots-clés doivent être différents.");
  const [source, target] = await Promise.all([
    db.tag.findFirst({ where: { id: input.source_id, deleted_at: null } }),
    db.tag.findFirst({ where: { id: input.target_id, deleted_at: null } }),
  ]);
  if (!source || !target) throw new ValidationError("Mot-clé introuvable.");

  const links = await db.articleTag.findMany({ where: { tag_id: source.id } });
  const snapshot = {
    tag: { id: source.id, name: source.name, slug: source.slug, synonyms: parseJsonArray(source.synonyms) },
    links: links.map((l) => ({ article_id: l.article_id, position: l.position })),
    merged_at: new Date().toISOString(),
  };

  await db.$transaction(async (tx) => {
    for (const link of links) {
      const exists = await tx.articleTag.findUnique({
        where: { article_id_tag_id: { article_id: link.article_id, tag_id: target.id } },
      });
      if (!exists) {
        await tx.articleTag.create({
          data: { article_id: link.article_id, tag_id: target.id, position: link.position },
        });
      }
    }
    await tx.articleTag.deleteMany({ where: { tag_id: source.id } });
    await tx.tag.update({
      where: { id: source.id },
      data: {
        deleted_at: new Date(),
        description: `Fusionné dans « ${target.name} » le ${new Date().toISOString().slice(0, 10)} (réversible 30 j).`,
      },
    });
    await tx.tag.update({
      where: { id: target.id },
      data: { usage_count: { increment: links.length } },
    });
  });

  await auditLog({
    action: "taxonomy.tag_merge",
    resourceType: "tag",
    resourceId: target.id,
    userId,
    before: snapshot, // instantané complet → base de la réversibilité
    after: { source: source.name, target: target.name, links: links.length },
  });
  // auditLog ne renvoie pas l'id : relit la dernière entrée correspondante
  const entry = await db.auditLog.findFirst({
    where: { action: "taxonomy.tag_merge", resource_type: "tag", resource_id: target.id },
    orderBy: { id: "desc" },
    select: { id: true },
  });

  return { ok: true, moved_links: links.length, audit_id: entry?.id ?? null, reversible_until: new Date(Date.now() + MERGE_REVERSIBILITY_DAYS * 24 * 3600 * 1000).toISOString() };
}

/** Annule une fusion de moins de 30 jours (relit l'instantané d'audit). */
export async function unmergeLastTag(mergerId: number, userId: string) {
  const entry = await db.auditLog.findUnique({ where: { id: mergerId } });
  if (!entry || entry.action !== "taxonomy.tag_merge" || !entry.before) {
    throw new ValidationError("Entrée de fusion introuvable.");
  }
  const ageDays = (Date.now() - entry.created_at.getTime()) / 86_400_000;
  if (ageDays > MERGE_REVERSIBILITY_DAYS) {
    throw new ValidationError("La réversibilité de 30 jours est dépassée.");
  }
  const snapshot = JSON.parse(entry.before) as {
    tag: { id: string; name: string; slug: string; synonyms: string[] };
    links: { article_id: string; position: number }[];
  };
  await db.$transaction(async (tx) => {
    await tx.tag.update({ where: { id: snapshot.tag.id }, data: { deleted_at: null, description: null } });
    await tx.articleTag.deleteMany({ where: { tag_id: snapshot.tag.id } });
    if (snapshot.links.length > 0) {
      await tx.articleTag.createMany({ data: snapshot.links.map((l) => ({ article_id: l.article_id, tag_id: snapshot.tag.id, position: l.position })) });
    }
  });
  await auditLog({ action: "taxonomy.tag_unmerge", resourceType: "tag", resourceId: snapshot.tag.id, userId, after: { merged_audit_id: mergerId } });
  return { ok: true };
}

export async function deleteTag(id: string, userId: string) {
  const current = await db.tag.findFirst({ where: { id, deleted_at: null } });
  if (!current) throw new ValidationError("Mot-clé introuvable.");
  await db.$transaction([
    db.articleTag.deleteMany({ where: { tag_id: id } }),
    db.tag.update({ where: { id }, data: { deleted_at: new Date() } }),
  ]);
  await auditLog({ action: "taxonomy.tag_delete", resourceType: "tag", resourceId: id, userId, before: { name: current.name } });
  return { ok: true };
}

// ─── Dossiers / Zones géo / Entités ────────────────────────────────────

export async function listDossiers() {
  return db.dossier.findMany({ where: { deleted_at: null }, orderBy: { created_at: "desc" }, include: { coverMedia: { select: { id: true, url: true } }, _count: { select: { articles: true } } } });
}

export async function saveDossier(
  input: z.infer<typeof dossierSaveSchema> & { id?: string },
  userId: string
) {
  const data: Record<string, unknown> = {
    title: input.title,
    lede: input.lede ?? null,
    description: input.description ?? null,
    cover_media_id: input.cover_media_id ?? null,
    is_active: input.is_active ?? true,
    is_featured: input.is_featured ?? false,
    started_at: input.started_at ? new Date(input.started_at) : null,
    ended_at: input.ended_at ? new Date(input.ended_at) : null,
  };
  if (input.id) {
    const current = await db.dossier.findFirst({ where: { id: input.id, deleted_at: null } });
    if (!current) throw new ValidationError("Dossier introuvable.");
    if (input.slug !== undefined && input.slug !== current.slug) {
      // Garde anti-boucle (renommage A→B→A) : voir updateCategory.
      await db.redirect.deleteMany({
        where: { source_path: `/dossiers/${input.slug}`, target_path: `/dossiers/${current.slug}` },
      });
      await db.redirect.upsert({
        where: { source_path: `/dossiers/${current.slug}` },
        create: { source_path: `/dossiers/${current.slug}`, target_path: `/dossiers/${input.slug}`, status_code: 301, is_auto: true },
        update: { target_path: `/dossiers/${input.slug}`, status_code: 301, is_auto: true },
      });
      data.slug = input.slug;
    }
    await db.dossier.update({ where: { id: input.id }, data });
    await auditLog({ action: "dossier.update", resourceType: "dossier", resourceId: input.id, userId });
    return { ok: true, id: input.id };
  }
  const slug = await ensureUniqueSlug(slugify(input.slug ?? input.title), async (s) => {
    const found = await db.dossier.findFirst({ where: { slug: s, deleted_at: null }, select: { id: true } });
    return found !== null;
  });
  const dossier = await db.dossier.create({
    data: {
      slug,
      title: String(data.title),
      lede: (data.lede as string | null) ?? null,
      description: (data.description as string | null) ?? null,
      cover_media_id: (data.cover_media_id as string | null) ?? null,
      is_active: (data.is_active as boolean) ?? true,
      is_featured: (data.is_featured as boolean) ?? false,
      started_at: (data.started_at as Date | null) ?? null,
      ended_at: (data.ended_at as Date | null) ?? null,
    },
  });
  await auditLog({ action: "dossier.create", resourceType: "dossier", resourceId: dossier.id, userId });
  return { ok: true, id: dossier.id };
}

export async function listGeoZones() {
  return db.geoZone.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] });
}

export async function createGeoZone(input: z.infer<typeof geoZoneCreateSchema>, userId: string) {
  const slug = await ensureUniqueSlug(slugify(input.slug ?? input.name), async (s) => {
    const found = await db.geoZone.findFirst({ where: { slug: s }, select: { id: true } });
    return found !== null;
  });
  const zone = await db.geoZone.create({
    data: {
      name: input.name,
      slug,
      type: input.type,
      parent_id: input.parent_id ?? null,
      iso_code: input.iso_code ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    },
  });
  await auditLog({ action: "taxonomy.geo_create", resourceType: "geo_zone", resourceId: zone.id, userId });
  return zone;
}

export async function updateGeoZone(id: string, input: z.infer<typeof geoZoneCreateSchema>, userId: string) {
  const current = await db.geoZone.findUnique({ where: { id } });
  if (!current) throw new ValidationError("Zone introuvable.");
  const data: Record<string, unknown> = { name: input.name, type: input.type };
  if (input.slug !== undefined && input.slug !== current.slug) {
    data.slug = input.slug;
    // Garde anti-boucle (renommage A→B→A) : voir updateCategory.
    await db.redirect.deleteMany({
      where: { source_path: `/monde/${input.slug}`, target_path: `/monde/${current.slug}` },
    });
    await db.redirect.upsert({
      where: { source_path: `/monde/${current.slug}` },
      create: { source_path: `/monde/${current.slug}`, target_path: `/monde/${input.slug}`, status_code: 301, is_auto: true },
      update: { target_path: `/monde/${input.slug}`, status_code: 301, is_auto: true },
    });
  }
  await db.geoZone.update({ where: { id }, data });
  await auditLog({ action: "taxonomy.geo_update", resourceType: "geo_zone", resourceId: id, userId });
  return { ok: true };
}

export async function listEntities() {
  return db.entity.findMany({ orderBy: { name: "asc" }, take: 500 });
}

export async function createEntity(input: z.infer<typeof entitySaveSchema>, userId: string) {
  const allowedTypes = ["person", "organization", "place"];
  if (!allowedTypes.includes(input.type)) {
    throw new ValidationError(`Type d'entité invalide (${allowedTypes.join(", ")}).`);
  }
  const slug = await ensureUniqueSlug(slugify(input.slug ?? input.name), async (s) => {
    const found = await db.entity.findFirst({ where: { slug: s }, select: { id: true } });
    return found !== null;
  });
  const entity = await db.entity.create({
    data: {
      name: input.name,
      slug,
      type: input.type as "person" | "organization" | "place",
      description: input.description ?? null,
    },
  });
  await auditLog({ action: "taxonomy.entity_create", resourceType: "entity", resourceId: entity.id, userId });
  return entity;
}

export async function updateEntity(id: string, input: z.infer<typeof simpleTaxonomyUpdateSchema>, userId: string) {
  await db.entity.update({ where: { id }, data: { name: input.name, description: input.description ?? null } });
  await auditLog({ action: "taxonomy.entity_update", resourceType: "entity", resourceId: id, userId });
  return { ok: true };
}
