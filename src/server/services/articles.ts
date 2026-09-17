import { db } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { invalidateOnArticlePublish, invalidateTags, CACHE_TAGS } from "@/lib/cache";
import { ValidationError } from "@/lib/api/respond";
import { PermissionError } from "@/lib/permissions";
import { hasPermission } from "@/lib/permissions";
import type { Permission } from "@/lib/permissions/permissions-list";
import { notifyRoles, notifyUser } from "@/lib/notifications";
import { parseBlocks, type Block } from "@/types/blocks";
import { deriveBodyMetadata } from "@/lib/blocks";
import { slugify, ensureUniqueSlug } from "@/lib/utils/slug";
import { computeSeoScore } from "@/lib/seo/score";
import { diffStats } from "@/lib/diff";
import { parseJsonArray, stringifyJsonArray, stringifyJsonObject } from "@/lib/json";
import type {
  ArticleCreateInput,
  ArticleListQuery,
  ArticleUpdateInput,
} from "@/schemas/article";
import type { AuthenticatedSession } from "@/lib/auth/types";

/**
 * Service articles (§11.2 éditeur, §06.2 articles) — logique métier :
 * CRUD, autosave, verrou d'édition, versions, workflow de statuts avec
 * contrôles bloquants, corbeille 30 j, redirections 301 au changement
 * de slug après publication, notifications de workflow.
 *
 * Les Route Handlers appliquent l'ordre contractuel §07.2 ; ce service
 * encapsule les règles métier et les permissions fines (own vs all,
 * restriction par rubrique, journaliste_can_publish).
 */

const TRASH_RETENTION_DAYS = 30;
const LOCK_TTL_MINUTES = 5;

// ─── Permissions fines ─────────────────────────────────────────────────

function isAdmin(session: AuthenticatedSession): boolean {
  return session.user.roles.some((r) => r.key === "admin");
}

/** Le compte peut-il écrire cet article ? (update.all, ou update.own + auteur) */
async function canEditArticle(
  session: AuthenticatedSession,
  article: { created_by: string | null; category_id: string }
): Promise<boolean> {
  if (await hasPermission(session.user, "article.update.all")) {
    return categoryScopeAllows(session, article.category_id, "article.update.all");
  }
  if (article.created_by !== session.user.id) return false;
  return hasPermission(session.user, "article.update.own", {
    categoryId: article.category_id,
  });
}

/** Applique la restriction par rubrique aux permissions « all ». */
async function categoryScopeAllows(
  session: AuthenticatedSession,
  categoryId: string,
  permission: Permission
): Promise<boolean> {
  return hasPermission(session.user, permission, { categoryId });
}

// ─── Slug ──────────────────────────────────────────────────────────────

