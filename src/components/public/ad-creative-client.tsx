"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Image as ImageIcon, Megaphone, TrendingUp, Video } from "lucide-react";
import type { PublicAdCampaign } from "@/lib/public/homepage-data";
import { sanitizeAdHtml } from "@/lib/ad-html";

/**
 * Créative publicitaire réelle (système « taquin » 2026-10) — rendu client :
 * image, GIF (URL originale), vidéo (YouTube / mp4) ou HTML de repli
 * (sanitisé strictement, voir lib/ad-html). Charte ROUGE SANG / BLANC / NOIR.
 * Clic compté via /api/public/ads/[id]/click puis ouverture dans un nouvel
 * onglet ; impression comptée au montage, fire-and-forget.
 *
 * AdRotation : roue de 5 s — créas + glissières AUTO-PROMO (règle : 0 créa →
 * 3 promos ; 1-2 créas → 2 promos ; ≥ 3 créas → 1 promo). Entrées animées
 * (balayage énergique pour les créas, cascade montée pour les promos),
 * « coucou » taquin toutes les 12 s, pause au survol, pastilles de
 * progression. prefers-reduced-motion coupe toutes les animations (globals).
 */

function youtubeEmbedId(url: string): string | null {
  const match =
    url.match(/[?&]v=([\w-]{6,})/) ??
    url.match(/youtu\.be\/([\w-]{6,})/) ??
    url.match(/youtube(?:-nocookie)?\.com\/embed\/([\w-]{6,})/) ??
    url.match(/youtube(?:-nocookie)?\.com\/shorts\/([\w-]{6,})/);
  return match ? match[1] : null;
}

