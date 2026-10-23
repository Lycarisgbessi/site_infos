"use client";

import { useEffect, useState } from "react";
import { AdRotation } from "./ad-creative-client";
import type { PublicAdCampaign } from "@/lib/public/homepage-data";

/**
 * Encart publicitaire flottant — coin inférieur GAUCHE (choix éditorial),
 * au-dessus de la barre audio. Fermable : le refus est mémorisé 24 h
 * (localStorage). Rotation animée entre les campagnes du slot AD-11.
 * Masqué sur mobile (le bandeau collant AD-12 y est déjà actif).
 */

const DISMISS_KEY = "infospro.ad-corner.dismissed-at";
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;

export function AdCorner({
  campaigns,
  label,
}: {
  campaigns: PublicAdCampaign[];
  label: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (campaigns.length === 0) return;
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS) return;
    // Légère temporisation pour ne pas perturber la première lecture
    const timer = window.setTimeout(() => setVisible(true), 4000);
    return () => window.clearTimeout(timer);
  }, [campaigns.length]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!visible || campaigns.length === 0) return null;

  return (
    <div
      role="complementary"
      aria-label={`${label} AD-11`}
      className="animate-slide-in-up fixed bottom-24 start-4 z-40 hidden w-[300px] shadow-[0_8px_30px_rgba(0,0,0,0.35)] md:block"
    >
      <div className="relative border border-rule bg-paper-alt">
        <span className="absolute -top-2 start-2 z-20 bg-paper px-1.5 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-ink-faint">
          {label}
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fermer la publicité"
          className="absolute -top-2 -end-2 z-30 flex size-6 items-center justify-center rounded-full border border-rule bg-paper text-ink-faint shadow-sm transition-colors duration-200 hover:bg-brand-red hover:text-white"
        >
          <svg aria-hidden viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
        <div className="h-[250px] overflow-hidden">
          <AdRotation campaigns={campaigns} />
        </div>
      </div>
    </div>
  );
}
