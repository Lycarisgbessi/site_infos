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

/** Section par rubrique : 1 vedette + liste. Les rubriques masquées
 * (is_visible=false) ou supprimées ne produisent aucune section. */
export async function getSectionArticles(categorySlug: string, count = 5): Promise<PublicArticle[]> {
  const rows = await db.article.findMany({
    where: { ...PUBLISHED, category: { slug: categorySlug, is_visible: true, deleted_at: null } },
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

export interface PublicDossier {
  id: string;
  title: string;
  lede: string | null;
  cover: { url: string; alt: string | null } | null;
}

/** Dossier à la une (Z-11). */
export async function getFeaturedDossier(): Promise<PublicDossier | null> {
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
  return toPublicDossier(d);
}

/** Dossier actif précis (bloc composeur source_type=dossier). */
export async function getDossierById(id: string): Promise<PublicDossier | null> {
  const d = await db.dossier.findFirst({
    where: { id, is_active: true, deleted_at: null },
    select: {
      id: true,
      title: true,
      lede: true,
      coverMedia: { select: { url: true, alt_text: true } },
    },
  });
  return toPublicDossier(d);
}

function toPublicDossier(
  d: { id: string; title: string; lede: string | null; coverMedia: { url: string; alt_text: string | null } | null } | null
): PublicDossier | null {
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

// ─── Régie publicitaire (régie simplifiée 2026-10) ─────────────────────

export interface PublicAdCampaign {
  creativeId: string;
  campaignId: string;
  slotCode: string;
  advertiser: string;
  name: string;
  priority: number;
  mediaKind: "image" | "gif" | "video";
  imageUrl: string | null;
  alt: string;
  videoUrl: string | null;
  clickUrl: string;
}

/** Toutes les campagnes actives d'un emplacement, triées par priorité décroissante. */
export type AdCampaignMap = Record<string, PublicAdCampaign[]>;

/** Campagnes publicitaires actives : status running + fenêtre de dates,
 * créative active, emplacement actif — triées par priorité décroissante.
 * Depuis la rotation (2026-10) : TOUTES les campagnes actives d'un slot
 * sont renvoyées (une créative principale par campagne, take 1 par weight) ;
 * le choix pondéré parmi elles se fait côté client (AdRotation). */
export async function getAdCampaigns(): Promise<AdCampaignMap> {
  const now = new Date();
  const rows = await db.adCampaign.findMany({
    where: {
      deleted_at: null,
      status: "running",
      starts_at: { lte: now },
      ends_at: { gt: now },
      creatives: { some: { is_active: true, slot: { is_active: true } } },
    },
    orderBy: { priority: "desc" },
    select: {
      id: true,
      name: true,
      priority: true,
      advertiser: { select: { name: true } },
      creatives: {
        where: { is_active: true },
        orderBy: { weight: "desc" },
        take: 1,
        select: {
          id: true,
          slot_code: true,
          type: true,
          video_url: true,
          click_url: true,
          alt_text: true,
          media: { select: { url: true, alt_text: true, mime_type: true } },
        },
      },
    },
  });

  const bySlot: AdCampaignMap = {};
  for (const row of rows) {
    const creative = row.creatives[0];
    if (!creative) continue;
    const mediaKind: PublicAdCampaign["mediaKind"] =
      creative.type === "video" || creative.video_url
        ? "video"
        : creative.media?.mime_type === "image/gif"
          ? "gif"
          : "image";
    (bySlot[creative.slot_code] ??= []).push({
      creativeId: creative.id,
      campaignId: row.id,
      slotCode: creative.slot_code,
      advertiser: row.advertiser.name,
      name: row.name,
      priority: row.priority,
      mediaKind,
      imageUrl: creative.media?.url ?? null,
      alt: creative.media?.alt_text || creative.alt_text || row.name,
      videoUrl: creative.video_url ?? null,
      clickUrl: creative.click_url,
    });
  }
  return bySlot;
}

/** Résolution groupée des cibles category/page/dossier/tag d'une liste
 * d'éléments de menu → slugs, en une requête par type (pas de N+1).
 * Les rubriques masquées (is_visible=false) ou supprimées ne sont pas
 * résolues : les éléments qui les pointent seront filtrés en amont. */
async function resolveMenuTargets(
  items: { target_type: string; target_id: string | null }[]
): Promise<Map<string, string>> {
  const idsByType = new Map<string, Set<string>>();
  for (const it of items) {
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
      ? db.category.findMany({
          where: { id: { in: [...idsByType.get("category")!] }, is_visible: true, deleted_at: null },
          select: { id: true, slug: true },
        })
      : Promise.resolve([]),
    idsByType.has("page")
      ? db.page.findMany({
          where: { id: { in: [...idsByType.get("page")!] }, deleted_at: null },
          select: { id: true, slug: true },
        })
      : Promise.resolve([]),
    idsByType.has("dossier")
      ? db.dossier.findMany({
          where: { id: { in: [...idsByType.get("dossier")!] }, deleted_at: null },
          select: { id: true, slug: true },
        })
      : Promise.resolve([]),
    idsByType.has("tag")
      ? db.tag.findMany({
          where: { id: { in: [...idsByType.get("tag")!] }, deleted_at: null },
          select: { id: true, slug: true },
        })
      : Promise.resolve([]),
  ]);
  for (const row of [...cats, ...pages, ...dossiers, ...tags]) slugById.set(row.id, row.slug);
  return slugById;
}

/** URL d'un élément de menu selon sa cible — category → /rubrique/{slug},
 * page → /pages/{slug}, dossier → /dossiers/{slug}, tag → /tags/{slug},
 * url → target_url. `null` = cible introuvable/masquée (élément filtré). */
function menuItemHref(
  it: { target_type: string; target_id: string | null; target_url: string | null },
  slugById: Map<string, string>
): string | null {
  if (it.target_type === "home" || !it.target_type) return "/";
  if (it.target_type === "url") return it.target_url ?? "/";
  const slug = it.target_id ? slugById.get(it.target_id) : undefined;
  switch (it.target_type) {
    case "category":
      return slug ? `/rubrique/${slug}` : null;
    case "page":
      return slug ? `/pages/${slug}` : "/";
    case "dossier":
      return slug ? `/dossiers/${slug}` : "/";
    case "tag":
      return slug ? `/tags/${slug}` : "/";
    default:
      return it.target_url ?? "/";
  }
}

/** Menu principal — cible category → route /rubrique/{slug} ; page/dossier/
 * tag → routes dédiées. Résolution des slugs en une requête par type
 * (pas de N+1) ; les rubriques is_visible=false sortent du menu. */
export async function getMainMenu(): Promise<NavItem[]> {
  const menu = await db.menu.findUnique({
    where: { key: "main" },
    include: { items: { where: { is_visible: true }, orderBy: { position: "asc" } } },
  });
  if (!menu) return [];

  const slugById = await resolveMenuTargets(menu.items);
  return menu.items
    .map((it) => ({ label: it.label, href: menuItemHref(it, slugById) }))
    .filter((it): it is NavItem => it.href !== null);
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

/** Menus du pied de page (footer_1..4) — cibles résolues comme le menu
 * principal (category → /rubrique/{slug}, page → /pages/{slug}, dossier →
 * /dossiers/{slug}, tag → /tags/{slug}, url → target_url). */
export async function getFooterMenus(): Promise<{ label: string; items: NavItem[] }[]> {
  const menus = await db.menu.findMany({
    where: { key: { startsWith: "footer" } },
    orderBy: { key: "asc" },
    include: { items: { where: { is_visible: true }, orderBy: { position: "asc" } } },
  });
  const slugById = await resolveMenuTargets(menus.flatMap((m) => m.items));
  return menus.map((m) => ({
    label: m.label.replace(/^Pied de page — /, ""),
    items: m.items
      .map((it) => ({ label: it.label, href: menuItemHref(it, slugById) }))
      .filter((it): it is NavItem => it.href !== null),
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
export async function getWeather(count = 5): Promise<WeatherNow[]> {
  const cities = await db.weatherCity.findMany({
    where: { is_visible: true },
    orderBy: { position: "asc" },
    take: count,
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

// ─── Composeur de la page d'accueil (homepage_blocks, §11.2) ──────────

/** Paramètres JSON d'un bloc du composeur. Les clés inconnues passent
 * telles quelles (indice de type conservé volontairement large). */
export interface HomepageBlockSettings {
  slotCode?: string;
  listKey?: string;
  count?: number;
  placement?: string;
  sidebarAd?: string;
  sidebarMostRead?: boolean;
  categorySlug?: string;
  [key: string]: unknown;
}

/** Base commune des blocs composés rendus par l'accueil. */
interface ComposedBlockBase {
  id: string;
  code: string;
  variant: string | null;
  title: string | null;
  subtitle: string | null;
  settings: HomepageBlockSettings;
}

/** Bloc composé, discriminé par type — renvoyé par getComposedHomepage(). */
export type ComposedBlock =
  | (ComposedBlockBase & { type: "section"; anchorId: string; heading: string; articles: PublicArticle[] })
  | (ComposedBlockBase & { type: "lead"; articles: PublicArticle[] })
  | (ComposedBlockBase & { type: "live"; live: { id: string; title: string } | null })
  | (ComposedBlockBase & { type: "latest"; articles: PublicArticle[]; mostRead: PublicArticle[] })
  | (ComposedBlockBase & { type: "most_read"; articles: PublicArticle[] })
  | (ComposedBlockBase & { type: "video"; articles: PublicArticle[] })
  | (ComposedBlockBase & { type: "newsletter" })
  | (ComposedBlockBase & { type: "weather"; weather: WeatherNow[] })
  | (ComposedBlockBase & { type: "dossier"; dossier: PublicDossier | null })
  | (ComposedBlockBase & { type: "world"; articles: PublicArticle[] })
  | (ComposedBlockBase & { type: "opinion"; articles: PublicArticle[] })
  | (ComposedBlockBase & { type: "ad" })
  | (ComposedBlockBase & { type: "flash" })
  | (ComposedBlockBase & { type: "unsupported"; rawType: string });

/** Alias de types de blocs utilisés par certaines références §09.1. */
const BLOCK_TYPE_ALIASES: Record<string, string> = {
  une: "lead",
  opinions: "opinion",
  monde: "world",
};

/** Compteurs par défaut des blocs (= compteurs historiques de l'accueil). */
const BLOCK_TYPE_COUNTS: Record<string, number> = {
  section: 5,
  lead: 5,
  latest: 12,
  most_read: 5,
  video: 6,
  world: 8,
  opinion: 4,
  weather: 5,
};

function normalizeBlockType(raw: string): string {
  return BLOCK_TYPE_ALIASES[raw] ?? raw;
}

function parseBlockSettings(raw: string): HomepageBlockSettings {
  try {
    const parsed: unknown = JSON.parse(raw || "{}");
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as HomepageBlockSettings;
    }
  } catch {
    // settings illisibles → bloc avec paramètres vides
  }
  return {};
}

function parseManualArticleIds(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

/** Compte effectif d'un bloc : settings.count prioritaire, puis item_count
 * du composeur, puis le compteur historique du type. */
function blockCount(itemCount: number, settings: HomepageBlockSettings, type: string): number {
  const fromSettings =
    typeof settings.count === "number" && Number.isFinite(settings.count) && settings.count > 0
      ? Math.floor(settings.count)
      : null;
  const fromBlock = Number.isFinite(itemCount) && itemCount > 0 ? itemCount : null;
  return fromSettings ?? fromBlock ?? BLOCK_TYPE_COUNTS[type] ?? 5;
}

interface VisibleCategory {
  id: string;
  slug: string;
  name: string;
}

/** Articles d'un bloc « section » selon sa source : rubrique, mot-clé,
 * sélection manuelle (ordre conservé) ou automatique (derniers publiés).
 * Les rubriques masquées (is_visible=false) ne produisent aucune section. */
async function resolveSectionArticles(
  sourceType: string | null,
  sourceId: string | null,
  manualArticleIds: string,
  category: VisibleCategory | undefined,
  count: number
): Promise<PublicArticle[]> {
  switch (sourceType) {
    case "category": {
      if (!category) return []; // rubrique introuvable ou is_visible=false
      const rows = await db.article.findMany({
        where: { ...PUBLISHED, category: { id: category.id } },
        orderBy: { published_at: "desc" },
        take: count,
        select: articleSelect,
      });
      return rows.map(toPublicArticle);
    }
    case "tag": {
      if (!sourceId) return [];
      const rows = await db.article.findMany({
        where: { ...PUBLISHED, tags: { some: { tag_id: sourceId } } },
        orderBy: { published_at: "desc" },
        take: count,
        select: articleSelect,
      });
      return rows.map(toPublicArticle);
    }
    case "manual": {
      const ids = parseManualArticleIds(manualArticleIds).slice(0, count);
      if (ids.length === 0) return [];
      const rows = await db.article.findMany({
        where: { ...PUBLISHED, id: { in: ids } },
        select: articleSelect,
      });
      const byId = new Map(rows.map((r) => [r.id, r]));
      const ordered: PublicArticle[] = [];
      for (const id of ids) {
        const row = byId.get(id);
        if (row) ordered.push(toPublicArticle(row));
      }
      return ordered;
    }
    case "auto":
    case null:
      return getLatestArticles(count);
    default:
      // source non supportée pour une section (dossier, format…) : rien
      return [];
  }
}

/**
 * Blocs actifs du composeur `/admin/homepage` (table homepage_blocks),
 * dans l'ordre position asc, fenêtre starts_at/ends_at null-safe.
 * Chaque bloc est résolu avec ses données (articles, direct, dossier,
 * météo…) via des requêtes parallèles — findMany groupés, pas de N+1.
 * Renvoie `null` quand AUCUN bloc actif n'existe (table vide, seed absent
 * ou tout désactivé) : la page applique alors son gabarit de repli.
 */
export async function getComposedHomepage(): Promise<ComposedBlock[] | null> {
  const now = new Date();
  const blocks = await db.homepageBlock.findMany({
    where: {
      is_active: true,
      locale: "fr",
      AND: [
        { OR: [{ starts_at: null }, { starts_at: { lte: now } }] },
        { OR: [{ ends_at: null }, { ends_at: { gte: now } }] },
      ],
    },
    orderBy: { position: "asc" },
  });
  if (blocks.length === 0) return null;

  const prepared = blocks.map((block) => ({
    block,
    type: normalizeBlockType(block.type),
    settings: parseBlockSettings(block.settings),
  }));

  // Pré-résolution groupée des rubriques visibles visées par les blocs
  // « section » : source_id (id, composeur) OU settings.categorySlug (slug,
  // seed §09.1) — 2 findMany groupés au lieu d'une requête par bloc.
  const categoryIds = new Set<string>();
  const categorySlugs = new Set<string>();
  for (const { block, type, settings } of prepared) {
    if (type !== "section" || block.source_type !== "category") continue;
    if (block.source_id) categoryIds.add(block.source_id);
    if (typeof settings.categorySlug === "string" && settings.categorySlug !== "") {
      categorySlugs.add(settings.categorySlug);
    }
  }
  const visibleWhere = { is_visible: true, deleted_at: null };
  const [catsById, catsBySlug] = await Promise.all([
    categoryIds.size > 0
      ? db.category.findMany({ where: { id: { in: [...categoryIds] }, ...visibleWhere }, select: { id: true, slug: true, name: true } })
      : Promise.resolve([] as VisibleCategory[]),
    categorySlugs.size > 0
      ? db.category.findMany({ where: { slug: { in: [...categorySlugs] }, ...visibleWhere }, select: { id: true, slug: true, name: true } })
      : Promise.resolve([] as VisibleCategory[]),
  ]);
  const categoryById = new Map<string, VisibleCategory>();
  const categoryBySlug = new Map<string, VisibleCategory>();
  for (const c of [...catsById, ...catsBySlug]) {
    categoryById.set(c.id, c);
    categoryBySlug.set(c.slug, c);
  }

  return Promise.all(
    prepared.map(async ({ block, type, settings }): Promise<ComposedBlock> => {
      const base = {
        id: block.id,
        code: block.code,
        variant: block.variant,
        title: block.title,
        subtitle: block.subtitle,
        settings,
      };
      const count = blockCount(block.item_count, settings, type);

      switch (type) {
        case "section": {
          const category =
            (block.source_type === "category" && block.source_id ? categoryById.get(block.source_id) : undefined) ??
            (block.source_type === "category" && typeof settings.categorySlug === "string"
              ? categoryBySlug.get(settings.categorySlug)
              : undefined);
          const articles = await resolveSectionArticles(
            block.source_type,
            block.source_id,
            block.manual_article_ids,
            category,
            count
          );
          return {
            ...base,
            type: "section" as const,
            anchorId: category?.slug ?? block.code,
            heading: block.title ?? category?.name ?? block.code,
            articles,
          };
        }
        case "lead":
          return { ...base, type: "lead" as const, articles: await getHeroArticles(count) };
        case "live":
          return { ...base, type: "live" as const, live: await getActiveLive() };
        case "latest": {
          const [articles, mostRead] = await Promise.all([
            getLatestArticles(count),
            settings.sidebarMostRead === true ? getMostReadArticles(BLOCK_TYPE_COUNTS.most_read) : Promise.resolve([] as PublicArticle[]),
          ]);
          return { ...base, type: "latest" as const, articles, mostRead };
        }
        case "most_read":
          return { ...base, type: "most_read" as const, articles: await getMostReadArticles(count) };
        case "video":
          return { ...base, type: "video" as const, articles: await getVideoArticles(count) };
        case "newsletter":
          return { ...base, type: "newsletter" as const };
        case "weather":
          return { ...base, type: "weather" as const, weather: await getWeather(count) };
        case "dossier":
          return {
            ...base,
            type: "dossier" as const,
            dossier:
              block.source_type === "dossier" && block.source_id
                ? await getDossierById(block.source_id)
                : await getFeaturedDossier(),
          };
        case "world":
          return { ...base, type: "world" as const, articles: await getWorldArticles(count) };
        case "opinion":
          return { ...base, type: "opinion" as const, articles: await getOpinionArticles(count) };
        case "ad":
          return { ...base, type: "ad" as const };
        case "flash":
          return { ...base, type: "flash" as const };
        default:
          return { ...base, type: "unsupported" as const, rawType: block.type };
      }
    })
  );
}
