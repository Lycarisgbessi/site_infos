"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

/**
 * Fil « En continu » — auto-défilement vertical doux qui attire l'œil :
 * avance d'un item toutes les 4 s, pause au survol/focus, et défilement
 * manuel naturel (molette/tactile) toujours possible — sans piège au
 * scroll : le conteneur ne bloque jamais la molette de la page.
 */

export interface ContinuousFeedItem {
  id: string;
  title: string;
  shortTitle?: string | null;
  slug: string;
  category: string | null;
  timeAgo: string;
}

export function ContinuousFeed({
  items,
  labels,
}: {
  items: ContinuousFeedItem[];
  labels: { all: string };
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || items.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let index = 0;
    const timer = window.setInterval(() => {
      if (pausedRef.current || document.hidden) return;
      const viewport2 = viewportRef.current;
      if (!viewport2) return;
      index += 1;
      if (index >= items.length) {
        index = 0;
        viewport2.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const child = viewport2.children[index] as HTMLElement | undefined;
      if (child) viewport2.scrollTo({ top: child.offsetTop - viewport2.offsetTop, behavior: "smooth" });
    }, 4000);

    return () => window.clearInterval(timer);
  }, [items.length]);

  if (items.length === 0) return null;

  return (
    <div
      ref={viewportRef}
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
      onFocusCapture={() => (pausedRef.current = true)}
      onBlurCapture={() => (pausedRef.current = false)}
      className="scrollbar-none max-h-[28rem] divide-y divide-rule overflow-y-auto overscroll-contain"
      role="feed"
      aria-label={labels.all}
      tabIndex={0}
    >
      {items.map((a, i) => (
        <Link key={a.id} href={`/article/${a.slug}`} className="group flex gap-3 py-2.5">
          <span
            aria-hidden
            className="w-6 shrink-0 font-mono text-sm font-bold text-rule-strong transition-colors duration-200 group-hover:text-brand-red"
          >
            {String(i + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug transition-colors duration-200 group-hover:text-brand-red">
              {a.shortTitle ?? a.title}
            </h3>
            <p className="mt-0.5 text-[0.65rem] uppercase tracking-wide text-ink-faint">
              {a.category} · {a.timeAgo}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
