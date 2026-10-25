"use client";

import { useEffect, useState } from "react";
import type { PublicAdCampaign } from "@/lib/public/homepage-data";
import { useAudioPlayer } from "@/components/public/audio-player/context";

/**
 * Bandeau collant mobile (AD-12) — refermable, mobile uniquement.
 * Système « taquin » 2026-10 : le bandeau SE SOULÈVE de 86 px quand la
 * barre audio flottante est visible (l'état `track` du contexte audio du
 * layout racine pilote le décalage — les deux barres ne se chevauchent
 * jamais). Tirage pondéré côté client (weight, repli priorité + 1) ;
 * le clic est compté avant l'ouverture (fire-and-forget), l'impression
 * au montage. `enabled=false` (réglage ads.stickyMobile) : rien.
 * Task ID: 9-ADS
 */

/** Hauteur de soulèvement au-dessus de la barre audio flottante. */
const AUDIO_BAR_LIFT_PX = 86;

/** Tirage pondéré par weight (repli priorité + 1). */
function pickWeightedIndex(campaigns: PublicAdCampaign[]): number {
  const total = campaigns.reduce((sum, c) => sum + Math.max(1, c.weight > 0 ? c.weight : c.priority + 1), 0);
  let roll = Math.random() * total;
  for (let i = 0; i < campaigns.length; i++) {
    roll -= Math.max(1, campaigns[i].weight > 0 ? campaigns[i].weight : campaigns[i].priority + 1);
    if (roll < 0) return i;
  }
  return campaigns.length - 1;
}

export function MobileStickyAd({
  label,
  cta,
  closeLabel,
  campaigns,
  enabled = true,
}: {
  label: string;
  cta: string;
  closeLabel: string;
  campaigns: PublicAdCampaign[];
  /** Court-circuit réglage admin ads.stickyMobile. */
  enabled?: boolean;
}) {
  const { track } = useAudioPlayer();
  const [closed, setClosed] = useState(false);
  // Tirage côté client uniquement (pas de mismatch d'hydratation) : tant
  // que picked est null, le bandeau ne s'affiche pas.
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    if (campaigns.length === 0) return;
    setPicked((prev) => (prev === null ? pickWeightedIndex(campaigns) : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const campaign = picked !== null ? campaigns[picked] : null;

  useEffect(() => {
    if (!campaign) return;
    try {
      void fetch(`/api/public/ads/${encodeURIComponent(campaign.creativeId)}/impression`, {
        method: "POST",
        keepalive: true,
      }).catch(() => undefined);
    } catch {
      /* ignoré */
    }
  }, [campaign]);

  if (!enabled || closed || !campaign) return null;

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

  return (
    <div
      className="animate-slide-in-up fixed inset-x-0 bottom-0 z-50 border-t border-rule bg-paper-alt shadow-[0_-4px_16px_rgba(0,0,0,0.08)] transition-[bottom] duration-500 ease-out lg:hidden"
      style={track ? { bottom: `${AUDIO_BAR_LIFT_PX}px` } : undefined}
      data-ad-slot="AD-12"
      data-audio-lift={track ? "true" : undefined}
      role="complementary"
      aria-label={`${label} AD-12`}
    >
      <div className="relative">
        <span className="absolute -top-2 start-2 z-10 bg-paper px-1.5 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-ink-faint">
          {label}
        </span>
        <button
          type="button"
          onClick={() => setClosed(true)}
          aria-label={closeLabel}
          className="absolute end-1 top-1 z-10 flex size-7 items-center justify-center text-lg leading-none text-ink-soft transition-colors hover:text-ink"
        >
          ×
        </button>
        <div className="h-[60px]">
          <a
            href={campaign.clickUrl}
            target="_blank"
            rel="sponsored nofollow noopener"
            onClick={handleClick}
            className="flex h-full w-full items-center justify-between gap-3 px-4"
            aria-label={`${campaign.advertiser} — ${campaign.name}`}
          >
            <div className="flex min-w-0 items-center gap-3">
              {campaign.imageUrl ? (
                <img
                  src={campaign.imageUrl}
                  alt={campaign.alt}
                  className="size-8 shrink-0 rounded-sm object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-brand-red font-serif text-sm font-black text-white"
                >
                  {campaign.advertiser.slice(0, 2).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate font-serif text-sm font-bold">{campaign.name}</p>
                <p className="truncate text-[0.7rem] text-ink-soft">{campaign.advertiser}</p>
              </div>
            </div>
            <span className="shrink-0 bg-brand-red px-2.5 py-1 text-[0.7rem] font-bold text-white">{cta}</span>
          </a>
        </div>
      </div>
    </div>
  );
}
