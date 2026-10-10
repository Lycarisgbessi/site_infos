import { headers } from "next/headers";
import { db } from "@/lib/db";

/**
 * Service statistiques (§11.2 /admin/analytics) : suivi des vues de pages
 * publiques (modèle PageView → table page_views) et agrégats du tableau de
 * bord. Le modèle ArticleDailyStat existe au schéma mais n'est pas encore
 * alimenté (agrégats horaires à venir) — la source de vérité reste
 * page_views.
 *
 * Anti-doublonnage simple : même chemin + même hash visiteur dans les
 * 30 minutes → vue ignorée (requête count préalable).
 * Fire-and-forget : aucune erreur d'écriture ne doit faire échouer le
 * rendu d'une page publique.
 */

/** Fenêtre anti-doublonnage (30 minutes). */
const DEDUP_WINDOW_MS = 30 * 60 * 1000;

/** Périodes autorisées pour le tableau de bord. */
export const ANALYTICS_PERIODS = [7, 30, 90] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export function parsePeriod(value: string | undefined): AnalyticsPeriod {
  const n = Number(value);
  if ((ANALYTICS_PERIODS as readonly number[]).includes(n)) {
    return n as AnalyticsPeriod;
  }
  return 30;
}

// ─── Suivi des vues ────────────────────────────────────────────────────

/** Hash léger (FNV-1a, hexadécimal) — pas de stockage d'UA en clair. */
function lightHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export interface TrackPageViewInput {
  path: string;
  articleId?: string | null;
}

/**
 * Enregistre une PageView à partir des en-têtes de la requête courante
 * (user-agent hashé, hôte référent). Anti-doublonnage 30 min.
 * Ne lève jamais : en cas d'échec DB la vue est simplement perdue.
 */
export async function trackPageView({ path, articleId }: TrackPageViewInput): Promise<void> {
  try {
    const h = await headers();
    const userAgent = h.get("user-agent") ?? "";
    const visitorHash = lightHash(userAgent);

    let referrerHost: string | null = null;
    const referer = h.get("referer");
    if (referer) {
      try {
        referrerHost = new URL(referer).hostname;
      } catch {
        // référent malformé : ignoré
      }
    }

    const since = new Date(Date.now() - DEDUP_WINDOW_MS);
    const duplicate = await db.pageView.count({
      where: {
        path,
        visitor_hash: visitorHash,
        occurred_at: { gt: since },
      },
    });
    if (duplicate > 0) return;

    await db.pageView.create({
      data: {
        path,
        article_id: articleId ?? null,
        visitor_hash: visitorHash,
        referrer_host: referrerHost,
      },
    });
  } catch {
    // Fire-and-forget : jamais faire échouer le rendu de la page.
  }
}

// ─── Agrégats du tableau de bord ───────────────────────────────────────

export interface AnalyticsTopArticle {
  articleId: string;
  title: string;
  slug: string;
  views: number;
}

export interface AnalyticsDailyPoint {
  /** « AAAA-MM-JJ » */
  day: string;
  views: number;
}

export interface AnalyticsTypeSplit {
  article: number;
  video: number;
  other: number;
}

export interface AnalyticsOverview {
  days: AnalyticsPeriod;
  totalViews: number;
  viewsToday: number;
  averagePerDay: number;
  publishedArticles: number;
  topArticles: AnalyticsTopArticle[];
  dailySeries: AnalyticsDailyPoint[];
  typeSplit: AnalyticsTypeSplit;
  topArticles7d: AnalyticsTopArticle[];
}

function toNumber(value: bigint | number | null | undefined): number {
  return Number(value ?? 0);
}

function dayKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Début de journée UTC d'une date. */
function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function topArticlesByViews(since: Date, take: number): Promise<AnalyticsTopArticle[]> {
  const grouped = await db.pageView.groupBy({
    by: ["article_id"],
    where: { article_id: { not: null }, occurred_at: { gte: since } },
    _count: { _all: true },
    orderBy: { _count: { article_id: "desc" } },
    take,
  });
  if (grouped.length === 0) return [];

  const ids = grouped.map((g) => g.article_id!).filter((id): id is string => id !== null);
  const articles = await db.article.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true, slug: true },
  });
  const byId = new Map(articles.map((a) => [a.id, a]));
  const viewsById = new Map(grouped.map((g) => [g.article_id!, toNumber(g._count._all)]));

  return ids
    .map((id) => {
      const article = byId.get(id);
      if (!article) return null;
      return {
        articleId: id,
        title: article.title,
        slug: article.slug,
        views: viewsById.get(id) ?? 0,
      };
    })
    .filter((a): a is AnalyticsTopArticle => a !== null)
    .sort((a, b) => b.views - a.views);
}

export async function getAnalyticsOverview(days: AnalyticsPeriod = 30): Promise<AnalyticsOverview> {
  const now = new Date();
  const todayStart = startOfUtcDay(now);
  const periodStart = new Date(todayStart);
  periodStart.setUTCDate(periodStart.getUTCDate() - (days - 1));
  const week7Start = new Date(todayStart);
  week7Start.setUTCDate(week7Start.getUTCDate() - 6);

  const periodWhere = { occurred_at: { gte: periodStart } };

  const [totalViews, viewsToday, publishedArticles, dailyGrouped, topArticles, topArticles7d] =
    await Promise.all([
      db.pageView.count({ where: periodWhere }),
      db.pageView.count({ where: { occurred_at: { gte: todayStart } } }),
      db.article.count({ where: { deleted_at: null, status: "published" } }),
      db.pageView.groupBy({
        by: ["path"],
        where: periodWhere,
        _count: { _all: true },
      }),
      topArticlesByViews(periodStart, 10),
      topArticlesByViews(week7Start, 5),
    ]);

  // Série quotidienne : agrégation JS depuis les chemins groupés impossible
  // (pas de date dans le groupBy) → requête SQL date_trunc côté jour UTC.
  const dailyRows: { day: Date; views: bigint }[] = await db.$queryRaw`
    SELECT date_trunc('day', occurred_at) AS day, COUNT(*)::bigint AS views
    FROM page_views
    WHERE occurred_at >= ${periodStart}
    GROUP BY 1
    ORDER BY 1
  `;
  const viewsByDay = new Map(dailyRows.map((r) => [dayKey(new Date(r.day)), toNumber(r.views)]));
  const dailySeries: AnalyticsDailyPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(periodStart);
    d.setUTCDate(d.getUTCDate() + i);
    const key = dayKey(d);
    dailySeries.push({ day: key, views: viewsByDay.get(key) ?? 0 });
  }

  // Répartition par type : discriminateur = préfixe du chemin.
  const typeSplit: AnalyticsTypeSplit = { article: 0, video: 0, other: 0 };
  for (const row of dailyGrouped) {
    const views = toNumber(row._count._all);
    if (row.path.startsWith("/article/")) typeSplit.article += views;
    else if (row.path.startsWith("/video/")) typeSplit.video += views;
    else typeSplit.other += views;
  }

  return {
    days,
    totalViews,
    viewsToday,
    averagePerDay: Math.round((totalViews / days) * 10) / 10,
    publishedArticles,
    topArticles,
    dailySeries,
    typeSplit,
    topArticles7d,
  };
}
