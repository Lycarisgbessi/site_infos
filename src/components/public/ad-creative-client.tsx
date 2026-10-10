"use client";

import { useEffect } from "react";
import type { PublicAdCampaign } from "@/lib/public/homepage-data";

/**
 * Créative publicitaire réelle (régie simplifiée 2026-10) — rendu client :
 * image, GIF (URL originale, sans réencodage) ou vidéo (YouTube / mp4).
 * Clic compté via /api/public/ads/[id]/click puis ouverture dans un nouvel
 * onglet ; impression comptée au montage, fire-and-forget (jamais bloquant).
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

  // Vidéo
  if (campaign.mediaKind === "video") {
    const youtubeId = campaign.videoUrl ? youtubeEmbedId(campaign.videoUrl) : null;
    return (
      <div className="relative h-full w-full bg-ink">
        {youtubeId ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&mute=1&controls=0&rel=0&modestbranding=1&playsinline=1&loop=1&playlist=${youtubeId}`}
            title={campaign.name}
            allow="autoplay; encrypted-media; picture-in-picture"
            tabIndex={-1}
            className="pointer-events-none h-full w-full"
          />
        ) : (
          <video
            src={campaign.videoUrl ?? undefined}
            autoPlay
            muted
            loop
            playsInline
            className="pointer-events-none h-full w-full object-cover"
            aria-label={campaign.name}
          />
        )}
        {/* Voile cliquable : le clic est compté, le lecteur reste décoratif. */}
        <a {...clickLinkProps} className="absolute inset-0 z-10" />
      </div>
    );
  }

  // Image / GIF — <img> simple pour préserver l'animation des GIF.
  return (
    <a {...clickLinkProps} className="block h-full w-full">
      <img
        src={campaign.imageUrl ?? ""}
        alt={campaign.alt}
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
    </a>
  );
}
