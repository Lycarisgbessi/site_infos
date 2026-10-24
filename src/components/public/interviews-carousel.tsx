"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PublicArticle } from "@/lib/public/homepage-data";

/**
 * Carrousel « Interviews » — balayage automatique qui fait REVENIR les
 * anciennes interviews : défilement continu du plus récent au plus ancien,
 * glissière animée, flèches + pastilles, pause au survol. Format badge
 * vidéo/audio/texte selon le contenu de l'interview.
 */

export interface InterviewLabels {
  kicker: string;
  watch: string;
  listen: string;
  read: string;
  prev: string;
  next: string;
}

const SLIDE_MS = 6000;
const FADE_MS = 450;

function mediaKindOf(a: PublicArticle): "video" | "audio" | "text" {
  if (a.videoPreview) return "video";
  return "text";
}

export function InterviewsCarousel({
  interviews,
  labels,
}: {
  interviews: PublicArticle[];
  labels: InterviewLabels;
}) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const paused = useRef(false);
  const touchStartX = useRef<number | null>(null);

  const count = interviews.length;

  const go = (next: number) => {
    setVisible(false);
    window.setTimeout(() => {
      setIndex(((next % count) + count) % count);
      setVisible(true);
    }, FADE_MS);
  };

  useEffect(() => {
    if (count < 2) return;
    const timer = window.setInterval(() => {
      if (paused.current || document.hidden) return;
      go(index + 1);
    }, SLIDE_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, count]);

  if (count === 0) return null;
  const a = interviews[Math.min(index, count - 1)];
  const kind = mediaKindOf(a);
  const ctaLabel = kind === "video" ? labels.watch : labels.read;
  const intl = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

  return (
    <section
      aria-label={labels.kicker}
      className="relative overflow-hidden border border-rule bg-paper"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onTouchStart={(e) => (touchStartX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) > 48) go(index + (dx < 0 ? 1 : -1));
        touchStartX.current = null;
      }}
    >
      {/* En-tête */}
      <header className="flex items-center justify-between border-b-2 border-brand-red px-4 pb-2 pt-3">
        <div className="flex items-center gap-2">
          <svg aria-hidden viewBox="0 0 24 24" className="size-4 text-brand-red" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <path d="M8 9h8M8 13h5" />
          </svg>
          <h2 className="kicker text-base font-bold text-brand-red">{labels.kicker}</h2>
        </div>
        <div className="flex items-center gap-2">
          {count > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(index - 1)}
                aria-label={labels.prev}
                className="press flex size-8 items-center justify-center rounded-full border border-rule text-ink-soft transition-colors duration-200 hover:border-brand-red hover:text-brand-red"
              >
                <svg aria-hidden viewBox="0 0 16 16" className="size-4 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 3L5 8l5 5" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => go(index + 1)}
                aria-label={labels.next}
                className="press flex size-8 items-center justify-center rounded-full border border-rule text-ink-soft transition-colors duration-200 hover:border-brand-red hover:text-brand-red"
              >
                <svg aria-hidden viewBox="0 0 16 16" className="size-4 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 3l5 5-5 5" />
                </svg>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Glissière */}
      <Link
        href={`/article/${a.slug}`}
        className="group block"
        aria-label={a.title}
      >
        <div
          className="ad-slide grid gap-0 transition-all duration-500 sm:grid-cols-[2fr_3fr]"
          style={{ opacity: visible ? 1 : 0, transform: visible ? "translateX(0)" : "translateX(5%)" }}
        >
          {/* Couverture */}
          <div className="relative aspect-[16/10] overflow-hidden sm:aspect-auto sm:min-h-[13rem]">
            {a.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={a.cover.url}
                alt={a.cover.alt ?? a.title}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-brand-red to-orange-500" />
            )}
            {a.videoPreview && (
              <span className="absolute bottom-2 end-2 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-white backdrop-blur">
                <svg aria-hidden viewBox="0 0 24 24" className="size-3" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                {labels.watch}
              </span>
            )}
          </div>

          {/* Contenu */}
          <div className="flex flex-col justify-center p-5">
            <p className="kicker flex items-center gap-2 text-brand-red" style={a.category?.colorAccent ? { color: a.category.colorAccent } : undefined}>
              <span aria-hidden className="inline-block h-3 w-1 rounded-full" style={{ background: a.category?.colorAccent ?? "var(--brand-red)" }} />
              {a.category?.name ?? labels.kicker}
            </p>
            <h3 className="title-underline mt-2 inline-block font-serif text-lg font-black leading-snug tracking-tight transition-colors duration-200 group-hover:text-brand-red md:text-xl">
              {a.title}
            </h3>
            {a.lede && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-soft">{a.lede}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-faint">
              {a.publishedAt && <span>{intl.format(a.publishedAt)}</span>}
              <span aria-hidden>·</span>
              <span>{a.readingTimeMin} min</span>
              <span className="press mt-1 inline-flex items-center gap-1 rounded-full bg-brand-red px-3 py-1 font-bold uppercase tracking-widest text-white shadow-sm transition-colors duration-200 hover:bg-red-deep">
                {ctaLabel} →
              </span>
            </div>
          </div>
        </div>
      </Link>

      {/* Pastilles de progression */}
      {count > 1 && (
        <div className="absolute bottom-2 end-4 z-10 flex gap-1.5">
          {interviews.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1}`}
              onClick={(e) => {
                e.preventDefault();
                go(i);
              }}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index ? "w-4 bg-brand-red" : "w-1.5 bg-rule-strong hover:bg-brand-red/60"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
