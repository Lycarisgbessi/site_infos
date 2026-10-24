"use client";

import { useEffect, useState } from "react";
import type { PublicAdCampaign } from "@/lib/public/homepage-data";

/**
 * Créative publicitaire réelle (régie simplifiée 2026-10) — rendu client :
 * image, GIF (URL originale, sans réencodage) ou vidéo (YouTube / mp4).
 * Clic compté via /api/public/ads/[id]/click puis ouverture dans un nouvel
 * onglet ; impression comptée au montage, fire-and-forget (jamais bloquant).
 *
 * AdRotation : cycle ANIMÉ des campagnes d'un emplacement, entremêlées
 * d'une glissière « régie » qui invite les visiteurs à commander une
 * publicité — rotation 10 s, fondu glissé, pastilles de progression,
 * pause au survol. Même sans campagne, l'emplacement vit.
 */

function youtubeEmbedId(url: string): string | null {
  const match =
    url.match(/[?&]v=([\w-]{6,})/) ??
    url.match(/youtu\.be\/([\w-]{6,})/) ??
    url.match(/youtube(?:-nocookie)?\.com\/embed\/([\w-]{6,})/) ??
    url.match(/youtube(?:-nocookie)?\.com\/shorts\/([\w-]{6,})/);
  return match ? match[1] : null;
}

export function AdCreativeView({ campaign }: { campaign: PublicAdCampaign }) {
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

  if (campaign.mediaKind === "video") {
    const youtubeId = campaign.videoUrl ? youtubeEmbedId(campaign.videoUrl) : null;
    return (
      <div className="relative h-full w-full">
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
  // Les affiches figées s'animent doucement (ken-burns) pour vivifier
  // l'emplacement ; les GIF restent animés par nature.
  const isGif = /\.gif($|\?)/i.test(campaign.imageUrl ?? "");
  return (
    <a {...clickLinkProps} className="block h-full w-full overflow-hidden">
      <img
        src={campaign.imageUrl ?? ""}
        alt={campaign.alt}
        className={`h-full w-full object-cover ${isGif ? "" : "ad-kenburns"}`}
        loading="lazy"
        decoding="async"
      />
    </a>
  );
}

// ─── Cycle animé : campagnes + glissière régie ──────────────────────────

const ROTATE_INTERVAL_MS = 10_000;
const FADE_MS = 450;

/** Glissière auto-promotion : invite à commander cet espace publicitaire. */
function AdHouseSlide({ labels }: { labels: AdHouseLabels }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-ink">
      {/* Fond animé : vagues dégradées rouge/orange */}
      <div aria-hidden className="ad-house-waves absolute inset-0" />
      <div className="relative z-10 px-4 py-2 text-center">
        <p className="text-sm font-black uppercase tracking-widest text-white md:text-base">
          {labels.title}
        </p>
        <p className="mt-1 text-[0.65rem] font-medium text-white/75 md:text-xs">{labels.subtitle}</p>
        <span className="mt-2 inline-block rounded-full bg-white px-3 py-1 text-[0.65rem] font-black uppercase tracking-widest text-brand-red shadow-sm transition-transform duration-200 hover:scale-105 md:text-xs">
          {labels.cta} →
        </span>
      </div>
    </div>
  );
}

export interface AdHouseLabels {
  title: string;
  subtitle: string;
  cta: string;
}

type Slide =
  | { kind: "campaign"; campaign: PublicAdCampaign }
  | { kind: "house" };

/** Poids de tirage : weight de la créative si disponible, sinon priorité+1. */
function campaignWeight(c: PublicAdCampaign): number {
  const rec = c as unknown as Record<string, unknown>;
  const w = typeof rec.weight === "number" && rec.weight > 0 ? rec.weight : c.priority + 1;
  return Math.max(1, w);
}

export function AdRotation({
  campaigns,
  houseLabels,
}: {
  campaigns: PublicAdCampaign[];
  houseLabels?: AdHouseLabels;
}) {
  // Diapositives : campagnes (ordre priorité) + glissière régie en fin de cycle.
  const hasHouse = Boolean(houseLabels);
  const slides: Slide[] = [
    ...campaigns.map((campaign) => ({ kind: "campaign" as const, campaign })),
    ...(hasHouse ? [{ kind: "house" as const }] : []),
  ];

  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);

  // Cycle : rotation toutes les 10 s, fondu glissé, pause au survol/onglet caché.
  useEffect(() => {
    if (slides.length < 2) return;
    let interval: number | undefined;
    let fadeTimeout: number | undefined;
    const rotate = () => {
      if (paused || document.hidden) return;
      setVisible(false);
      fadeTimeout = window.setTimeout(() => {
        setIndex((prev) => (prev + 1) % slides.length);
        setVisible(true);
      }, FADE_MS);
    };
    const start = () => {
      if (interval === undefined) interval = window.setInterval(rotate, ROTATE_INTERVAL_MS);
    };
    const stop = () => {
      if (interval !== undefined) {
        window.clearInterval(interval);
        interval = undefined;
      }
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) start();
    return () => {
      stop();
      if (fadeTimeout !== undefined) window.clearTimeout(fadeTimeout);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [slides.length, paused]);

  if (slides.length === 0) {
    return houseLabels ? <AdHouseSlide labels={houseLabels} /> : null;
  }
  const slide = slides[Math.min(index, slides.length - 1)];

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="ad-slide h-full w-full transition-all duration-500"
        style={{ opacity: visible ? 1 : 0, transform: visible ? "translateX(0)" : "translateX(6%)" }}
      >
        {slide.kind === "campaign" ? (
          <AdCreativeView key={slide.campaign.creativeId} campaign={slide.campaign} />
        ) : (
          <AdHouseSlide labels={houseLabels!} />
        )}
      </div>

      {/* Pastilles de progression */}
      {slides.length > 1 && (
        <div className="absolute bottom-1.5 start-1/2 z-20 flex -translate-x-1/2 gap-1.5 rtl:translate-x-1/2">
          {slides.map((_, i) => (
            <span
              key={i}
              aria-hidden
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index ? "w-4 bg-white" : "w-1.5 bg-white/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
