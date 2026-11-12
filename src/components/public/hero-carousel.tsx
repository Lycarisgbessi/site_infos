"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * Carrousel « À la une » — CINÉMATIQUE :
 *  - glissement directionnel réel (l'ancienne slide sort pendant que la
 *    nouvelle entre — plus de simple fondu) ;
 *  - ken-burns lent sur chaque couverture (zoom/panoramique 8 s) ;
 *  - texte en cascade (badge → titre → chapô → méta, montée + flou) ;
 *  - barre de progression animée (remplissage = temps restant, pause
 *    au survol) ;
 *  - flèches, pastilles, swipe, pause au survol, reduced-motion statique.
 */

export interface HeroSlide {
  id: string;
  slug: string;
  title: string;
  shortTitle: string | null;
  lede: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  coverUrl: string | null;
  coverAlt: string | null;
  timeAgoLabel: string;
  readingTimeMin: number;
  videoPreview: { kind: "youtube" | "file"; src: string } | null;
}

export interface HeroCarouselLabels {
  read: string;
  watch: string;
  prev: string;
  next: string;
}

const SLIDE_MS = 7000;
const T_MS = 750;

export function HeroCarousel({
  slides,
  labels,
}: {
  slides: HeroSlide[];
  labels: HeroCarouselLabels;
}) {
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const paused = useRef(false);
  const leaveTimer = useRef<number | undefined>(undefined);
  const touchX = useRef<number | null>(null);
  const count = slides.length;

  const go = (nextRaw: number) => {
    if (count < 2) return;
    const next = ((nextRaw % count) + count) % count;
    if (next === index) return;
    setDir(nextRaw > index || (index === count - 1 && nextRaw === 0) ? 1 : -1);
    setLeaving(index);
    setIndex(next);
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => setLeaving(null), T_MS + 60);
  };

  useEffect(() => {
    if (count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (paused.current || document.hidden) return;
      go(index + 1);
    }, SLIDE_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, count]);

  if (count === 0) return null;

  return (
    <div
      className="group/car relative aspect-[16/10] overflow-hidden rounded-lg border border-rule bg-ink shadow-[0_10px_36px_-16px_rgba(0,0,0,0.5)] sm:aspect-[16/9]"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onFocusCapture={() => (paused.current = true)}
      onBlurCapture={() => (paused.current = false)}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 48) go(index + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
    >
      {slides.map((s, i) => {
        const state = i === index ? "active" : i === leaving ? "leaving" : "hidden";
        return (
          <Link
            key={s.id}
            href={`/article/${s.slug}`}
            aria-label={s.title}
            aria-hidden={state !== "active"}
            tabIndex={state === "active" ? 0 : -1}
            className={`hc-slide hc-${state} ${dir === 1 ? "hc-dir-next" : "hc-dir-prev"}`}
          >
            {/* Couverture + ken-burns */}
            <div className="absolute inset-0 overflow-hidden">
              {s.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={state === "active" ? `on-${index}` : "off"}
                  src={s.coverUrl}
                  alt={s.coverAlt ?? s.title}
                  className={`h-full w-full object-cover ${state === "active" ? "hc-kenburns" : ""}`}
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#A4161A] to-[#3a0a0c]" />
              )}
            </div>

            {/* Voile dégradé */}
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/30 to-transparent" />

            {/* Aperçu vidéo incrusté */}
            {s.videoPreview && state === "active" && (
              <div
                className="absolute bottom-20 end-3 z-10 h-16 w-24 overflow-hidden rounded-md border-2 border-white/90 opacity-90 shadow-lg transition-transform duration-300 hover:scale-[1.5] sm:bottom-24 sm:h-20 sm:w-32 md:h-24 md:w-36"
                style={{ transformOrigin: "bottom right" }}
                aria-label="Aperçu vidéo"
              >
                {s.videoPreview.kind === "youtube" ? (
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${s.videoPreview.src}?autoplay=1&mute=1&controls=0&loop=1&playlist=${s.videoPreview.src}&modestbranding=1&rel=0&playsinline=1`}
                    title="Aperçu vidéo"
                    allow="autoplay; encrypted-media; picture-in-picture"
                    className="pointer-events-none h-full w-full"
                    tabIndex={-1}
                  />
                ) : (
                  <video src={s.videoPreview.src} muted autoPlay loop playsInline preload="metadata" className="h-full w-full object-cover" />
                )}
              </div>
            )}

            {/* Texte — cascade à chaque activation */}
            {state !== "hidden" && (
              <div key={`txt-${index}-${i}`} className="hc-text absolute inset-x-0 bottom-0 p-4 sm:p-5 md:p-6">
                {s.categoryName && (
                  <p className="hc-t1 mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#A4161A] px-2.5 py-1 text-[0.6rem] font-black uppercase tracking-[0.18em] text-white shadow-sm">
                    <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-white" />
                    {s.categoryName}
                  </p>
                )}
                <h2 className="hc-t2 font-serif text-lg font-black leading-tight tracking-tight text-white drop-shadow-md sm:text-xl md:text-2xl">
                  {s.shortTitle ?? s.title}
                </h2>
                {s.lede && (
                  <p className="hc-t3 mt-1.5 line-clamp-2 hidden max-w-2xl text-[0.82rem] leading-relaxed text-white/85 sm:block">
                    {s.lede}
                  </p>
                )}
                <p className="hc-t4 mt-2 flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-wider text-white/70">
                  <span>{s.timeAgoLabel}</span>
                  <span aria-hidden>·</span>
                  <span>{s.readingTimeMin} min</span>
                  {s.videoPreview && (
                    <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-white backdrop-blur">
                      ▶ {labels.watch}
                    </span>
                  )}
                </p>
              </div>
            )}
          </Link>
        );
      })}

      {/* Contrôles */}
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label={labels.prev}
            className="absolute start-2 top-1/2 z-20 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur transition-all duration-300 hover:scale-110 hover:bg-[#A4161A] group-hover/car:opacity-100 focus-visible:opacity-100 md:size-10"
          >
            <svg aria-hidden viewBox="0 0 16 16" className="size-4 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3 5 8l5 5" /></svg>
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label={labels.next}
            className="absolute end-2 top-1/2 z-20 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur transition-all duration-300 hover:scale-110 hover:bg-[#A4161A] group-hover/car:opacity-100 focus-visible:opacity-100 md:size-10"
          >
            <svg aria-hidden viewBox="0 0 16 16" className="size-4 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3l5 5-5 5" /></svg>
          </button>

          {/* Barre de progression + pastilles */}
          <div className="absolute bottom-3 end-3 z-20 flex items-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`${i + 1} / ${count}`}
                onClick={(e) => {
                  e.preventDefault();
                  go(i);
                }}
                className={`relative h-1.5 overflow-hidden rounded-full transition-all duration-400 ${
                  i === index ? "w-8 bg-white/35" : "w-1.5 bg-white/50 hover:bg-white/80"
                }`}
              >
                {i === index && (
                  <span key={`bar-${index}`} className="hc-progress absolute inset-y-0 left-0 rounded-full bg-[#ff5a60]" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
