"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * Carrousel « À la une » — les articles vedettes DÉFILENT en grand :
 * rotation automatique (~6,5 s), transition fondu + glissement, flèches,
 * pastilles de progression cliquables, pause au survol, swipe tactile,
 * aperçu vidéo incrusté si l'article contient une vidéo.
 * prefers-reduced-motion : slide statique, navigation manuelle.
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

const SLIDE_MS = 6500;
const FADE_MS = 600;

export function HeroCarousel({
  slides,
  labels,
}: {
  slides: HeroSlide[];
  labels: HeroCarouselLabels;
}) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const paused = useRef(false);
  const touchX = useRef<number | null>(null);
  const count = slides.length;

  const go = (next: number) => {
    if (count < 2) return;
    setVisible(false);
    window.setTimeout(() => {
      setIndex(((next % count) + count) % count);
      setVisible(true);
    }, FADE_MS);
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
  const s = slides[Math.min(index, count - 1)];

  return (
    <div
      className="group/car relative overflow-hidden rounded-lg border border-rule bg-ink shadow-[0_10px_36px_-16px_rgba(0,0,0,0.5)]"
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
      <Link
        href={`/article/${s.slug}`}
        className="block"
        aria-label={s.title}
      >
        <div
          className="hero-slide relative aspect-[16/10] w-full transition-all duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] sm:aspect-[16/9]"
          style={{ opacity: visible ? 1 : 0, transform: visible ? "translateX(0)" : "translateX(4%)" }}
        >
          {/* Couverture */}
          {s.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={s.coverUrl}
              alt={s.coverAlt ?? s.title}
              className="absolute inset-0 h-full w-full object-cover"
              loading={index === 0 ? "eager" : "lazy"}
              decoding="async"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#A4161A] to-[#3a0a0c]" />
          )}

          {/* Voile dégradé pour la lisibilité */}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

          {/* Aperçu vidéo incrusté (coin inférieur droit) */}
          {s.videoPreview && (
            <div
              className="absolute bottom-16 end-3 z-10 h-[4rem] w-24 overflow-hidden rounded-md border-2 border-white/90 opacity-90 shadow-lg transition-transform duration-300 hover:scale-[1.5] sm:bottom-20 sm:h-20 sm:w-32 md:h-24 md:w-36"
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

          {/* Texte */}
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 md:p-6">
            {s.categoryName && (
              <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#A4161A] px-2.5 py-1 text-[0.6rem] font-black uppercase tracking-[0.18em] text-white">
                <span aria-hidden className="size-1.5 rounded-full bg-white" />
                {s.categoryName}
              </p>
            )}
            <h2 className="font-serif text-lg font-black leading-tight tracking-tight text-white drop-shadow-sm sm:text-xl md:text-2xl">
              {s.shortTitle ?? s.title}
            </h2>
            {s.lede && (
              <p className="mt-1.5 line-clamp-2 hidden max-w-2xl text-[0.82rem] leading-relaxed text-white/80 sm:block">
                {s.lede}
              </p>
            )}
            <p className="mt-2 flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-wider text-white/70">
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
        </div>
      </Link>

      {/* Contrôles */}
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label={labels.prev}
            className="absolute start-2 top-1/2 z-20 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur transition-all duration-300 hover:bg-[#A4161A] group-hover/car:opacity-100 focus-visible:opacity-100 md:size-10"
          >
            <svg aria-hidden viewBox="0 0 16 16" className="size-4 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3 5 8l5 5" /></svg>
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label={labels.next}
            className="absolute end-2 top-1/2 z-20 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur transition-all duration-300 hover:bg-[#A4161A] group-hover/car:opacity-100 focus-visible:opacity-100 md:size-10"
          >
            <svg aria-hidden viewBox="0 0 16 16" className="size-4 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3l5 5-5 5" /></svg>
          </button>

          {/* Pastilles de progression */}
          <div className="absolute bottom-3 end-3 z-20 flex gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`${i + 1} / ${count}`}
                onClick={(e) => {
                  e.preventDefault();
                  go(i);
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index ? "w-5 bg-[#ff5a60]" : "w-1.5 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
