import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Couche de données du front-office public (accueil, §09.1).
 * Agrège : menus, flash, une (featured_slots), sections par rubrique,
 * en continu, plus lus, vidéos, dossier, opinions — avec couvertures.
 * Task ID: 9-FRONT
 */

export interface PublicArticle {
  id: string;
  slug: string;
  kicker: string | null;
  shortTitle: string | null;
  title: string;
  lede: string | null;
  isBreaking: boolean;
  isSponsored: boolean;
  sponsorName: string | null;
  format: string;
  readingTimeMin: number;
  publishedAt: Date | null;
  viewCount: bigint;
  category: { name: string; slug: string } | null;
  cover: { url: string; alt: string | null; credit: string | null; width: number | null; height: number | null } | null;
  authors: { role: string; name: string }[];
}

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

const PUBLISHED = { deleted_at: null, status: "published" as const };

/** Articles de la une — composeur featured_slots (zone home_lead), sinon repli. */
export async function getHeroArticles(count = 5): Promise<PublicArticle[]> {
  const slots = await db.featuredSlot.findMany({
    where: { zone: "home_lead" },
    orderBy: { position: "asc" },
    take: count,
  });
  const ids = slots.map((s) => s.article_id);
  if (ids.length > 0) {
    const rows = await db.article.findMany({
      where: { id: { in: ids }, ...PUBLISHED },
      select: articleSelect,
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const ordered = ids.map((id) => byId.get(id)).filter((r): r is ArticleRow => Boolean(r));
    if (ordered.length >= 3) return ordered.map(toPublicArticle);
  }
  const fallback = await db.article.findMany({
    where: PUBLISHED,
    orderBy: [{ importance: "asc" }, { published_at: "desc" }],
    take: count,
    select: articleSelect,
  });
  return fallback.map(toPublicArticle);
}

/** Section par rubrique : 1 vedette + liste. */
export async function getSectionArticles(categorySlug: string, count = 5): Promise<PublicArticle[]> {
  const rows = await db.article.findMany({
    where: { ...PUBLISHED, category: { slug: categorySlug } },
    orderBy: [{ importance: "asc" }, { published_at: "desc" }],
    take: count,
    select: articleSelect,
  });
  return rows.map(toPublicArticle);
}

/** En continu : derniers articles publiés. */
export async function getLatestArticles(count = 12): Promise<PublicArticle[]> {
  const rows = await db.article.findMany({
    where: PUBLISHED,
    orderBy: { published_at: "desc" },
    take: count,
    select: articleSelect,
  });
  return rows.map(toPublicArticle);
}

/** Les plus lus (compteurs cumulés). */
export async function getMostReadArticles(count = 5): Promise<PublicArticle[]> {
  const rows = await db.article.findMany({
    where: PUBLISHED,
    orderBy: { view_count: "desc" },
    take: count,
    select: articleSelect,
  });
  return rows.map(toPublicArticle);
}

/** Flash info actif (non expiré). */
export async function getFlashItems(): Promise<{ id: string; text: string; priority: number; articleId: string | null; externalUrl: string | null }[]> {
  const rows = await db.flashNews.findMany({
    where: { deleted_at: null, expires_at: { gt: new Date() } },
    orderBy: [{ priority: "asc" }, { published_at: "desc" }],
    take: 10,
    select: { id: true, text: true, priority: true, article_id: true, external_url: true },
  });
  return rows.map((r) => ({ id: r.id, text: r.text, priority: r.priority, articleId: r.article_id, externalUrl: r.external_url }));
}

/** Direct en cours (Z-05). */
export async function getActiveLive(): Promise<{ id: string; title: string } | null> {
  const live = await db.liveBlog.findFirst({
    where: { status: "live", deleted_at: null },
    orderBy: { updated_at: "desc" },
    select: { id: true, title: true },
  });
  return live;
}

/** Reportages vidéo (Z-08). */
export async function getVideoArticles(count = 6): Promise<PublicArticle[]> {
  const rows = await db.article.findMany({
    where: { ...PUBLISHED, format: "video" },
    orderBy: { published_at: "desc" },
    take: count,
    select: articleSelect,
  });
  return rows.map(toPublicArticle);
}

/** Dossier à la une (Z-11). */
export async function getFeaturedDossier(): Promise<{ id: string; title: string; lede: string | null; cover: { url: string; alt: string | null } | null } | null> {
  const d = await db.dossier.findFirst({
    where: { is_active: true, is_featured: true },
    orderBy: { updated_at: "desc" },
    select: {
      id: true,
      title: true,
      lede: true,
      coverMedia: { select: { url: true, alt_text: true } },
    },
  });
  if (!d) return null;
  return {
    id: d.id,
    title: d.title,
    lede: d.lede,
    cover: d.coverMedia ? { url: d.coverMedia.url, alt: d.coverMedia.alt_text } : null,
  };
}

/** Opinions (Z-13) : éditorial + tribunes + chroniques. */
export async function getOpinionArticles(count = 4): Promise<PublicArticle[]> {
  const rows = await db.article.findMany({
    where: { ...PUBLISHED, category: { slug: { in: ["opinions", "editorial", "verification"] } } },
    orderBy: { published_at: "desc" },
    take: count,
    select: articleSelect,
  });
  return rows.map(toPublicArticle);
}

/** Monde (Z-12) : international + sous-rubriques + diaspora. */
export async function getWorldArticles(count = 8): Promise<PublicArticle[]> {
  const rows = await db.article.findMany({
    where: {
      ...PUBLISHED,
      OR: [
        { category: { slug: "international" } },
        { category: { slug: "diaspora" } },
        { category: { parent: { slug: "international" } } },
      ],
    },
    orderBy: { published_at: "desc" },
    take: count,
    select: articleSelect,
  });
  return rows.map(toPublicArticle);
}

export interface NavItem {
  label: string;
  href: string;
}

/** Menu principal — cible category → ancre de section sur l'accueil. */
export async function getMainMenu(): Promise<NavItem[]> {
  const menu = await db.menu.findUnique({
    where: { key: "main" },
    include: { items: { where: { is_visible: true }, orderBy: { position: "asc" } } },
  });
  if (!menu) return [];
  const items: NavItem[] = [];
  for (const it of menu.items) {
    if (it.target_type === "home" || !it.target_type) {
      items.push({ label: it.label, href: "/" });
      continue;
    }
    if (it.target_type === "category" && it.target_id) {
      const cat = await db.category.findUnique({ where: { id: it.target_id }, select: { slug: true } });
      items.push({ label: it.label, href: cat ? `/#${cat.slug}` : "/" });
      continue;
    }
    items.push({ label: it.label, href: it.target_url ?? "/" });
  }
  return items;
}

/** Menus du pied de page (footer_1..4). */
export async function getFooterMenus(): Promise<{ label: string; items: NavItem[] }[]> {
  const menus = await db.menu.findMany({
    where: { key: { startsWith: "footer" } },
    orderBy: { key: "asc" },
    include: { items: { where: { is_visible: true }, orderBy: { position: "asc" } } },
  });
  return menus.map((m) => ({
    label: m.label.replace(/^Pied de page — /, ""),
    items: m.items.map((it) => ({ label: it.label, href: it.target_url ?? "/" })),
  }));
}

export interface WeatherNow {
  city: string;
  temperature: number;
  humidity: number;
  wind: number;
  code: number;
  isDay: boolean;
}

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    weather_code?: number;
    is_day?: number;
  };
}

