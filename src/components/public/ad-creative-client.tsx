"use client";

import { useEffect, useState } from "react";
import type { PublicAdCampaign } from "@/lib/public/homepage-data";

/**
 * Créative publicitaire réelle (régie simplifiée 2026-10) — rendu client :
 * image, GIF (URL originale, sans réencodage) ou vidéo (YouTube / mp4).
 * Clic compté via /api/public/ads/[id]/click puis ouverture dans un nouvel
 * onglet ; impression comptée au montage, fire-and-forget (jamais bloquant).
 *
 * Contient aussi AdRotation : wrapper de rotation pondérée qui affiche
 * successivement les campagnes d'un même emplacement (tirage initial côté
 * client + rotation toutes les 30 s avec fondu 500 ms, en pause quand
 * l'onglet est masqué). AdCreativeView reste le renderer d'UNE campagne.
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

// ─── Rotation pondérée (2026-10) ─────────────────────────────────────────

const ROTATE_INTERVAL_MS = 30_000;
const FADE_MS = 500;

/** Poids de tirage d'une campagne : `weight` de la créative si disponible
 * (> 0), sinon repli sur priority + 1 (une campagne de priorité 4 a
 * 5 fois plus de chances qu'une priorité 0). */
function campaignWeight(c: PublicAdCampaign): number {
  const w = (c as PublicAdCampaign & { weight?: number }).weight;
  return typeof w === "number" && Number.isFinite(w) && w > 0 ? w : Math.max(1, c.priority + 1);
}

/** Tirage pondéré (weight de la créative, sinon priorité) : `exclude`
 * permet d'éviter de re-tirer la campagne courante lors des rotations
 * suivantes. */
function pickWeightedIndex(campaigns: PublicAdCampaign[], exclude = -1): number {
  const pool = campaigns.map((c, i) => ({ i, w: campaignWeight(c) }));
  const filtered = pool.filter((p) => p.i !== exclude);
  const candidates = filtered.length > 0 ? filtered : pool;
  const total = candidates.reduce((sum, c) => sum + c.w, 0);
  let roll = Math.random() * total;
  for (const c of candidates) {
    roll -= c.w;
    if (roll < 0) return c.i;
  }
  return candidates[candidates.length - 1].i;
}

/** Rotation des campagnes d'un emplacement : tirage pondéré au chargement
 * (côté client, pour répartir entre les visites), puis rotation temporisée
 * toutes les 30 s si plusieurs campagnes — fondu 500 ms, pause quand
 * l'onglet est masqué (visibilitychange). Chaque créative affichée remonte
 * AdCreativeView (key = creativeId) : l'impression est donc comptée à chaque
 * apparition via son effet existant, inchangé. */
export function AdRotation({ campaigns }: { campaigns: PublicAdCampaign[] }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  // Tirage initial pondéré, côté client uniquement (évite le mismatch
  // d'hydratation : le serveur rend la première campagne de la liste).
  useEffect(() => {
    setIndex((prev) => (prev === 0 ? pickWeightedIndex(campaigns) : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rotation temporisée, en pause quand l'onglet est masqué.
  useEffect(() => {
    if (campaigns.length < 2) return;
    let interval: number | undefined;
    let fadeTimeout: number | undefined;
    const rotate = () => {
      setVisible(false);
      fadeTimeout = window.setTimeout(() => {
        setIndex((prev) => pickWeightedIndex(campaigns, prev));
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
  }, [campaigns]);

  if (campaigns.length === 0) return null;
  const campaign = campaigns[Math.min(index, campaigns.length - 1)];

  return (
    <div
      className="h-full w-full transition-opacity duration-500 ease-in-out"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <AdCreativeView key={campaign.creativeId} campaign={campaign} />
    </div>
  );
}
