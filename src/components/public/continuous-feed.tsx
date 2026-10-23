"use client";

import Link from "next/link";

/**
 * Fil « En continu » — marquee VERTICAL automatique (aucune manipulation
 * requise) : piste dupliquée ×2 + translation Y de -50 % en boucle sans
 * rupture, pause au survol/focus. Aucune scrollbar, jamais : le conteneur
 * est en overflow hidden, le mouvement est porté par la transformation.
 * En prefers-reduced-motion : liste statique complète.
 */

export interface ContinuousFeedItem {
  id: string;
  title: string;
  shortTitle?: string | null;
  slug: string;
  category: string | null;
  timeAgo: string;
}

function FeedRow({ item, index, ariaHidden }: { item: ContinuousFeedItem; index: number; ariaHidden?: boolean }) {
  return (
    <Link
      href={`/article/${item.slug}`}
      tabIndex={ariaHidden ? -1 : undefined}
      aria-hidden={ariaHidden}
      className="group flex items-start gap-3 border-b border-rule px-2 py-3 transition-colors duration-200 hover:bg-red-wash/30"
    >
      <span
        aria-hidden
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm bg-brand-red font-mono text-[0.7rem] font-bold text-white transition-transform duration-200 group-hover:scale-110"
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      <span className="min-w-0">
        <span className="line-clamp-2 block text-sm font-bold leading-snug text-ink transition-colors duration-200 group-hover:text-brand-red">
          {item.shortTitle ?? item.title}
        </span>
        <span className="mt-0.5 block text-[0.65rem] uppercase tracking-wide text-ink-faint">
          {item.category} · {item.timeAgo}
        </span>
      </span>
    </Link>
  );
}

export function ContinuousFeed({
  items,
  labels,
}: {
  items: ContinuousFeedItem[];
  labels: { all: string };
}) {
  if (items.length === 0) return null;

  // Durée proportionnelle au volume : lecture confortable (~3,5 s / item).
  const duration = `${Math.max(28, items.length * 35)}s`;

  return (
    <div
      role="feed"
      aria-label={labels.all}
      className="vmarquee-viewport group/feed relative overflow-hidden"
    >
      {/* Fondu haut/bas pour marquer le mouvement */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-paper-alt to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-gradient-to-t from-paper-alt to-transparent" />

      <div className="vmarquee-track" style={{ "--vmarquee-duration": duration } as React.CSSProperties}>
        <div>
          {items.map((a, i) => (
            <FeedRow key={`v-${a.id}`} item={a} index={i} />
          ))}
        </div>
        <div aria-hidden>
          {items.map((a, i) => (
            <FeedRow key={`h-${a.id}`} item={a} index={i} ariaHidden />
          ))}
        </div>
      </div>
    </div>
  );
}
