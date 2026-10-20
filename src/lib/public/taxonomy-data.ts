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

/** Articles publiés de la rubrique (catégorie principale OU secondaire),
 * paginés — plus récents d'abord. */
export async function getArticlesByCategory(
  slug: string,
  page = 1,
  pageSize = 12,
): Promise<ArticlePageResult> {
  const now = new Date();
  return paginateArticles(
    {
      ...publishedWhere(now),
      OR: [
        { category: { slug, deleted_at: null } },
        { secondaryCats: { some: { category: { slug, deleted_at: null } } } },
      ],
    },
    page,
    pageSize,
  );
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
