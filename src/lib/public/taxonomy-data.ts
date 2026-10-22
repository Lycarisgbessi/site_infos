import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { PublicArticle } from "@/lib/public/homepage-data";

/**
 * Couche de données des pages taxonomies du front public : rubriques
 * (/rubrique/{slug}), dossiers (/dossiers/{slug}) et tags (/tags/{slug}).
 * Mêmes styles et patterns que homepage-data.ts (mapping PublicArticle),
 * avec pagination (?page=) pour les listes d'articles.
 */

// ─── Articles publiés : sélection + mapping PublicArticle ────────────

const articleSelect = {
  id: true,
  slug: true,
  kicker: true,
  short_title: true,
  title: true,
  lede: true,
  is_breaking: true,
  is_sponsored: true,
  sponsor_name: true,
  format: true,
  reading_time_min: true,
  published_at: true,
  view_count: true,
  category: { select: { name: true, slug: true } },
  coverMedia: {
    select: { url: true, alt_text: true, credit: true, width: true, height: true },
  },
  authors: {
    orderBy: { position: "asc" },
    select: { role: true, user: { select: { display_name: true } } },
  },
} satisfies Prisma.ArticleSelect;

type ArticleRow = Prisma.ArticleGetPayload<{ select: typeof articleSelect }>;

function toPublicArticle(a: ArticleRow): PublicArticle {
  return {
    id: a.id,
    slug: a.slug,
    kicker: a.kicker,
    shortTitle: a.short_title,
    title: a.title,
    lede: a.lede,
    isBreaking: a.is_breaking,
    isSponsored: a.is_sponsored,
    sponsorName: a.sponsor_name,
    format: a.format,
    readingTimeMin: a.reading_time_min,
    publishedAt: a.published_at,
    viewCount: a.view_count,
    category: a.category,
    cover: a.coverMedia
      ? {
          url: a.coverMedia.url,
          alt: a.coverMedia.alt_text,
          credit: a.coverMedia.credit,
          width: a.coverMedia.width,
          height: a.coverMedia.height,
        }
      : null,
    authors: a.authors.map((au) => ({ role: au.role, name: au.user.display_name })),
  };
}

/** Articles publiés réellement visibles (date de publication passée). */
function publishedWhere(now: Date): Prisma.ArticleWhereInput {
  return { deleted_at: null, status: "published", published_at: { lte: now } };
}

// ─── Pagination ──────────────────────────────────────────────────────

