"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { PublicArticle } from "@/lib/public/homepage-data";

/**
 * MagazineTeaserCorner — cache-cache taquin au coin bas-GAUCHE (transformation
 * de l'ancien AdCorner, système « taquin » 2026-10) :
 *  - visible 9 s → SE CACHE hors écran vers la gauche (x:-130 %, rotation
 *    -8°, fuite) 6 s → RESSORT d'un coup de ressort (transition élastique) ;
 *  - mini-coverflow rotatif des COUVERTURES des derniers articles
 *    (perspective 700 px, rotateY ±40°, échelle centrale 1 / latérales 0,8,
 *    rotation toutes les 2,8 s) ;
 *  - panneau : eyebrow « INFOSPRO », titre serif de l'article en rotation,
 *    CTA rouge pulsé « Lire » → /article/{slug}, filet signature bas qui
 *    s'étire au survol, reflet balayant ;
 *  - pause au survol, apparaît après 500 px de scroll, fermable
 *    (sessionStorage), se tient au-dessus de la barre audio (bottom-24).
 *  Masqué sous md (le bandeau collant AD-12 y est déjà actif).
 */

const DISMISS_KEY = "infospro.mag-teaser.dismissed";
const SHOW_AFTER_SCROLL_PX = 500;
/** Cycle cache-cache : 9 s visible + 6 s caché = 15 s. */
const CYCLE_MS = 15_000;
const VISIBLE_MS = 9_000;
/** Rotation du coverflow. */
const COVER_ROTATE_MS = 2_800;
/** Tick d'horloge interne (pause au survol / onglet caché). */
const TICK_MS = 400;

interface CoverStyle {
  transform: string;
  zIndex: number;
  opacity: number;
}

/** Position 3D d'une couverture selon son offset au centre (±40°, 1 / 0,8). */
function coverStyle(offset: number): CoverStyle {
  const abs = Math.abs(offset);
  if (abs === 0) {
    return { transform: "translateZ(28px) rotateY(0deg) scale(1)", zIndex: 30, opacity: 1 };
  }
  if (abs === 1) {
    const x = offset * 46;
    return {
      transform: `translateX(${x}px) rotateY(${-offset * 40}deg) scale(0.8)`,
      zIndex: 20,
      opacity: 1,
    };
  }
  const x = offset * 80;
  return {
    transform: `translateX(${x}px) rotateY(${-offset * 52}deg) scale(0.68)`,
    zIndex: 10,
    opacity: 0.55,
  };
}

export function MagazineTeaserCorner({
  articles,
  labels,
}: {
  articles: PublicArticle[];
  labels: { read: string; close: string };
}) {
  const withCover = articles.filter((a) => a.cover?.url).slice(0, 5);
  const [dismissed, setDismissed] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [coverIndex, setCoverIndex] = useState(0);
  const hoverRef = useRef(false);

  // Dismiss persistant pour la session + seuil de scroll d'apparition.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(DISMISS_KEY) === "1") {
      setDismissed(true);
      return;
    }
    const onScroll = () => setScrolled(window.scrollY > SHOW_AFTER_SCROLL_PX);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Horloge du cache-cache : 9 s visible → 6 s caché → recommence.
  // En pause au survol et quand l'onglet est caché.
  useEffect(() => {
    if (dismissed || !scrolled || withCover.length === 0) return;
    const id = window.setInterval(() => {
      if (hoverRef.current || document.hidden) return;
      setElapsed((e) => e + TICK_MS);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [dismissed, scrolled, withCover.length]);

  // Rotation du coverflow (2,8 s) — en pause au survol.
  useEffect(() => {
    if (dismissed || !scrolled || withCover.length < 2) return;
    const id = window.setInterval(() => {
      if (hoverRef.current || document.hidden) return;
      setCoverIndex((i) => (i + 1) % withCover.length);
    }, COVER_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [dismissed, scrolled, withCover.length]);

  if (dismissed || !scrolled || withCover.length === 0) return null;

  const cyclePos = elapsed % CYCLE_MS;
  const hiddenNow = cyclePos >= VISIBLE_MS;
  const n = withCover.length;
  const active = withCover[((coverIndex % n) + n) % n];

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* session indisponible : on ferme pour la navigation courante */
    }
    setDismissed(true);
  };

  return (
    <div
      role="complementary"
      aria-label="INFOSPRO — à lire"
      className={`mag-teaser ${hiddenNow ? "mag-hidden" : "mag-return"} group fixed bottom-24 start-4 z-40 hidden w-[300px] md:block`}
      onMouseEnter={() => (hoverRef.current = true)}
      onMouseLeave={() => (hoverRef.current = false)}
    >
      <div className="relative overflow-hidden rounded-[10px] border border-[#A4161A]/30 bg-[#0b0a0a] shadow-[0_12px_36px_-12px_rgba(164,22,26,0.5)]">
        {/* Reflet balayant */}
        <span aria-hidden className="ad-reflect" />

        <div className="relative z-10 p-3">
          {/* Eyebrow + fermeture */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-[0.58rem] font-bold uppercase tracking-[0.32em] text-[#ff5a60]">INFOSPRO</p>
            <button
              type="button"
              onClick={dismiss}
              aria-label={labels.close}
              className="flex size-6 items-center justify-center rounded-full text-white/50 transition-colors duration-200 hover:bg-[#A4161A] hover:text-white"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>

          {/* Mini-coverflow des couvertures */}
          <div className="coverflow-stage relative mx-auto mt-2 h-[88px] w-full" aria-hidden>
            {withCover.map((a, i) => {
              let offset = i - (coverIndex % n);
              if (offset > n / 2) offset -= n;
              if (offset < -n / 2) offset += n;
              const style = coverStyle(offset);
              return (
                <span
                  key={a.id}
                  className="coverflow-item overflow-hidden rounded-[4px] border border-white/10 shadow-[0_4px_14px_rgba(0,0,0,0.5)]"
                  style={style}
                >
                  <img
                    src={a.cover?.url ?? ""}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </span>
              );
            })}
          </div>

          {/* Titre serif en rotation + CTA rouge pulsé */}
          <Link href={`/article/${active.slug}`} className="mt-2.5 block">
            <p className="line-clamp-2 min-h-[2.4em] font-serif text-[0.82rem] font-bold leading-snug text-white transition-colors duration-200 group-hover:text-[#ff5a60]">
              {active.title}
            </p>
            <span className="mt-2 inline-block rounded-full bg-[#A4161A] px-3.5 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.18em] text-white ring-1 ring-white/25 ad-cta-pulse">
              {labels.read} →
            </span>
            {/* Filet signature bas qui s'étire au survol */}
            <span aria-hidden className="signature-rule mt-2.5 block h-[2px] w-full bg-gradient-to-r from-[#A4161A] to-[#ff5a60]" />
          </Link>
        </div>
      </div>
    </div>
  );
}
