"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { PublicAdCampaign } from "@/lib/public/homepage-data";
import { AdRotation, type AdHouseLabels } from "@/components/public/ad-creative-client";

/**
 * InterstitialAd — plein écran 1 fois par session (système « taquin »
 * 2026-10). 2,5 s après l'arrivée : fond noir/80 backdrop-blur, carte
 * centrée max-w-lg aspect 16/10 avec la roue AD-11 + boutons « Découvrir »
 * (la créa clique : même flux de comptage/ouverture que la créa) et
 * « Fermer ✕ ». Fermeture par Escape ou clic sur le fond. Jamais
 * bloquant plus que nécessaire. Court-circuité par le réglage
 * ads.interstitial (enabled=false).
 */

const SESSION_KEY = "infospro.interstitial.shown";
const SHOW_DELAY_MS = 2_500;

export function InterstitialAd({
  campaigns,
  houseLabels,
  labels,
  enabled = true,
}: {
  campaigns: PublicAdCampaign[];
  houseLabels: AdHouseLabels;
  labels: { discover: string; close: string };
  enabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Une seule apparition par session + temporisation 2,5 s. Sans campagne
  // AD-11, la carte vit avec les glissières auto-promo de la roue.
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY) === "1") return;
    const timer = window.setTimeout(() => {
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* session indisponible : une apparition par navigation */
      }
      setOpen(true);
    }, SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [enabled]);

  const close = useCallback(() => setOpen(false), []);

  // Escape ferme ; le scroll de la page est bloqué tant que c'est ouvert.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, close]);

  // Focus sur la carte pour l'accessibilité clavier dès l'ouverture.
  useEffect(() => {
    if (open) cardRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const primary = campaigns[0];

  /** « Découvrir » = le clic de la créa : comptage puis ouverture. */
  const discover = () => {
    close();
    if (!primary) return;
    const fallback = () => window.open(primary.clickUrl, "_blank", "noopener");
    try {
      void fetch(`/api/public/ads/${encodeURIComponent(primary.creativeId)}/click`, {
        method: "POST",
        keepalive: true,
      })
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as { data?: { url?: string } } | null;
          window.open(payload?.data?.url ?? primary.clickUrl, "_blank", "noopener");
        })
        .catch(fallback);
    } catch {
      fallback();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={labels.discover}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        className="interstitial-card relative w-full max-w-lg outline-none"
      >
        <div className="rounded-[10px] bg-gradient-to-b from-[#A4161A] via-[#0b0a0a] to-[#A4161A] p-[2px] shadow-[0_30px_80px_-20px_rgba(164,22,26,0.6)]">
          <div className="relative aspect-[16/10] max-h-[76vh] w-full overflow-hidden rounded-[8px] bg-[#0b0a0a]">
            <AdRotation campaigns={campaigns} houseLabels={houseLabels} />
          </div>
        </div>

        {/* Boutons : Découvrir (clic créa) + Fermer ✕ */}
        <div className="mt-4 flex items-center justify-center gap-3">
          {primary ? (
            <button
              type="button"
              onClick={discover}
              className="rounded-full bg-[#A4161A] px-5 py-2 text-xs font-black uppercase tracking-[0.18em] text-white ring-1 ring-white/25 transition-transform duration-200 hover:scale-105"
            >
              {labels.discover} →
            </button>
          ) : (
            <Link
              href="/pages/publicite"
              onClick={close}
              className="rounded-full bg-[#A4161A] px-5 py-2 text-xs font-black uppercase tracking-[0.18em] text-white ring-1 ring-white/25 transition-transform duration-200 hover:scale-105"
            >
              {labels.discover} →
            </Link>
          )}
          <button
            type="button"
            onClick={close}
            aria-label={labels.close}
            className="flex size-9 items-center justify-center rounded-full border border-white/25 text-white/70 transition-colors duration-200 hover:border-[#A4161A] hover:bg-[#A4161A] hover:text-white"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
