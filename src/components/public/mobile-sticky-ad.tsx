"use client";

import { useEffect, useState } from "react";
import type { PublicAdCampaign } from "@/lib/public/homepage-data";

/**
 * Bandeau collant mobile (AD-12) — refermable, mobile uniquement.
 * Consomme la campagne réelle du slot AD-12 si elle existe ; sans campagne,
 * le bandeau ne s'affiche pas. Le clic est compté avant l'ouverture
 * (fire-and-forget), l'impression au montage.
 * Task ID: 9-ADS
 */

export function MobileStickyAd({
  label,
  cta,
  closeLabel,
  campaign,
}: {
  label: string;
  cta: string;
  closeLabel: string;
  campaign: PublicAdCampaign | null;
}) {
  const [closed, setClosed] = useState(false);

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

  if (closed || !campaign) return null;

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
      className="fixed inset-x-0 bottom-0 z-50 border-t border-rule bg-paper-alt shadow-[0_-4px_16px_rgba(0,0,0,0.08)] lg:hidden"
      data-ad-slot="AD-12"
      role="complementary"
      aria-label={`${label} AD-12`}
    >
      <div className="relative">
        <span className="absolute -top-2 left-2 z-10 bg-paper px-1.5 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-ink-faint">
          {label}
        </span>
        <button
          type="button"
          onClick={() => setClosed(true)}
          aria-label={closeLabel}
          className="absolute right-1 top-1 z-10 flex size-7 items-center justify-center text-lg leading-none text-ink-soft transition-colors hover:text-ink"
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
