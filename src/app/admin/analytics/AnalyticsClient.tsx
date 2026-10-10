"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BarChart3, CalendarDays, Eye, FileText, TrendingUp } from "lucide-react";

import type {
  AnalyticsOverview,
  AnalyticsPeriod,
} from "@/server/services/analytics";

/**
 * Statistiques (§11.2 /admin/analytics) : cartes indicateurs, graphique
 * SVG pur (polyline + aire, tooltip au survol), top articles avec barres
 * proportionnelles, sélecteur de période 7/30/90 jours (paramètre ?days=).
 */

const PERIODS: { value: AnalyticsPeriod; label: string }[] = [
  { value: 7, label: "7 jours" },
  { value: 30, label: "30 jours" },
  { value: 90, label: "90 jours" },
];

function formatDay(day: string): string {
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

// ─── Graphique SVG pur ────────────────────────────────────────────────

function ViewsChart({ series }: { series: AnalyticsOverview["dailySeries"] }) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 720;
  const H = 220;
  const PAD = { top: 12, right: 8, bottom: 24, left: 34 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = series.length;
  const max = Math.max(1, ...series.map((p) => p.views));

  const x = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;

  const points = series.map((p, i) => `${x(i)},${y(p.views)}`).join(" ");
  const areaPath = `M ${x(0)},${PAD.top + innerH} L ${series
    .map((p, i) => `${x(i)},${y(p.views)}`)
    .join(" L ")} L ${x(n - 1)},${PAD.top + innerH} Z`;

  const gridValues = [0, max / 2, max];
  const hovered = hover !== null ? series[hover] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-56 w-full"
        role="img"
        aria-label="Vues par jour"
        preserveAspectRatio="none"
      >
        {/* Grille horizontale */}
        {gridValues.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              className="stroke-rule"
              strokeWidth={1}
              strokeDasharray={i === 0 ? undefined : "3 3"}
            />
            <text x={4} y={y(v) + 4} className="fill-current text-[10px] text-ink-faint">
              {Math.round(v)}
            </text>
          </g>
        ))}

        {/* Aire + courbe */}
        <path d={areaPath} className="fill-brand-red/10" />
        <polyline
          points={points}
          fill="none"
          className="stroke-brand-red"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Zones de survol + points */}
        {series.map((p, i) => (
          <g key={p.day}>
            {hover === i && (
              <line
                x1={x(i)}
                x2={x(i)}
                y1={PAD.top}
                y2={PAD.top + innerH}
                className="stroke-rule"
                strokeWidth={1}
              />
            )}
            <circle
              cx={x(i)}
              cy={y(p.views)}
              r={hover === i ? 4 : 2.5}
              className="fill-brand-red"
            />
            <rect
              x={x(i) - innerW / (2 * Math.max(1, n - 1))}
              y={PAD.top}
              width={Math.max(6, innerW / Math.max(1, n - 1))}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          </g>
        ))}

        {/* Repères de dates (premier / dernier) */}
        {n > 1 && (
          <>
            <text x={PAD.left} y={H - 6} className="fill-current text-[10px] text-ink-faint">
              {formatDay(series[0].day)}
            </text>
            <text
              x={W - PAD.right}
              y={H - 6}
              textAnchor="end"
              className="fill-current text-[10px] text-ink-faint"
            >
              {formatDay(series[n - 1].day)}
            </text>
          </>
        )}
      </svg>

      {hovered && (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-sm border border-rule bg-paper px-3 py-1.5 text-xs shadow-sm">
          <span className="font-semibold text-ink">{formatDay(hovered.day)}</span>
          <span className="ml-2 text-ink-soft">
            {formatNumber(hovered.views)} vue{hovered.views > 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────

export function AnalyticsClient({ overview }: { overview: AnalyticsOverview }) {
  const maxTop = useMemo(
    () => Math.max(1, ...overview.topArticles.map((a) => a.views)),
    [overview.topArticles]
  );
  const max7d = useMemo(
    () => Math.max(1, ...overview.topArticles7d.map((a) => a.views)),
    [overview.topArticles7d]
  );
  const typeTotal = Math.max(
    1,
    overview.typeSplit.article + overview.typeSplit.video + overview.typeSplit.other
  );

  const cards = [
    {
      icon: Eye,
      label: `Vues (${overview.days} jours)`,
      value: formatNumber(overview.totalViews),
    },
    { icon: CalendarDays, label: "Vues aujourd'hui", value: formatNumber(overview.viewsToday) },
    {
      icon: TrendingUp,
      label: "Moyenne par jour",
      value: formatNumber(overview.averagePerDay).replace(/\.(\d)$/, ",$1"),
    },
    { icon: FileText, label: "Articles publiés", value: formatNumber(overview.publishedArticles) },
  ];

  return (
    <div className="space-y-6">
      {/* Sélecteur de période */}
      <div className="flex flex-wrap items-center gap-2">
        <BarChart3 className="size-4 text-ink-faint" aria-hidden />
        {PERIODS.map((p) => (
          <Link
            key={p.value}
            href={`/admin/analytics?days=${p.value}`}
            className={`rounded-sm border px-3 py-1.5 text-xs font-semibold transition-colors ${
              p.value === overview.days
                ? "border-ink bg-ink text-paper"
                : "border-rule bg-paper text-ink-soft hover:border-ink"
            }`}
            aria-current={p.value === overview.days ? "page" : undefined}
          >
            {p.label}
          </Link>
        ))}
      </div>

      {/* Cartes indicateurs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-sm border border-rule bg-paper-alt p-4">
            <div className="flex items-center gap-2 text-ink-faint">
              <c.icon className="size-4" aria-hidden />
              <span className="text-xs font-semibold uppercase tracking-wide">{c.label}</span>
            </div>
            <p className="mt-2 font-serif text-2xl font-bold text-ink">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Graphique des vues par jour */}
      <section className="rounded-sm border border-rule bg-paper p-4" aria-label="Vues par jour">
        <h2 className="font-serif text-lg font-bold text-ink">Vues par jour</h2>
        <p className="mb-3 text-xs text-ink-faint">
          Survolez la courbe pour afficher le détail d&apos;une journée.
        </p>
        <ViewsChart series={overview.dailySeries} />
      </section>

      {/* Répartition par type */}
      <section className="rounded-sm border border-rule bg-paper p-4" aria-label="Répartition par type">
        <h2 className="font-serif text-lg font-bold text-ink">Répartition par type</h2>
        <div className="mt-3 space-y-2 text-sm">
          {(
            [
              ["Articles", overview.typeSplit.article, "bg-brand-red"],
              ["Vidéos", overview.typeSplit.video, "bg-ink"],
              ["Autres pages", overview.typeSplit.other, "bg-ink-faint"],
            ] as const
          ).map(([label, value, color]) => (
            <div key={label} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-ink-soft">{label}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-sm bg-paper-alt">
                <div
                  className={`h-full ${color}`}
                  style={{ width: `${Math.round((value / typeTotal) * 100)}%` }}
                />
              </div>
              <span className="w-24 shrink-0 text-right text-xs text-ink-faint">
                {formatNumber(value)} ({Math.round((value / typeTotal) * 100)} %)
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Top articles (période) */}
      <section className="rounded-sm border border-rule bg-paper p-4" aria-label="Articles les plus lus">
        <h2 className="font-serif text-lg font-bold text-ink">
          Articles les plus lus ({overview.days} jours)
        </h2>
        {overview.topArticles.length === 0 ? (
          <p className="mt-3 text-sm text-ink-faint">Aucune vue enregistrée sur la période.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {overview.topArticles.map((a, i) => (
              <li key={a.articleId} className="flex items-center gap-3">
                <span className="w-6 shrink-0 text-right font-serif text-sm font-bold text-ink-faint">
                  {i + 1}.
                </span>
                <div className="min-w-0 flex-1">
                  <a
                    href={`/article/${a.slug}`}
                    className="block truncate text-sm font-semibold text-ink hover:text-brand-red"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {a.title}
                  </a>
                  <div className="mt-1 h-2 overflow-hidden rounded-sm bg-paper-alt">
                    <div
                      className="h-full bg-brand-red"
                      style={{ width: `${Math.round((a.views / maxTop) * 100)}%` }}
                    />
                  </div>
                </div>
                <span className="w-20 shrink-0 text-right text-xs font-semibold text-ink-soft">
                  {formatNumber(a.views)} vue{a.views > 1 ? "s" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Top 5 des 7 derniers jours */}
      <section
        className="rounded-sm border border-rule bg-paper p-4"
        aria-label="Tendances des 7 derniers jours"
      >
        <h2 className="font-serif text-lg font-bold text-ink">Tendances — 7 derniers jours</h2>
        {overview.topArticles7d.length === 0 ? (
          <p className="mt-3 text-sm text-ink-faint">Aucune vue enregistrée cette semaine.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {overview.topArticles7d.map((a, i) => (
              <li key={a.articleId} className="flex items-center gap-3">
                <span className="w-6 shrink-0 text-right font-serif text-sm font-bold text-ink-faint">
                  {i + 1}.
                </span>
                <div className="min-w-0 flex-1">
                  <a
                    href={`/article/${a.slug}`}
                    className="block truncate text-sm font-semibold text-ink hover:text-brand-red"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {a.title}
                  </a>
                  <div className="mt-1 h-2 overflow-hidden rounded-sm bg-paper-alt">
                    <div
                      className="h-full bg-ink"
                      style={{ width: `${Math.round((a.views / max7d) * 100)}%` }}
                    />
                  </div>
                </div>
                <span className="w-20 shrink-0 text-right text-xs font-semibold text-ink-soft">
                  {formatNumber(a.views)} vue{a.views > 1 ? "s" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
