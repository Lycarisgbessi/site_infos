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

/** Articles de la une — composeur featured_slots (home_lead + home_secondary).
 * Respecte pinned, fenêtre starts_at/ends_at, override_title et
 * override_media_id ; complète avec les articles récents si moins de
 * slots actifs que demandé, au lieu d'ignorer la une. */
export async function getHeroArticles(count = 5): Promise<PublicArticle[]> {
  const now = new Date();
  const allSlots = await db.featuredSlot.findMany({
    where: {
      zone: { in: ["home_lead", "home_secondary"] },
      AND: [
        { OR: [{ starts_at: null }, { starts_at: { lte: now } }] },
        { OR: [{ ends_at: null }, { ends_at: { gte: now } }] },
      ],
    },
    orderBy: [{ pinned: "desc" }, { position: "asc" }],
  });
  const slots = allSlots.slice(0, count);
  const ids = slots.map((s) => s.article_id);

  const rows =
    ids.length > 0
      ? await db.article.findMany({ where: { id: { in: ids }, ...PUBLISHED }, select: articleSelect })
      : [];
  const byId = new Map(rows.map((r) => [r.id, r]));

  // Médias de remplacement (override_media_id)
  const overrideMediaIds = slots.map((s) => s.override_media_id).filter((v): v is string => Boolean(v));
  const overrideMediaById = new Map(
    overrideMediaIds.length > 0
      ? (
          await db.media.findMany({
            where: { id: { in: overrideMediaIds } },
            select: { id: true, url: true, alt_text: true, credit: true, width: true, height: true },
          })
        ).map((m) => [m.id, m])
      : [],
  );

  const slotById = new Map(slots.map((s) => [s.article_id, s]));
  const hero: PublicArticle[] = [];
  for (const slot of slots) {
    const row = byId.get(slot.article_id);
    if (!row) continue;
    const article = toPublicArticle(row);
    const slotData = slotById.get(slot.article_id);
    if (slotData?.override_title) article.title = slotData.override_title;
    const overrideMedia = slotData?.override_media_id ? overrideMediaById.get(slotData.override_media_id) : undefined;
    if (overrideMedia) {
      article.cover = {
        url: overrideMedia.url,
        alt: overrideMedia.alt_text,
        credit: overrideMedia.credit,
        width: overrideMedia.width,
        height: overrideMedia.height,
      };
    }
    hero.push(article);
  }

  // Complétion avec les articles récents par importance (jamais de une vide).
  if (hero.length < count) {
    const excludeIds = new Set(hero.map((a) => a.id));
    const filler = await db.article.findMany({
      where: { ...PUBLISHED, id: { notIn: [...excludeIds] } },
      orderBy: [{ importance: "asc" }, { published_at: "desc" }],
      take: count - hero.length,
      select: articleSelect,
    });
    hero.push(...filler.map(toPublicArticle));
  }
  return hero;
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

export interface FlashItemView {
  id: string;
  text: string;
  priority: number;
  articleSlug: string | null;
  externalUrl: string | null;
}

/** Flash info : flashes manuels actifs (non expirés) ; sinon, automatiquement,
 * les derniers articles publiés (5-8) servent d'items de flash. */
export async function getFlashItems(): Promise<FlashItemView[]> {
  const now = new Date();
  const rows = await db.flashNews.findMany({
    where: { deleted_at: null, expires_at: { gt: now } },
    orderBy: [{ priority: "asc" }, { published_at: "desc" }],
    take: 10,
    select: { id: true, text: true, priority: true, article_id: true, external_url: true },
  });

  const manual: FlashItemView[] = [];
  const missingSlug: { index: number; articleId: string }[] = [];
  rows.forEach((r, index) => {
    if (r.article_id) missingSlug.push({ index, articleId: r.article_id });
    manual.push({
      id: r.id,
      text: r.text,
      priority: r.priority,
      articleSlug: null,
      externalUrl: r.external_url,
    });
  });
  if (missingSlug.length > 0) {
    const arts = await db.article.findMany({
      where: { id: { in: missingSlug.map((m) => m.articleId) }, ...PUBLISHED },
      select: { id: true, slug: true },
    });
    const slugById = new Map(arts.map((a) => [a.id, a.slug]));
    for (const m of missingSlug) manual[m.index].articleSlug = slugById.get(m.articleId) ?? null;
  }
  if (manual.length > 0) return manual;

  // Flash auto : 5 à 8 derniers articles publiés.
  const latest = await db.article.findMany({
    where: PUBLISHED,
    orderBy: { published_at: "desc" },
    take: 8,
    select: { id: true, slug: true, title: true, published_at: true },
  });
  return latest.map((a) => ({
    id: a.id,
    text: a.title,
    priority: 3,
    articleSlug: a.slug,
    externalUrl: null,
  }));
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

/** Reportages vidéo (Z-08) : format vidéo OU bloc vidéo dans le corps. */
export async function getVideoArticles(count = 6): Promise<PublicArticle[]> {
  const rows = await db.article.findMany({
    where: {
      ...PUBLISHED,
      OR: [{ format: "video" }, { body: { contains: '"type":"video"' } }, { body: { contains: '"type": "video"' } }],
    },
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

/** Menu principal — cible category → ancre de section sur l'accueil ;
 * page/dossier/tag → routes dédiées. Résolution des slugs en une requête
 * par type (pas de N+1). */
export async function getMainMenu(): Promise<NavItem[]> {
  const menu = await db.menu.findUnique({
    where: { key: "main" },
    include: { items: { where: { is_visible: true }, orderBy: { position: "asc" } } },
  });
  if (!menu) return [];

  const idsByType = new Map<string, Set<string>>();
  for (const it of menu.items) {
    if (!it.target_id) continue;
    if (["category", "page", "dossier", "tag"].includes(it.target_type)) {
      const set = idsByType.get(it.target_type) ?? new Set<string>();
      set.add(it.target_id);
      idsByType.set(it.target_type, set);
    }
  }

  const slugById = new Map<string, string>();
  const [cats, pages, dossiers, tags] = await Promise.all([
    idsByType.has("category")
      ? db.category.findMany({ where: { id: { in: [...idsByType.get("category")!] } }, select: { id: true, slug: true } })
      : Promise.resolve([]),
    idsByType.has("page")
      ? db.page.findMany({ where: { id: { in: [...idsByType.get("page")!] } }, select: { id: true, slug: true } })
      : Promise.resolve([]),
    idsByType.has("dossier")
      ? db.dossier.findMany({ where: { id: { in: [...idsByType.get("dossier")!] } }, select: { id: true, slug: true } })
      : Promise.resolve([]),
    idsByType.has("tag")
      ? db.tag.findMany({ where: { id: { in: [...idsByType.get("tag")!] } }, select: { id: true, slug: true } })
      : Promise.resolve([]),
  ]);
  for (const row of [...cats, ...pages, ...dossiers, ...tags]) slugById.set(row.id, row.slug);

  return menu.items.map((it) => {
    if (it.target_type === "home" || !it.target_type) {
      return { label: it.label, href: "/" };
    }
    const slug = it.target_id ? slugById.get(it.target_id) : undefined;
    switch (it.target_type) {
      case "category":
        return { label: it.label, href: slug ? `/#${slug}` : "/" };
      case "page":
        return { label: it.label, href: slug ? `/pages/${slug}` : "/" };
      case "dossier":
        return { label: it.label, href: slug ? `/dossiers/${slug}` : "/" };
      case "tag":
        return { label: it.label, href: slug ? `/tags/${slug}` : "/" };
      default:
        return { label: it.label, href: it.target_url ?? "/" };
    }
  });
}

export interface SiteBannerView {
  id: string;
  message: string;
  linkUrl: string | null;
  linkLabel: string | null;
  style: string;
  isDismissible: boolean;
}

/** Bandeaux du site actifs : is_active + fenêtre de dates + chemins ciblés. */
export async function getSiteBanners(path = "/"): Promise<SiteBannerView[]> {
  const now = new Date();
  const rows = await db.siteBanner.findMany({
    where: {
      is_active: true,
      AND: [
        { OR: [{ starts_at: null }, { starts_at: { lte: now } }] },
        { OR: [{ ends_at: null }, { ends_at: { gte: now } }] },
      ],
    },
    orderBy: { starts_at: "asc" },
    take: 5,
  });

  const pathMatches = (patternsJson: string): boolean => {
    try {
      const patterns = JSON.parse(patternsJson);
      if (!Array.isArray(patterns)) return false;
      return patterns.some((p) => {
        if (typeof p !== "string") return false;
        if (p === "/*" || p === "*" || p === path) return true;
        if (p.endsWith("/*")) return path.startsWith(p.slice(0, -1));
        return false;
      });
    } catch {
      return false;
    }
  };

  return rows
    .filter((r) => pathMatches(r.target_paths))
    .map((r) => ({
      id: r.id,
      message: r.message,
      linkUrl: r.link_url,
      linkLabel: r.link_label,
      style: r.style,
      isDismissible: r.is_dismissible,
    }));
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