export function AdCreativeView({ campaign, adLabel }: { campaign: PublicAdCampaign; adLabel?: string }) {
  // Impression best-effort : sans await, sans état d'erreur visible.
  useEffect(() => {
    try {
      void fetch(`/api/public/ads/${encodeURIComponent(campaign.creativeId)}/impression`, {
        method: "POST",
        keepalive: true,
      }).catch(() => undefined);
    } catch {
      /* ignoré */
    }
  }, [campaign.creativeId]);

  // Créative HTML de repli : sanitisation STRICTE côté client uniquement
  // (jamais de HTML brut rendu au SSR), puis injection.
  const [safeHtml, setSafeHtml] = useState<string | null>(null);
  useEffect(() => {
    if (!campaign.htmlCode) return;
    setSafeHtml(sanitizeAdHtml(campaign.htmlCode));
  }, [campaign.htmlCode]);

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const fallback = () => window.open(campaign.clickUrl, "_blank", "noopener");
    try {
      void fetch(`/api/public/ads/${encodeURIComponent(campaign.creativeId)}/click`, {
        method: "POST",
        keepalive: true,
      })
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as { data?: { url?: string } } | null;
          window.open(payload?.data?.url ?? campaign.clickUrl, "_blank", "noopener");
        })
        .catch(fallback);
    } catch {
      fallback();
    }
  };

  const clickLinkProps = {
    href: campaign.clickUrl,
    target: "_blank" as const,
    rel: "sponsored nofollow noopener",
    onClick: handleClick,
    "aria-label": `${campaign.advertiser} — ${campaign.name}`,
  };

  const pill = (
    <span className="absolute end-1.5 top-1.5 z-20 rounded-full bg-black/60 px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-sm">
      {adLabel ?? "Publicité"}
    </span>
  );

  // Créative HTML de repli (aucun média, aucun vidéo) : contenu sanitizé.
  if (campaign.mediaKind !== "video" && !campaign.imageUrl && campaign.htmlCode) {
    return (
      <div className="ad-creative-frame bg-[#0d0c0c]">
        {pill}
        {safeHtml ? (
          <div
            className="ad-html-fallback h-full w-full overflow-hidden p-3 text-center text-white [&_a]:text-white [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-4">
            <p className="truncate font-serif text-sm font-bold text-white/80">{campaign.name}</p>
          </div>
        )}
        <a {...clickLinkProps} className="absolute inset-0 z-10" />
      </div>
    );
  }

  if (campaign.mediaKind === "video") {
    const youtubeId = campaign.videoUrl ? youtubeEmbedId(campaign.videoUrl) : null;
    return (
      <div className="ad-creative-frame">
        {pill}
        {youtubeId ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${youtubeId}&modestbranding=1&rel=0&playsinline=1`}
            title={campaign.alt || campaign.name}
            allow="autoplay; encrypted-media"
            className="h-full w-full"
          />
        ) : (
          <video
            src={campaign.videoUrl ?? undefined}
            autoPlay
            muted
            loop
            playsInline
            className="h-full w-full object-cover"
            aria-label={campaign.alt || campaign.name}
          />
        )}
        {/* Voile cliquable : le clic est compté, le lecteur reste décoratif. */}
        <a {...clickLinkProps} className="absolute inset-0 z-10" />
      </div>
    );
  }

  // Image / GIF — <img> simple pour préserver l'animation des GIF.
  const isGif = /\.gif($|\?)/i.test(campaign.imageUrl ?? "");
  return (
    <div className="ad-creative-frame">
      {pill}
      <a {...clickLinkProps} className="block h-full w-full overflow-hidden">
        <img
          src={campaign.imageUrl ?? ""}
          alt={campaign.alt}
          className={`h-full w-full object-cover ${isGif ? "" : "ad-kenburns"}`}
          loading="lazy"
          decoding="async"
        />
      </a>
    </div>
  );
}

// ─── Glissières auto-promo — charte rouge sang / blanc / noir ──────────

export interface AdHouseSlideLabels {
  title: string;
  subtitle: string;
  cta: string;
}

export interface AdHouseLabels {
  /** Étiquette « Publicité » (pilule des créas). */
  adLabel: string;
  /** Surtitre commun « Régie INFOSPRO ». */
  eyebrow: string;
  /** Compteur « 10 000 lecteurs/mois » (adapté par langue). */
  count: string;
  /** a — « Votre marque ici ? » (mégaphone flottant). */
  brand: AdHouseSlideLabels;
  /** b — « Votre audience est ici. » (dégradé rouge). */
  audience: AdHouseSlideLabels;
  /** c — « Votre créa, en mouvement. » (mini-formats). */
  motion: AdHouseSlideLabels;
  formatBanner: string;
  formatVideo: string;
  formatNative: string;
}

/** Reflet blanc skew qui balaie en continu (4,6 s : -45 % → 125 %). */
function AdReflect() {
  return <span aria-hidden className="ad-reflect" />;
}

/** a — « Votre marque ici ? » : noir profond, halos rouges, mégaphone
 *  flottant avec onde ping, compteur zoom, CTA blanc pulsé. */
function AdHouseBrandSlide({ labels }: { labels: AdHouseLabels }) {
  return (
    <Link
      href="/pages/publicite"
      className="ad-house-slide group relative flex h-full w-full items-center justify-center overflow-hidden bg-[#0b0a0a]"
      aria-label={labels.brand.cta}
    >
      {/* Halos rouges floutés aux coins */}
      <span aria-hidden className="ad-house-halo pointer-events-none absolute inset-0" />
      {/* Trame diagonale blanche 14 % */}
      <span aria-hidden className="ad-house-diagonal pointer-events-none absolute inset-0" />
      <AdReflect />
      <div className="relative z-10 flex h-full w-full items-center gap-3 px-4 py-2 sm:gap-4">
        {/* Mégaphone rouge flottant + onde ping */}
        <span aria-hidden className="relative flex shrink-0 items-center justify-center">
          <span className="absolute inline-flex size-12 animate-ping rounded-full bg-[#A4161A]/40" />
          <span className="relative flex size-10 items-center justify-center rounded-full bg-[#A4161A] text-white shadow-[0_0_18px_rgba(164,22,26,0.55)] md:size-11">
            <Megaphone className="ad-megaphone size-5 md:size-6" aria-hidden />
          </span>
        </span>
        <div className="min-w-0 flex-1 text-start">
          <p className="ad-slide-up ad-d1 text-[0.55rem] font-bold uppercase tracking-[0.32em] text-white/50">
            {labels.eyebrow}
          </p>
          <p className="ad-slide-up ad-d2 mt-0.5 font-serif text-sm font-black leading-tight text-white md:text-base">
            {labels.brand.title}
          </p>
          <p className="ad-count ad-d3 mt-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#ff5a60] md:text-xs">
            {labels.count}
          </p>
          <span className="ad-slide-up ad-d4 mt-1.5 inline-block rounded-full bg-white px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#0b0a0a] transition-transform duration-300 group-hover:scale-105 ad-cta-pulse">
            {labels.brand.cta}
          </span>
        </div>
      </div>
    </Link>
  );
}

/** b — « Votre audience est ici. » : dégradé rouge #A4161A→#5d0d10,
 *  icône TrendingUp, compteur zoom, CTA. */
function AdHouseAudienceSlide({ labels }: { labels: AdHouseLabels }) {
  return (
    <Link
      href="/pages/publicite"
      className="ad-house-slide group relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#A4161A] to-[#5d0d10]"
      aria-label={labels.audience.cta}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_80%_-10%,rgba(255,255,255,0.16),transparent_60%)]" />
      <span aria-hidden className="ad-house-diagonal pointer-events-none absolute inset-0 opacity-60" />
      <AdReflect />
      <div className="relative z-10 flex h-full w-full items-center gap-3 px-4 py-2 sm:gap-4">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/30 md:size-11">
          <TrendingUp className="size-5 md:size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 text-start">
          <p className="ad-slide-up ad-d1 text-[0.55rem] font-bold uppercase tracking-[0.32em] text-white/60">
            {labels.eyebrow}
          </p>
          <p className="ad-slide-up ad-d2 mt-0.5 font-serif text-sm font-black leading-tight text-white md:text-base">
            {labels.audience.title}
          </p>
          <p className="ad-count ad-d3 mt-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-white/85 md:text-xs">
            {labels.count}
          </p>
          <span className="ad-slide-up ad-d4 mt-1.5 inline-block rounded-full bg-white px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#A4161A] transition-transform duration-300 group-hover:scale-105 ad-cta-pulse">
            {labels.audience.cta}
          </span>
        </div>
      </div>
    </Link>
  );
}

/** c — « Votre créa, en mouvement. » : noir + halos, 3 mini-formats
 *  étiquetés (BANNIÈRE / VIDÉO / NATIF) en cascade à gauche, texte + CTA. */
function AdHouseMotionSlide({ labels }: { labels: AdHouseLabels }) {
  const formats = [
    { icon: ImageIcon, label: labels.formatBanner },
    { icon: Video, label: labels.formatVideo },
    { icon: FileText, label: labels.formatNative },
  ];
  return (
    <Link
      href="/pages/publicite"
      className="ad-house-slide group relative flex h-full w-full items-center justify-center overflow-hidden bg-[#0b0a0a]"
      aria-label={labels.motion.cta}
    >
      <span aria-hidden className="ad-house-halo pointer-events-none absolute inset-0" />
      <AdReflect />
      <div className="relative z-10 flex h-full w-full items-center gap-3 px-4 py-2 sm:gap-4">
        {/* Mini-formats en cascade */}
        <div aria-hidden className="flex shrink-0 flex-col gap-1.5">
          {formats.map(({ icon: Icon, label }, i) => (
            <span
              key={label}
              className={`ad-slide-up ad-d${i + 1} flex items-center gap-1.5 rounded-[4px] border border-[#A4161A]/50 bg-[#A4161A]/15 px-2 py-1 text-[0.52rem] font-bold uppercase tracking-[0.18em] text-white/85`}
            >
              <Icon className="size-3 text-[#ff5a60]" aria-hidden />
              {label}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1 text-start">
          <p className="ad-slide-up ad-d1 text-[0.55rem] font-bold uppercase tracking-[0.32em] text-white/50">
            {labels.eyebrow}
          </p>
          <p className="ad-slide-up ad-d2 mt-0.5 font-serif text-sm font-black leading-tight text-white md:text-base">
            {labels.motion.title}
          </p>
          <p className="ad-slide-up ad-d3 mt-0.5 truncate text-[0.6rem] font-medium text-white/60">
            {labels.motion.subtitle}
          </p>
          <span className="ad-slide-up ad-d4 mt-1.5 inline-block rounded-full bg-[#A4161A] px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.14em] text-white ring-1 ring-white/25 transition-transform duration-300 group-hover:scale-105 ad-cta-pulse">
            {labels.motion.cta}
          </span>
        </div>
      </div>
    </Link>
  );
}

type Slide =
  | { kind: "campaign"; id: string; campaign: PublicAdCampaign }
  | { kind: "house"; id: string; variant: 1 | 2 | 3 };

/** Règle auto-promo : 0 créa → 3 promos ; 1-2 créas → 2 promos ; ≥3 → 1. */
function houseCountFor(campaignCount: number): number {
  if (campaignCount === 0) return 3;
  if (campaignCount < 3) return 2;
  return 1;
}

export function AdRotation({
  campaigns,
  houseLabels,
}: {
  campaigns: PublicAdCampaign[];
  houseLabels?: AdHouseLabels;
}) {
  const slides: Slide[] = useMemo(() => {
    const houseSlides: Slide[] = houseLabels
      ? Array.from({ length: houseCountFor(campaigns.length) }, (_, i) => ({
          kind: "house" as const,
          id: `house-${i + 1}`,
          variant: (i + 1) as 1 | 2 | 3,
        }))
      : [];
    return [
      ...campaigns.map((campaign) => ({ kind: "campaign" as const, id: campaign.creativeId, campaign })),
      ...houseSlides,
    ];
  }, [campaigns, houseLabels]);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // Roue : rotation toutes les 5 s ; l'entrée du nouveau slide relance son
  // animation CSS (clé = identifiant du slide). Pause au survol/onglet caché.
  useEffect(() => {
    if (slides.length < 2) return;
    const interval = window.setInterval(() => {
      if (paused || document.hidden) return;
      setIndex((prev) => (prev + 1) % slides.length);
    }, 5000);
    const onVisibility = () => {
      /* le tick vérifie document.hidden : rien à faire, l'interval survit */
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [slides.length, paused]);

  if (slides.length === 0) return null;
  const safeIndex = Math.min(index, slides.length - 1);
  const slide = slides[safeIndex];

  return (
    <div
      className="ad-tease relative h-full w-full overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div key={slide.id} className={`h-full w-full ${slide.kind === "campaign" ? "ad-enter-sweep" : "ad-enter-slide"}`}>
        {slide.kind === "campaign" ? (
          <AdCreativeView campaign={slide.campaign} adLabel={houseLabels?.adLabel} />
        ) : slide.variant === 1 ? (
          <AdHouseBrandSlide labels={houseLabels!} />
        ) : slide.variant === 2 ? (
          <AdHouseAudienceSlide labels={houseLabels!} />
        ) : (
          <AdHouseMotionSlide labels={houseLabels!} />
        )}
      </div>

      {/* Pastilles de progression : barre active w-4 + points w-1.5 */}
      {slides.length > 1 && (
        <div className="absolute bottom-1.5 start-1/2 z-20 flex -translate-x-1/2 gap-1.5 rtl:translate-x-1/2">
          {slides.map((s, i) => (
            <span
              key={s.id}
              aria-hidden
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === safeIndex ? "w-4 bg-white shadow-[0_0_4px_rgba(0,0,0,0.6)]" : "w-1.5 bg-white/55 shadow-[0_0_3px_rgba(0,0,0,0.45)]"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