/** Page demandée via ?page= → entier ≥ 1 (repli 1 si absent/invalide). */
export function parsePageParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export interface ArticlePageResult {
  articles: PublicArticle[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

/** Liste paginée d'articles publiés, plus récents d'abord. */
async function paginateArticles(
  where: Prisma.ArticleWhereInput,
  page: number,
  pageSize: number,
): Promise<ArticlePageResult> {
  const safePageSize = Math.min(Math.max(pageSize, 1), 48);
  const total = await db.article.count({ where });
  const totalPages = Math.max(Math.ceil(total / safePageSize), 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);

  const rows = await db.article.findMany({
    where,
    orderBy: { published_at: "desc" },
    skip: (safePage - 1) * safePageSize,
    take: safePageSize,
    select: articleSelect,
  });

  return {
    articles: rows.map(toPublicArticle),
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
    hasPreviousPage: safePage > 1,
    hasNextPage: safePage < totalPages,
  };
}

// ─── Rubriques (Category) ────────────────────────────────────────────

export interface PublicCategory {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  description: string | null;
  /** Texte éditorial SEO de la page rubrique (HTML contrôlé par la rédaction). */
  introHtml: string | null;
  colorAccent: string | null;
}

/** Rubrique visible par slug (parent/slug non unique globalement → findFirst). */
export async function getCategoryBySlug(slug: string): Promise<PublicCategory | null> {
  const c = await db.category.findFirst({
    where: { slug, deleted_at: null, is_visible: true },
    select: {
      id: true,
      slug: true,
      name: true,
      short_name: true,
      description: true,
      intro_html: true,
      color_accent: true,
    },
  });
  if (!c) return null;
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    shortName: c.short_name,
    description: c.description,
    introHtml: c.intro_html,
    colorAccent: c.color_accent,
  };
}

/** Articles publiés de la rubrique ET de ses sous-rubriques visibles
 * (catégorie principale OU secondaire), paginés — plus récents d'abord.
 * Les ids de la rubrique et de ses enfants visibles sont résolus en une
 * seule requête (relation children), puis filtrés via category_id in. */
export async function getArticlesByCategory(
  slug: string,
  page = 1,
  pageSize = 12,
): Promise<ArticlePageResult> {
  const now = new Date();
  const category = await db.category.findFirst({
    where: { slug, deleted_at: null, is_visible: true },
    select: {
      id: true,
      children: { where: { deleted_at: null, is_visible: true }, select: { id: true } },
    },
  });
  const categoryIds = category ? [category.id, ...category.children.map((c) => c.id)] : [];
  return paginateArticles(
    {
      ...publishedWhere(now),
      OR: [
        { category_id: { in: categoryIds } },
        { secondaryCats: { some: { category: { slug, deleted_at: null } } } },
      ],
    },
    page,
    pageSize,
  );
}

// ─── Arbre des rubriques (index /rubriques) ──────────────────────────

export interface PublicCategoryNode {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  description: string | null;
  /** Articles publiés de la rubrique + de ses sous-rubriques visibles. */
  articleCount: number;
  children: PublicCategoryNode[];
}

/** Arbre complet des catégories visibles (parent → enfants, tri position),
 * avec le nombre d'articles publiés par catégorie (comptage groupé, puis
 * somme récursive parent = direct + descendants). Deux requêtes au total. */
export async function getCategoryTree(): Promise<PublicCategoryNode[]> {
  const now = new Date();
  const rows = await db.category.findMany({
    where: { deleted_at: null, is_visible: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, slug: true, name: true, short_name: true, description: true, parent_id: true },
  });
  const counts = await db.article.groupBy({
    by: ["category_id"],
    where: publishedWhere(now),
    _count: true,
  });
  const directCount = new Map(counts.map((c) => [c.category_id, c._count]));

  const nodes = new Map<string, PublicCategoryNode>();
  for (const r of rows) {
    nodes.set(r.id, {
      id: r.id,
      slug: r.slug,
      name: r.name,
      shortName: r.short_name,
      description: r.description,
      articleCount: directCount.get(r.id) ?? 0,
      children: [],
    });
  }
  const roots: PublicCategoryNode[] = [];
  for (const r of rows) {
    const node = nodes.get(r.id);
    const parent = r.parent_id ? nodes.get(r.parent_id) : undefined;
    if (!node) continue;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  // Somme récursive des descendants (l'arbre SQL est acyclique : parent
  // obligatoirement créé avant l'enfant, contrainte FK onDelete Restrict).
  const sumDescendants = (node: PublicCategoryNode): number => {
    let sum = 0;
    for (const child of node.children) sum += sumDescendants(child);
    node.articleCount += sum;
    return node.articleCount;
  };
  for (const root of roots) sumDescendants(root);
  return roots;
}

/** Sous-rubriques visibles directes d'une rubrique (liens de navigation
 * sur la page /rubrique/{slug}). */
export async function getVisibleChildCategories(
  slug: string,
): Promise<{ id: string; slug: string; name: string }[]> {
  const parent = await db.category.findFirst({
    where: { slug, deleted_at: null, is_visible: true },
    select: {
      children: {
        where: { deleted_at: null, is_visible: true },
        orderBy: { position: "asc" },
        select: { id: true, slug: true, name: true },
      },
    },
  });
  return parent?.children ?? [];
}

// ─── Dossiers (Dossier) ──────────────────────────────────────────────

export interface PublicDossier {
  id: string;
  slug: string;
  title: string;
  lede: string | null;
  description: string | null;
  cover: { url: string; alt: string | null; credit: string | null; width: number | null; height: number | null } | null;
}

/** Fenêtre de publication : is_active + started_at passé + ended_at non écoulé. */
function dossierWindow(now: Date): Prisma.DossierWhereInput {
  return {
    deleted_at: null,
    is_active: true,
    AND: [
      { OR: [{ started_at: null }, { started_at: { lte: now } }] },
      { OR: [{ ended_at: null }, { ended_at: { gte: now } }] },
    ],
  };
}

/** Dossier actif et dans sa fenêtre de publication (sinon null → 404). */
export async function getDossierBySlug(slug: string): Promise<PublicDossier | null> {
  const now = new Date();
  const d = await db.dossier.findFirst({
    where: { slug, ...dossierWindow(now) },
    select: {
      id: true,
      slug: true,
      title: true,
      lede: true,
      description: true,
      coverMedia: { select: { url: true, alt_text: true, credit: true, width: true, height: true } },
    },
  });
  if (!d) return null;
  return {
    id: d.id,
    slug: d.slug,
    title: d.title,
    lede: d.lede,
    description: d.description,
    cover: d.coverMedia
      ? {
          url: d.coverMedia.url,
          alt: d.coverMedia.alt_text,
          credit: d.coverMedia.credit,
          width: d.coverMedia.width,
          height: d.coverMedia.height,
        }
      : null,
  };
}

/** Articles liés au dossier (relation Article.dossier_id), paginés.
 * La fenêtre du dossier est revérifiée côté relation. */
export async function getArticlesByDossier(
  slug: string,
  page = 1,
  pageSize = 12,
): Promise<ArticlePageResult> {
  const now = new Date();
  return paginateArticles(
    { ...publishedWhere(now), dossier: { slug, ...dossierWindow(now) } },
    page,
    pageSize,
  );
}

// ─── Tags (Tag) ──────────────────────────────────────────────────────

export interface PublicTag {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  introHtml: string | null;
}

/** Tag par slug (slug unique ; 404 si inexistant ou supprimé). */
export async function getTagBySlug(slug: string): Promise<PublicTag | null> {
  const t = await db.tag.findFirst({
    where: { slug, deleted_at: null },
    select: { id: true, slug: true, name: true, description: true, intro_html: true },
  });
  if (!t) return null;
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    description: t.description,
    introHtml: t.intro_html,
  };
}

/** Articles publiés portant le tag (article_tags), paginés. */
export async function getArticlesByTag(
  slug: string,
  page = 1,
  pageSize = 12,
): Promise<ArticlePageResult> {
  const now = new Date();
  return paginateArticles(
    { ...publishedWhere(now), tags: { some: { tag: { slug, deleted_at: null } } } },
    page,
    pageSize,
  );
}

// ─── Index des classifications (pages /tags, /dossiers, /entites, /zones) ──

/** Regroupe des entrées nommées par lettre initiale (accents normalisés,
 * chiffres et symboles sous « # »), lettres triées alphabétiquement. */
export function groupByInitial<T extends { name: string }>(
  items: T[],
): { letter: string; items: T[] }[] {
  const byLetter = new Map<string, T[]>();
  for (const item of items) {
    const raw = item.name.trim().charAt(0).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const upper = raw.toUpperCase();
    const letter = /^[A-Z]$/.test(upper) ? upper : "#";
    const bucket = byLetter.get(letter) ?? [];
    bucket.push(item);
    byLetter.set(letter, bucket);
  }
  return [...byLetter.entries()]
    .sort((a, b) => (a[0] === "#" ? 1 : b[0] === "#" ? -1 : a[0].localeCompare(b[0], "fr")))
    .map(([letter, bucket]) => ({ letter, items: bucket }));
}

// ─── Tags : index /tags ──────────────────────────────────────────────

export interface PublicTagIndexItem {
  id: string;
  slug: string;
  name: string;
  articleCount: number;
}

/** Tous les tags utilisés par au moins un article publié, avec leur compte
 * d'articles, triés alphabétiquement. Grouper + résoudre = 2 requêtes. */
export async function getTagsWithPublishedArticles(): Promise<PublicTagIndexItem[]> {
  const now = new Date();
  const grouped = await db.articleTag.groupBy({
    by: ["tag_id"],
    where: { article: publishedWhere(now), tag: { deleted_at: null } },
    _count: true,
  });
  const countById = new Map(grouped.map((g) => [g.tag_id, g._count]));
  if (countById.size === 0) return [];
  const tags = await db.tag.findMany({
    where: { id: { in: [...countById.keys()] }, deleted_at: null },
    select: { id: true, slug: true, name: true },
  });
  return tags
    .map((t) => ({ id: t.id, slug: t.slug, name: t.name, articleCount: countById.get(t.id) ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

// ─── Dossiers : index /dossiers ──────────────────────────────────────

export interface PublicDossierIndexItem {
  id: string;
  slug: string;
  title: string;
  lede: string | null;
  isFeatured: boolean;
  articleCount: number;
  cover: { url: string; alt: string | null; credit: string | null; width: number | null; height: number | null } | null;
}

/** Tous les dossiers actifs et dans leur fenêtre de publication, avec leur
 * compte d'articles publiés — mis en avant (is_featured) d'abord, puis du
 * plus récent au plus ancien (started_at, null en fin). 2 requêtes. */
export async function getActiveDossiersList(): Promise<PublicDossierIndexItem[]> {
  const now = new Date();
  const dossiers = await db.dossier.findMany({
    where: dossierWindow(now),
    orderBy: [{ is_featured: "desc" }, { started_at: { sort: "desc", nulls: "last" } }],
    select: {
      id: true,
      slug: true,
      title: true,
      lede: true,
      is_featured: true,
      coverMedia: { select: { url: true, alt_text: true, credit: true, width: true, height: true } },
    },
  });
  const counts = await db.article.groupBy({
    by: ["dossier_id"],
    where: { ...publishedWhere(now), dossier_id: { not: null } },
    _count: true,
  });
  const countById = new Map(
    counts
      .filter((c): c is { dossier_id: string; _count: number } => c.dossier_id !== null)
      .map((c) => [c.dossier_id, c._count]),
  );
  return dossiers.map((d) => ({
    id: d.id,
    slug: d.slug,
    title: d.title,
    lede: d.lede,
    isFeatured: d.is_featured,
    articleCount: countById.get(d.id) ?? 0,
    cover: d.coverMedia
      ? {
          url: d.coverMedia.url,
          alt: d.coverMedia.alt_text,
          credit: d.coverMedia.credit,
          width: d.coverMedia.width,
          height: d.coverMedia.height,
        }
      : null,
  }));
}

// ─── Entités : index /entites (personnes, organisations, lieux) ───────

export interface PublicEntityIndexItem {
  id: string;
  slug: string;
  name: string;
  type: "person" | "organization" | "place";
  roleTitle: string | null;
  articleCount: number;
}

/** Entités citées par au moins un article publié, avec leur compte
 * d'articles, triées alphabétiquement. 2 requêtes (groupBy + findMany). */
export async function getEntitiesWithPublishedArticles(): Promise<PublicEntityIndexItem[]> {
  const now = new Date();
  const grouped = await db.articleEntity.groupBy({
    by: ["entity_id"],
    where: { article: publishedWhere(now), entity: { deleted_at: null } },
    _count: true,
  });
  const countById = new Map(grouped.map((g) => [g.entity_id, g._count]));
  if (countById.size === 0) return [];
  const entities = await db.entity.findMany({
    where: { id: { in: [...countById.keys()] }, deleted_at: null },
    select: { id: true, slug: true, name: true, type: true, role_title: true },
  });
  return entities
    .map((e) => ({
      id: e.id,
      slug: e.slug,
      name: e.name,
      type: e.type,
      roleTitle: e.role_title,
      articleCount: countById.get(e.id) ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

// ─── Zones géographiques : index /zones ──────────────────────────────

export interface PublicZoneIndexItem {
  id: string;
  slug: string;
  name: string;
  type: "continent" | "country" | "region" | "city";
  articleCount: number;
}

/** Zones géographiques visibles rattachées à au moins un article publié,
 * avec leur compte d'articles, triées alphabétiquement. 2 requêtes. */
export async function getZonesWithPublishedArticles(): Promise<PublicZoneIndexItem[]> {
  const now = new Date();
  const grouped = await db.articleGeoZone.groupBy({
    by: ["geo_zone_id"],
    where: { article: publishedWhere(now), geoZone: { is_visible: true } },
    _count: true,
  });
  const countById = new Map(grouped.map((g) => [g.geo_zone_id, g._count]));
  if (countById.size === 0) return [];
  const zones = await db.geoZone.findMany({
    where: { id: { in: [...countById.keys()] }, is_visible: true },
    select: { id: true, slug: true, name: true, type: true },
  });
  return zones
    .map((z) => ({ id: z.id, slug: z.slug, name: z.name, type: z.type, articleCount: countById.get(z.id) ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}