/** Météo réelle (Open-Meteo, sans clé) pour les villes visibles. */
export async function getWeather(): Promise<WeatherNow[]> {
  const cities = await db.weatherCity.findMany({
    where: { is_visible: true },
    orderBy: { position: "asc" },
    take: 5,
  });
  const results = await Promise.allSettled(
    cities.map(async (c) => {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${c.latitude}&longitude=${c.longitude}` +
        "&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,is_day";
      const res = await fetch(url, { next: { revalidate: 1800 } });
      if (!res.ok) throw new Error(`weather ${c.name}: ${res.status}`);
      const data = (await res.json()) as OpenMeteoResponse;
      const cur = data.current;
      if (!cur || cur.temperature_2m == null) throw new Error(`weather empty ${c.name}`);
      return {
        city: c.name,
        temperature: Math.round(cur.temperature_2m),
        humidity: Math.round(cur.relative_humidity_2m ?? 0),
        wind: Math.round(cur.wind_speed_10m ?? 0),
        code: cur.weather_code ?? 0,
        isDay: (cur.is_day ?? 1) === 1,
      } satisfies WeatherNow;
    })
  );
  return results
    .filter((r): r is PromiseFulfilledResult<WeatherNow> => r.status === "fulfilled")
    .map((r) => r.value);
}