async function uniqueArticleSlug(base: string, locale: string, excludeId?: string): Promise<string> {
  return ensureUniqueSlug(base, async (candidate) => {
    const found = await db.article.findFirst({
      where: { locale, slug: candidate, deleted_at: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    return found !== null;
  });
}

// ─── Création ──────────────────────────────────────────────────────────

export async function createArticle(
  session: AuthenticatedSession,
  input: ArticleCreateInput
): Promise<{ id: string; slug: string }> {
  const allowed = await hasPermission(session.user, "article.create", {
    categoryId: input.category_id,
  });
  if (!allowed) throw new PermissionError("Permission requise : article.create.");

  const category = await db.category.findFirst({
    where: { id: input.category_id, deleted_at: null },
    select: { id: true, slug: true },
  });
  if (!category) throw new ValidationError("Rubrique introuvable.");

  const slug = await uniqueArticleSlug(slugify(input.title), "fr");
  const blocks = input.body ?? [];

  const article = await db.article.create({
    data: {
      slug,
      locale: "fr",
      kicker: input.kicker ?? null,
      title: input.title,
      lede: input.lede ?? null,
      body: stringifyJsonArray(blocks),
      ...deriveBodyMetadata(blocks),
      format: input.format ?? "standard",
      status: "draft",
      category_id: input.category_id,
      created_by: session.user.id,
      updated_content_at: new Date(),
    },
  });

  // L'auteur courant est signature « auteur » par défaut
  await db.articleAuthor.create({
    data: { article_id: article.id, user_id: session.user.id, role: "author", position: 0 },
  });

  await auditLog({
    userId: session.user.id,
    action: "article.create",
    resourceType: "article",
    resourceId: article.id,
    after: { title: input.title, category_id: input.category_id },
  });

  return { id: article.id, slug: article.slug };
}

// ─── Lecture pour l'éditeur ────────────────────────────────────────────

export async function getArticleForEdit(session: AuthenticatedSession, id: string) {
  const article = await db.article.findFirst({
    where: { id, deleted_at: null },
    include: {
      category: { select: { id: true, name: true, slug: true, parent_id: true } },
      coverMedia: { select: { id: true, url: true, alt_text: true, credit: true, caption: true, width: true, height: true, focal_point: true } },
      socialImage: { select: { id: true, url: true } },
      authors: { select: { user_id: true, role: true, position: true, user: { select: { display_name: true } } }, orderBy: { position: "asc" } },
      tags: { select: { tag_id: true, position: true, tag: { select: { name: true, slug: true } } }, orderBy: { position: "asc" } },
      secondaryCats: { select: { category_id: true } },
      geoZones: { select: { geo_zone_id: true } },
      entities: { select: { entity_id: true } },
      reviewNotes: { select: { id: true, block_id: true, text: true, resolved: true, created_by: true, created_at: true, createdBy: { select: { display_name: true } } }, orderBy: { created_at: "asc" } },
      lock: { select: { user_id: true, expires_at: true, user: { select: { display_name: true } } } },
    },
  });
  if (!article) throw new ValidationError("Article introuvable.");

  const canReadAll = await hasPermission(session.user, "article.read.all");
  if (!canReadAll && article.created_by !== session.user.id) {
    throw new PermissionError("Permission requise : article.read.all.");
  }

  const editable = await canEditArticle(session, article);
  const canPublish = await hasPermission(session.user, "article.publish", {
    categoryId: article.category_id,
  });
  const canDelete = await hasPermission(session.user, "article.delete");
  const canSchedule = await hasPermission(session.user, "article.schedule");

  return { article, rights: { editable, canPublish, canDelete, canSchedule, isOwner: article.created_by === session.user.id } };
}

// ─── Contrôles bloquants et avertissements (§11.2) ─────────────────────

export interface PublicationChecks {
  blocking: { id: string; message: string }[];
  warnings: { id: string; message: string }[];
}

export async function computePublicationChecks(
  article: {
    title: string;
    lede: string | null;
    body: string;
    category_id: string;
    cover_media_id: string | null;
    is_sponsored: boolean;
    sponsor_name: string | null;
    format: string;
    focus_keyword: string | null;
    slug: string;
    word_count: number;
  },
  opts: { coverAlt: string; coverCredit: string; tagsCount: number }
): Promise<PublicationChecks> {
  const blocking: PublicationChecks["blocking"] = [];
  const warnings: PublicationChecks["warnings"] = [];

  if (!article.title.trim()) {
    blocking.push({ id: "title", message: "Le titre est obligatoire." });
  }
  if (!article.category_id) {
    blocking.push({ id: "category", message: "La rubrique est obligatoire." });
  }
  const ledeLen = (article.lede ?? "").trim().length;
  if (ledeLen < 80) {
    blocking.push({
      id: "lede",
      message: `Le chapô doit compter au moins 80 caractères (${ledeLen}).`,
    });
  }
  if (!article.cover_media_id) {
    blocking.push({ id: "cover", message: "L'image principale est obligatoire." });
  } else {
    if (opts.coverAlt.trim().length === 0) {
      blocking.push({ id: "cover_alt", message: "Le texte alternatif de l'image principale est obligatoire." });
    }
    if (opts.coverCredit.trim().length === 0) {
      blocking.push({ id: "cover_credit", message: "Le crédit de l'image principale est obligatoire." });
    }
  }
  if (opts.tagsCount < 1) {
    blocking.push({ id: "tags", message: "Au moins un mot-clé est obligatoire." });
  }
  if (article.is_sponsored && !article.sponsor_name?.trim()) {
    blocking.push({ id: "sponsor", message: "Le nom du sponsor est obligatoire pour un article sponsorisé." });
  }

  // Liens internes cassés : blocs readmore pointant vers des articles inexistants
  const blocks = parseBlocks(article.body) as Block[];
  const readmoreIds = blocks.filter((b) => b.type === "readmore").flatMap((b) => b.articleIds);
  if (readmoreIds.length > 0) {
    const found = await db.article.findMany({
      where: { id: { in: readmoreIds }, deleted_at: null },
      select: { id: true },
    });
    const missing = readmoreIds.filter((rid) => !found.some((f) => f.id === rid));
    if (missing.length > 0) {
      blocking.push({ id: "broken_links", message: `${missing.length} lien(s) interne(s) cassé(s) (bloc « à lire aussi »).` });
    }
  }
  const internalLinkCount = readmoreIds.length +
    blocks.filter((b) => b.type === "paragraph").reduce((acc, b) => acc + (b.type === "paragraph" ? b.text.filter((f) => f.link && !f.link.external).length : 0), 0);

  // Avertissements non bloquants (§11.2)
  const seo = computeSeoScore({
    title: article.title,
    lede: article.lede ?? "",
    slug: article.slug,
    metaTitle: article.title,
    metaDescription: "",
    focusKeyword: article.focus_keyword ?? "",
    plainText: deriveBodyMetadata(blocks).plain_text,
    wordCount: article.word_count,
    internalLinkCount,
    hasCoverImage: Boolean(article.cover_media_id),
    coverAlt: opts.coverAlt,
    coverCredit: opts.coverCredit,
    tagsCount: opts.tagsCount,
  });
  if (seo.score < 60) {
    warnings.push({ id: "seo_score", message: `Score SEO faible (${seo.score}/100).` });
  }
  if (internalLinkCount === 0) {
    warnings.push({ id: "no_internal", message: "Aucun lien interne détecté." });
  }
  if (article.format !== "brief" && article.word_count < 200) {
    warnings.push({ id: "short", message: `Corps court (${article.word_count} mots) pour un format « ${article.format} ».` });
  }

  // Titre dupliqué (avertissement)
  const duplicate = await db.article.findFirst({
    where: { title: { equals: article.title.trim() }, deleted_at: null, status: { not: "draft" } },
    select: { id: true },
  });
  if (duplicate) {
    warnings.push({ id: "duplicate_title", message: "Un article publié porte déjà ce titre." });
  }

  return { blocking, warnings };
}

// ─── Mise à jour (panneaux + zone centrale) ────────────────────────────

interface UpdateDeps {
  coverAlt: string;
  coverCredit: string;
  coverCaption: string;
  tagsCount: number;
}

export async function updateArticle(
  session: AuthenticatedSession,
  id: string,
  input: ArticleUpdateInput,
  opts: { autosave?: boolean } = {}
): Promise<{ ok: true; slug: string; status: string }> {
  const current = await db.article.findFirst({
    where: { id, deleted_at: null },
    include: {
      coverMedia: { select: { alt_text: true, credit: true, caption: true } },
      tags: { select: { tag_id: true } },
      lock: true,
    },
  });
  if (!current) throw new ValidationError("Article introuvable.");

  const editable = await canEditArticle(session, current);
  if (!editable) {
    throw new PermissionError("Vous n'avez pas le droit de modifier cet article.");
  }

  // Verrou d'édition (§11.1) — seul le détenteur (ou admin override) écrit
  const activeLock =
    current.lock && current.lock.expires_at > new Date() ? current.lock : null;
  if (activeLock && activeLock.user_id !== session.user.id && !isAdmin(session)) {
    throw new ValidationError(
      `Article verrouillé par ${activeLock.user_id === session.user.id ? "vous" : "un autre rédacteur"} (expiration ${activeLock.expires_at.toISOString()}).`
    );
  }

  // Le slug est gelé après publication (§11.2 panneau SEO)
  const isPublished = current.status === "published" || current.status === "updated" || current.status === "archived";
  if (input.seo?.slug !== undefined && isPublished && input.seo.slug !== current.slug) {
    // autorisé : crée une redirection 301 (voir plus bas)
  }

  const nextCategoryId = input.classification?.category_id ?? current.category_id;
  if (nextCategoryId !== current.category_id) {
    const allowed = await hasPermission(session.user, "article.update.all", {
      categoryId: nextCategoryId,
    });
    if (!allowed && !(await hasPermission(session.user, "article.update.own", { categoryId: nextCategoryId }) && current.created_by === session.user.id)) {
      throw new PermissionError("Rubrique cible hors de votre périmètre.");
    }
  }

  // Fusion des panneaux dans un état cible
  const nextBody = input.body ?? parseBlocks(current.body);
  const meta = deriveBodyMetadata(nextBody);

  const data: Record<string, unknown> = {
    updated_content_at: new Date(),
    word_count: meta.word_count,
    reading_time_min: meta.reading_time_min,
    plain_text: meta.plain_text,
    body: input.body !== undefined ? stringifyJsonArray(nextBody) : undefined,
  };

  if (input.kicker !== undefined) data.kicker = input.kicker;
  if (input.title !== undefined) data.title = input.title;
  if (input.short_title !== undefined) data.short_title = input.short_title;
  if (input.seo_title !== undefined) data.seo_title = input.seo_title;
  if (input.lede !== undefined) data.lede = input.lede;

  if (input.publication) {
    const p = input.publication;
    if (p.visibility !== undefined) data.visibility = p.visibility;
    if (p.importance !== undefined) data.importance = p.importance;
    if (p.is_breaking !== undefined) data.is_breaking = p.is_breaking;
    if (p.send_push !== undefined) data.send_push = p.send_push;
    if (p.include_newsletter !== undefined) data.include_newsletter = p.include_newsletter;
    if (p.social_text !== undefined) data.social_text = p.social_text;
    if (p.expires_at !== undefined) data.expires_at = p.expires_at ? new Date(p.expires_at) : null;
  }

  if (input.seo) {
    const s = input.seo;
    if (s.slug !== undefined && s.slug !== current.slug) {
      const newSlug = await uniqueArticleSlug(s.slug, current.locale, current.id);
      data.slug = newSlug;
      if (isPublished) {
        // Redirection 301 automatique de l'ancienne URL (§11.2 panneau SEO)
        const oldPath = `/${current.slug}`;
        const newPath = `/${newSlug}`;
        // Garde anti-boucle (renommage A→B→A) : redirection réciproque
        // supprimée avant l'upsert — voir services/taxonomies.ts updateCategory.
        await db.redirect.deleteMany({ where: { source_path: newPath, target_path: oldPath } });
        await db.redirect.upsert({
          where: { source_path: oldPath },
          create: { source_path: oldPath, target_path: newPath, status_code: 301, is_auto: true },
          update: { target_path: newPath, status_code: 301, is_auto: true },
        });
        // Réécrit les redirections existantes pointant vers l'ancienne URL (anti-chaîne)
        await db.redirect.updateMany({
          where: { target_path: oldPath, source_path: { not: oldPath } },
          data: { target_path: newPath },
        });
        invalidateTags([CACHE_TAGS.settings]);
      }
    }
    if (s.meta_title !== undefined) data.meta_title = s.meta_title;
    if (s.meta_description !== undefined) data.meta_description = s.meta_description;
    if (s.canonical_url !== undefined) data.canonical_url = s.canonical_url;
    if (s.robots_directives !== undefined) data.robots_directives = s.robots_directives;
    if (s.focus_keyword !== undefined) data.focus_keyword = s.focus_keyword;
  }

  if (input.signature) {
    const sig = input.signature;
    if (sig.source_agency !== undefined) data.source_agency = sig.source_agency;
    if (sig.dateline !== undefined) data.dateline = sig.dateline;
    if (sig.authors) {
      await db.articleAuthor.deleteMany({ where: { article_id: current.id } });
      if (sig.authors.length > 0) {
        await db.articleAuthor.createMany({
          data: sig.authors.map((a, idx) => ({
            article_id: current.id,
            user_id: a.user_id,
            role: a.role,
            position: idx,
          })),
        });
      }
    }
  }

  // Médias : alt/crédit/légende de l'image principale vivent sur le média
  let deps: UpdateDeps = {
    coverAlt: current.coverMedia?.alt_text ?? "",
    coverCredit: current.coverMedia?.credit ?? "",
    coverCaption: current.coverMedia?.caption ?? "",
    tagsCount: current.tags.length,
  };

  if (input.media) {
    const m = input.media;
    const coverId = m.cover_media_id !== undefined ? m.cover_media_id : current.cover_media_id;
    if (coverId !== current.cover_media_id) data.cover_media_id = coverId;
    if (m.social_image_id !== undefined) data.social_image_id = m.social_image_id;
    const targetCoverId = coverId ?? m.cover_media_id;
    const metaPatch: Record<string, string | null> = {};
    if (m.cover_alt !== undefined) metaPatch.alt_text = m.cover_alt;
    if (m.cover_credit !== undefined) metaPatch.credit = m.cover_credit;
    if (m.cover_caption !== undefined) metaPatch.caption = m.cover_caption;
    if (targetCoverId && Object.keys(metaPatch).length > 0) {
      await db.media.update({ where: { id: targetCoverId }, data: metaPatch });
    }
    const refreshedCover = targetCoverId
      ? await db.media.findUnique({ where: { id: targetCoverId }, select: { alt_text: true, credit: true, caption: true } })
      : null;
    deps = {
      coverAlt: refreshedCover?.alt_text ?? "",
      coverCredit: refreshedCover?.credit ?? "",
      coverCaption: refreshedCover?.caption ?? "",
      tagsCount: current.tags.length,
    };
  }

  if (input.classification) {
    const c = input.classification;
    if (c.category_id !== undefined) data.category_id = c.category_id;
    if (c.format !== undefined) data.format = c.format;
    if (c.dossier_id !== undefined) data.dossier_id = c.dossier_id;

    if (c.secondary_category_ids) {
      await db.articleCategory.deleteMany({ where: { article_id: current.id } });
      const unique = [...new Set(c.secondary_category_ids.filter((cid) => cid !== (data.category_id ?? current.category_id)))];
      if (unique.length > 0) {
        await db.articleCategory.createMany({
          data: unique.map((cid) => ({ article_id: current.id, category_id: cid })),
        });
      }
    }

    if (c.tag_ids || (c.new_tags && c.new_tags.length > 0)) {
      const tagIds = [...(c.tag_ids ?? [])];
      for (const name of c.new_tags ?? []) {
        const slug = await ensureUniqueSlug(slugify(name), async (s) => {
          const found = await db.tag.findFirst({ where: { slug: s, deleted_at: null }, select: { id: true } });
          return found !== null;
        });
        const tag = await db.tag.upsert({
          where: { slug },
          create: { name, slug, usage_count: 0 },
          update: {},
        });
        tagIds.push(tag.id);
      }
      const uniqueTags = [...new Set(tagIds)];
      await db.articleTag.deleteMany({ where: { article_id: current.id } });
      if (uniqueTags.length > 0) {
        await db.articleTag.createMany({
          data: uniqueTags.map((tid, idx) => ({ article_id: current.id, tag_id: tid, position: idx })),
        });
      }
      deps = { ...deps, tagsCount: uniqueTags.length };
    }

    if (c.geo_zone_ids) {
      await db.articleGeoZone.deleteMany({ where: { article_id: current.id } });
      if (c.geo_zone_ids.length > 0) {
        await db.articleGeoZone.createMany({
          data: c.geo_zone_ids.map((gid) => ({ article_id: current.id, geo_zone_id: gid })),
        });
      }
    }

    if (c.entity_ids) {
      await db.articleEntity.deleteMany({ where: { article_id: current.id } });
      if (c.entity_ids.length > 0) {
        await db.articleEntity.createMany({
          data: c.entity_ids.map((eid) => ({ article_id: current.id, entity_id: eid, relevance: 1 })),
        });
      }
    }
  }

  if (input.review) {
    if (input.review.sources !== undefined) data.sources = stringifyJsonArray(input.review.sources);
    if (input.review.correction_note !== undefined) data.correction_note = input.review.correction_note;
  }

  // Score SEO recalculé à l'enregistrement
  const blocksForScore = (data.body !== undefined ? parseBlocks(data.body as string) : parseBlocks(current.body)) as Block[];
  const seoScore = computeSeoScore({
    title: (data.title as string) ?? current.title,
    lede: (data.lede as string | null) ?? current.lede ?? "",
    slug: (data.slug as string) ?? current.slug,
    metaTitle: (data.meta_title as string | null) ?? current.meta_title ?? "",
    metaDescription: (data.meta_description as string | null) ?? current.meta_description ?? "",
    focusKeyword: (data.focus_keyword as string | null) ?? current.focus_keyword ?? "",
    plainText: meta.plain_text,
    wordCount: meta.word_count,
    internalLinkCount: countInternalLinks(blocksForScore),
    hasCoverImage: Boolean((data.cover_media_id as string | null) ?? current.cover_media_id),
    coverAlt: deps.coverAlt,
    coverCredit: deps.coverCredit,
    tagsCount: deps.tagsCount,
  });
  data.seo_score = seoScore.score;
  data.seo_checks = stringifyJsonObject({ checks: seoScore.checks });

  await db.article.update({ where: { id: current.id }, data });

  // Versionnement : pas d'instantané à chaque frappe d'autosave ;
  // instantané à l'enregistrement explicite (change_note fourni).
  if (!opts.autosave) {
    await createVersion(current.id, session.user.id, input.change_note ?? null);
  }

  await auditLog({
    userId: session.user.id,
    action: opts.autosave ? "article.autosave" : "article.update",
    resourceType: "article",
    resourceId: current.id,
    before: { title: current.title, status: current.status, slug: current.slug },
    after: { title: (data.title as string) ?? current.title, slug: (data.slug as string) ?? current.slug },
  });

  if (isPublished) {
    invalidateOnArticlePublish({ slug: (data.slug as string) ?? current.slug, categoryId: (data.category_id as string) ?? current.category_id });
  }

  return {
    ok: true,
    slug: (data.slug as string) ?? current.slug,
    status: current.status,
  };
}

function countInternalLinks(blocks: Block[]): number {
  let count = 0;
  for (const b of blocks) {
    if (b.type === "paragraph") {
      count += b.text.filter((f) => f.link && !f.link.external).length;
    }
    if (b.type === "readmore") count += b.articleIds.length;
  }
  return count;
}

// ─── Autosave (§11.1 : toutes les 20 s) ────────────────────────────────

export async function autosaveArticle(
  session: AuthenticatedSession,
  id: string,
  input: ArticleUpdateInput
): Promise<{ ok: true; saved_at: string }> {
  await updateArticle(session, id, input, { autosave: true });
  return { ok: true, saved_at: new Date().toISOString() };
}

// ─── Versionnement ─────────────────────────────────────────────────────

async function createVersion(articleId: string, userId: string, changeNote: string | null): Promise<void> {
  const article = await db.article.findUnique({
    where: { id: articleId },
    select: {
      slug: true, title: true, kicker: true, lede: true, body: true, plain_text: true,
      status: true, category_id: true, format: true, cover_media_id: true,
      meta_title: true, meta_description: true, focus_keyword: true, seo_score: true,
      sources: true, dateline: true, source_agency: true,
    },
  });
  if (!article) return;
  const last = await db.articleVersion.findFirst({
    where: { article_id: articleId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  await db.articleVersion.create({
    data: {
      article_id: articleId,
      version: (last?.version ?? 0) + 1,
      snapshot: stringifyJsonObject(article as unknown as Record<string, unknown>),
      change_note: changeNote,
      created_by: userId,
    },
  });
}

export async function listVersions(session: AuthenticatedSession, articleId: string) {
  await guardArticleAccess(session, articleId);
  return db.articleVersion.findMany({
    where: { article_id: articleId },
    orderBy: { version: "desc" },
    select: { id: true, version: true, change_note: true, created_at: true, createdBy: { select: { display_name: true } } },
    take: 100,
  });
}

export async function getVersionDiff(session: AuthenticatedSession, articleId: string, versionA: number, versionB: number) {
  await guardArticleAccess(session, articleId);
  const rows = await db.articleVersion.findMany({
    where: { article_id: articleId, version: { in: [versionA, versionB] } },
  });
  const a = rows.find((r) => r.version === versionA);
  const b = rows.find((r) => r.version === versionB);
  if (!a || !b) throw new ValidationError("Version introuvable.");
  const sa = parseJsonObjectSafe(a.snapshot);
  const sb = parseJsonObjectSafe(b.snapshot);
  const stats = diffStats(
    { title: String(sa.title ?? ""), plainText: String(sa.plain_text ?? "") },
    { title: String(sb.title ?? ""), plainText: String(sb.plain_text ?? "") }
  );
  return { stats, a: { version: a.version, title: sa.title }, b: { version: b.version, title: sb.title } };
}

export async function restoreVersion(session: AuthenticatedSession, articleId: string, version: number) {
  const row = await db.articleVersion.findFirst({
    where: { article_id: articleId, version },
  });
  if (!row) throw new ValidationError("Version introuvable.");
  const snapshot = parseJsonObjectSafe(row.snapshot);

  await updateArticle(session, articleId, {
    title: String(snapshot.title ?? ""),
    kicker: snapshot.kicker === null ? null : String(snapshot.kicker ?? ""),
    lede: snapshot.lede === null ? null : String(snapshot.lede ?? ""),
    body: parseBlocks(String(snapshot.body ?? "[]")),
    review: { correction_note: `Restauration de la version ${version}.` },
    change_note: `Restauration de la version ${version}`,
  });

  await auditLog({
    userId: session.user.id,
    action: "article.version_restore",
    resourceType: "article",
    resourceId: articleId,
    after: { restored_version: version },
  });
  return { ok: true };
}

function parseJsonObjectSafe(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed !== null && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// ─── Verrou d'édition (§11.1 heartbeat, 5 min) ─────────────────────────

export async function acquireOrHeartbeatLock(session: AuthenticatedSession, articleId: string) {
  const now = new Date();
  const expires = new Date(now.getTime() + LOCK_TTL_MINUTES * 60_000);
  const lock = await db.articleLock.findUnique({ where: { article_id: articleId } });

  if (!lock || lock.expires_at <= now) {
    await db.articleLock.upsert({
      where: { article_id: articleId },
      create: { article_id: articleId, user_id: session.user.id, locked_at: now, expires_at: expires },
      update: { user_id: session.user.id, locked_at: now, expires_at: expires },
    });
    return { acquired: true, mine: true, expires_at: expires.toISOString(), holder: null };
  }
  if (lock.user_id === session.user.id) {
    await db.articleLock.update({
      where: { article_id: articleId },
      data: { locked_at: now, expires_at: expires },
    });
    return { acquired: true, mine: true, expires_at: expires.toISOString(), holder: null };
  }
  // Verrou d'un autre : les admins peuvent forcer (article.lock.override)
  const override = await hasPermission(session.user, "article.lock.override");
  if (override) {
    await db.articleLock.update({
      where: { article_id: articleId },
      data: { user_id: session.user.id, locked_at: now, expires_at: expires },
    });
    return { acquired: true, mine: true, expires_at: expires.toISOString(), holder: null, overridden: true };
  }
  const holder = await db.user.findUnique({ where: { id: lock.user_id }, select: { display_name: true } });
  return { acquired: false, mine: false, expires_at: lock.expires_at.toISOString(), holder: holder?.display_name ?? "un autre rédacteur" };
}

export async function releaseLock(session: AuthenticatedSession, articleId: string): Promise<void> {
  await db.articleLock.deleteMany({ where: { article_id: articleId, user_id: session.user.id } });
}

// ─── Workflow de statuts (§11.2) ───────────────────────────────────────

export type TransitionAction =
  | "submit"
  | "request_changes"
  | "approve"
  | "publish"
  | "schedule"
  | "unpublish"
  | "archive"
  | "restore_draft";

const TRANSITION_TARGET: Record<TransitionAction, string> = {
  submit: "in_review",
  request_changes: "changes_requested",
  approve: "approved",
  publish: "published",
  schedule: "scheduled",
  unpublish: "unpublished",
  archive: "archived",
  restore_draft: "draft",
};

const ALLOWED_FROM: Record<TransitionAction, string[]> = {
  submit: ["draft", "changes_requested"],
  request_changes: ["in_review", "approved"],
  approve: ["in_review"],
  publish: ["draft", "in_review", "approved", "scheduled", "unpublished"],
  schedule: ["draft", "in_review", "approved", "unpublished"],
  unpublish: ["published", "updated"],
  archive: ["published", "updated", "unpublished", "scheduled"],
  restore_draft: ["changes_requested", "unpublished", "archived", "scheduled"],
};

const CONTRIBUTOR_ALLOWED: TransitionAction[] = ["submit"];

export async function transitionArticle(
  session: AuthenticatedSession,
  articleId: string,
  action: TransitionAction,
  opts: { scheduled_at?: string; note?: string } = {}
) {
  const article = await db.article.findFirst({
    where: { id: articleId, deleted_at: null },
    include: { coverMedia: { select: { alt_text: true, credit: true } }, tags: { select: { tag_id: true } }, authors: { select: { user_id: true } } },
  });
  if (!article) throw new ValidationError("Article introuvable.");

  // Contributeur externe : uniquement soumettre (§08.2 portée draft/in_review)
  const isContributorOnly = session.user.roles.length > 0 && session.user.roles.every((r) => r.key === "contributor");
  if (isContributorOnly && !CONTRIBUTOR_ALLOWED.includes(action)) {
    throw new PermissionError("Les contributeurs externes peuvent uniquement soumettre leurs articles.");
  }

  // Permission requise selon l'action
  const needPublish = action === "publish" || action === "unpublish";
  const needSchedule = action === "schedule";
  const permission: Permission = needPublish ? "article.publish" : needSchedule ? "article.schedule" : "article.update.all";
  const isOwner = article.created_by === session.user.id;

  if (needPublish || needSchedule || action === "approve" || action === "request_changes") {
    const allowed =
      (isOwner && (await hasPermission(session.user, "article.update.own", { categoryId: article.category_id }))) ||
      (await hasPermission(session.user, permission, { categoryId: article.category_id }));
    if (!allowed) throw new PermissionError(`Permission requise : ${permission}.`);
    if ((needPublish || needSchedule) && isOwner) {
      // publish/schedule exigent la permission dédiée (jamais seulement update.own)
      const hasDedicated = await hasPermission(session.user, needPublish ? "article.publish" : "article.schedule", {
        categoryId: article.category_id,
      });
      if (!hasDedicated) {
        throw new PermissionError(
          needPublish
            ? "Publication réservée aux rédacteurs en chef, directeurs de publication et administrateurs (paramétrable pour les journalistes)."
            : "Programmation réservée aux profiles habilités."
        );
      }
    }
  } else if (!(await canEditArticle(session, article))) {
    throw new PermissionError("Vous n'avez pas le droit de modifier cet article.");
  }

  if (!ALLOWED_FROM[action].includes(article.status)) {
    throw new ValidationError(
      `Transition « ${action} » impossible depuis l'état « ${article.status} ».`
    );
  }

  // Contrôles bloquants à la publication / programmation (§11.2)
  if (action === "publish" || action === "schedule") {
    const checks = await computePublicationChecks(
      article,
      {
        coverAlt: article.coverMedia?.alt_text ?? "",
        coverCredit: article.coverMedia?.credit ?? "",
        tagsCount: article.tags.length,
      }
    );
    if (checks.blocking.length > 0) {
      throw new ValidationError(
        `Publication bloquée : ${checks.blocking.map((b) => b.message).join(" ")}`
      );
    }
    // Instantané avant publication
    await createVersion(articleId, session.user.id, "Publication");
  }

  const target = TRANSITION_TARGET[action];
  const data: Record<string, unknown> = { status: target };

  if (action === "publish") {
    data.published_at = article.published_at ?? new Date();
    data.published_by = session.user.id;
    data.scheduled_at = null;
  }
  if (action === "schedule") {
    const when = opts.scheduled_at ? new Date(opts.scheduled_at) : null;
    if (!when || when.getTime() <= Date.now()) {
      throw new ValidationError("La date de programmation doit être dans le futur.");
    }
    data.scheduled_at = when;
  }
  if (action === "unpublish") {
    data.published_at = null;
    data.published_by = null;
  }
  if (action === "submit" || action === "request_changes" || action === "restore_draft") {
    if (opts.note) data.correction_note = opts.note;
  }

  await db.article.update({ where: { id: articleId }, data });

  // Notifications de workflow (§11.2)
  const payload = {
    article_id: articleId,
    title: article.title,
    from_status: article.status,
    to_status: target,
    actor_name: session.user.displayName,
    note: opts.note,
  };
  if (action === "submit") {
    await notifyRoles(["chief_editor", "publisher", "admin", "section_editor"], "workflow.submit", payload, {
      excludeUserId: session.user.id,
    });
  } else if (action === "publish") {
    for (const author of article.authors) {
      if (author.user_id !== session.user.id) {
        await notifyUser(author.user_id, "workflow.publish", payload);
      }
    }
  } else if (action === "request_changes") {
    for (const author of article.authors) {
      if (author.user_id !== session.user.id) {
        await notifyUser(author.user_id, "workflow.return", payload);
      }
    }
  } else if (action === "schedule") {
    await notifyRoles(["chief_editor", "publisher", "admin"], "workflow.schedule", payload, {
      excludeUserId: session.user.id,
    });
  }

  await auditLog({
    userId: session.user.id,
    action: `article.${action}`,
    resourceType: "article",
    resourceId: articleId,
    before: { status: article.status },
    after: { status: target, note: opts.note ?? null },
  });

  if (action === "publish") {
    invalidateOnArticlePublish({ slug: article.slug, categoryId: article.category_id });
  }

  return { ok: true, status: target };
}

// ─── Liste (§11.2 /admin/articles) ─────────────────────────────────────

export async function listArticles(session: AuthenticatedSession, query: ArticleListQuery) {
  const canReadAll = await hasPermission(session.user, "article.read.all");
  const where: Record<string, unknown> = {};

  if (query.trash) {
    where.deleted_at = { not: null };
  } else {
    where.deleted_at = null;
  }

  if (!canReadAll && !query.trash) {
    where.created_by = session.user.id;
  }
  if (query.status) where.status = query.status;
  if (query.category_id) where.category_id = query.category_id;
  if (query.author_id) where.created_by = query.author_id;
  if (query.format) where.format = query.format;
  if (query.from || query.to) {
    where.updated_at = {
      ...(query.from ? { gte: new Date(query.from) } : {}),
      ...(query.to ? { lte: new Date(query.to) } : {}),
    };
  }
  if (query.q) {
    where.OR = [
      { title: { contains: query.q } },
      { lede: { contains: query.q } },
      { slug: { contains: query.q } },
    ];
  }
  if (query.no_image) where.cover_media_id = null;
  if (query.no_keyword) where.focus_keyword = null;
  if (query.seo_max !== undefined) {
    where.seo_score = { lte: query.seo_max };
  }

  const page = query.page ?? 1;
  const perPage = query.per_page ?? 20;
  const sortField = query.sort ?? "updated_at";
  const dir = query.dir ?? "desc";

  const [total, rows] = await Promise.all([
    db.article.count({ where }),
    db.article.findMany({
      where,
      orderBy: { [sortField]: dir },
      select: {
        id: true, title: true, slug: true, status: true, format: true,
        published_at: true, scheduled_at: true, updated_at: true,
        view_count: true, seo_score: true, importance: true,
        cover_media_id: true, created_by: true,
        category: { select: { id: true, name: true, slug: true } },
        createdBy: { select: { id: true, display_name: true } },
        authors: { select: { user: { select: { display_name: true } } }, take: 3 },
      },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);

  return {
    items: rows,
    meta: { total, page, per_page: perPage, pages: Math.max(1, Math.ceil(total / perPage)) },
  };
}

// ─── Actions groupées (§11.2) ──────────────────────────────────────────

export async function bulkAction(
  session: AuthenticatedSession,
  input: { ids: string[]; action: string; category_id?: string; tag_id?: string; scheduled_at?: string }
) {
  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const id of input.ids) {
    try {
      switch (input.action) {
        case "move_category": {
          if (!input.category_id) throw new ValidationError("Rubrique cible manquante.");
          const article = await db.article.findFirst({ where: { id, deleted_at: null }, select: { category_id: true, created_by: true } });
          if (!article) throw new ValidationError("Article introuvable.");
          const ok = await canEditArticle(session, article);
          if (!ok) throw new PermissionError("Non autorisé.");
          await db.article.update({ where: { id }, data: { category_id: input.category_id } });
          break;
        }
        case "add_tag": {
          if (!input.tag_id) throw new ValidationError("Mot-clé manquant.");
          const exists = await db.articleTag.findUnique({
            where: { article_id_tag_id: { article_id: id, tag_id: input.tag_id } },
          });
          if (!exists) {
            await db.articleTag.create({ data: { article_id: id, tag_id: input.tag_id } });
          }
          break;
        }
        case "schedule": {
          await transitionArticle(session, id, "schedule", { scheduled_at: input.scheduled_at });
          break;
        }
        case "archive":
          await transitionArticle(session, id, "archive");
          break;
        case "trash":
          await trashArticle(session, id);
          break;
        case "restore":
          await restoreArticle(session, id);
          break;
        default:
          throw new ValidationError("Action inconnue.");
      }
      results.push({ id, ok: true });
    } catch (error) {
      results.push({ id, ok: false, error: error instanceof Error ? error.message : "Erreur" });
    }
  }
  await auditLog({
    userId: session.user.id,
    action: `article.bulk_${input.action}`,
    resourceType: "article",
    after: { ids: input.ids, results },
  });
  return results;
}

// ─── Corbeille (§11.1 : suppression → corbeille 30 j) ──────────────────

export async function trashArticle(session: AuthenticatedSession, id: string): Promise<void> {
  const article = await db.article.findFirst({ where: { id, deleted_at: null }, select: { id: true, category_id: true, created_by: true, status: true } });
  if (!article) throw new ValidationError("Article introuvable.");
  const canDelete = await hasPermission(session.user, "article.delete");
  if (!canDelete && !(article.created_by === session.user.id && article.status === "draft")) {
    throw new PermissionError("Permission requise : article.delete.");
  }
  await db.article.update({ where: { id }, data: { deleted_at: new Date() } });
  await auditLog({ userId: session.user.id, action: "article.trash", resourceType: "article", resourceId: id });
}

export async function restoreArticle(session: AuthenticatedSession, id: string): Promise<void> {
  const canDelete = await hasPermission(session.user, "article.delete");
  if (!canDelete) throw new PermissionError("Permission requise : article.delete.");
  await db.article.update({ where: { id }, data: { deleted_at: null } });
  await auditLog({ userId: session.user.id, action: "article.restore", resourceType: "article", resourceId: id });
}

export async function purgeExpiredTrash(): Promise<number> {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 3600 * 1000);
  const result = await db.article.deleteMany({ where: { deleted_at: { lt: cutoff } } });
  return result.count;
}

// ─── Commentaires de relecture (§11.2 panneau Relecture) ───────────────

export async function listReviewComments(articleId: string) {
  return db.reviewComment.findMany({
    where: { article_id: articleId },
    orderBy: { created_at: "asc" },
    select: {
      id: true, block_id: true, text: true, resolved: true, created_at: true,
      createdBy: { select: { display_name: true } },
    },
  });
}

export async function addReviewComment(
  session: AuthenticatedSession,
  articleId: string,
  input: { block_id?: string | null; text: string }
) {
  await guardArticleAccess(session, articleId);
  const comment = await db.reviewComment.create({
    data: {
      article_id: articleId,
      block_id: input.block_id ?? null,
      text: input.text,
      created_by: session.user.id,
    },
  });
  return comment;
}

export async function resolveReviewComment(session: AuthenticatedSession, commentId: string, resolved: boolean) {
  await guardCommentAccess(session, commentId);
  await db.reviewComment.update({ where: { id: commentId }, data: { resolved } });
  return { ok: true };
}

async function guardCommentAccess(session: AuthenticatedSession, commentId: string): Promise<void> {
  const comment = await db.reviewComment.findUnique({ where: { id: commentId }, select: { article_id: true } });
  if (!comment) throw new ValidationError("Commentaire introuvable.");
  await guardArticleAccess(session, comment.article_id);
}

async function guardArticleAccess(session: AuthenticatedSession, articleId: string): Promise<void> {
  const article = await db.article.findFirst({
    where: { id: articleId, deleted_at: null },
    select: { created_by: true },
  });
  if (!article) throw new ValidationError("Article introuvable.");
  const canReadAll = await hasPermission(session.user, "article.read.all");
  if (!canReadAll && article.created_by !== session.user.id) {
    throw new PermissionError("Permission requise : article.read.all.");
  }
}

// ─── File de travail personnelle (§11.2 tableau de bord) ───────────────

export async function myWorkQueue(session: AuthenticatedSession) {
  const base = {
    id: true, title: true, status: true, scheduled_at: true, updated_at: true,
    category: { select: { name: true } },
  } as const;

  const canReadAll = await hasPermission(session.user, "article.read.all");
  const [mine, toReview] = await Promise.all([
    db.article.findMany({
      where: { deleted_at: null, created_by: session.user.id, status: { in: ["draft", "changes_requested", "in_review", "scheduled"] } },
      orderBy: { updated_at: "desc" },
      select: base,
      take: 10,
    }),
    canReadAll
      ? db.article.findMany({
          where: { deleted_at: null, status: "in_review" },
          orderBy: { updated_at: "desc" },
          select: base,
          take: 10,
        })
      : Promise.resolve([] as { id: string; title: string; status: string; scheduled_at: Date | null; updated_at: Date; category: { name: string } }[]),
  ]);

  return { mine, toReview };
}

// ─── Publication d'urgence (§11.2 « Publier en flash ») ────────────────

export async function publishAsFlash(
  session: AuthenticatedSession,
  input: { text: string; link?: string | null }
) {
  const flashAllowed = await hasPermission(session.user, "flash.manage");
  if (!flashAllowed) throw new PermissionError("Permission requise : flash.manage.");

  const expires = new Date(Date.now() + 12 * 3600 * 1000); // défaut §06.2 : 12 h
  const flash = await db.flashNews.create({
    data: {
      text: input.text.slice(0, 300),
      external_url: input.link ?? null,
      priority: 1,
      expires_at: expires,
      created_by: session.user.id,
    },
  });
  await auditLog({
    userId: session.user.id,
    action: "flash.create",
    resourceType: "flash",
    resourceId: flash.id,
    after: { text: flash.text },
  });
  invalidateTags([CACHE_TAGS.flash]);
  return flash;
}
