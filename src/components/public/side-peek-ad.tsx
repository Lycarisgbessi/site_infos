"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { PublicAdCampaign } from "@/lib/public/homepage-data";
import { AdRotation, type AdHouseLabels } from "@/components/public/ad-creative-client";

/**
 * SidePeekAd — présence taquine latérale droite (système « taquin » 2026-10).
 * Encart 300 px centré verticalement (fixed right-4 top-1/2), bordure
 * dégradée rouge, roue AD-06 étiquetée « Suggestion ».
 * ~2,5 s après l'arrivée + 300 px de scroll : se glisse depuis le bord
 * droit (ressort CSS overshoot) ; reste 11 s ; repart 14 s ; revient —
 * boucle. Pause au survol, fermable (sessionStorage), écrans ≥ 1280 px
 * uniquement (xl:block).
 */

const DISMISS_KEY = "infospro.side-peek.dismissed";
const ACTIVATE_DELAY_MS = 2_500;
const ACTIVATE_SCROLL_PX = 300;
/** Cycle : 11 s visible + 14 s parti = 25 s. */
const CYCLE_MS = 25_000;
const PEEK_MS = 11_000;
const TICK_MS = 400;

export function SidePeekAd({
  campaigns,
  houseLabels,
  label,
  closeLabel,
  enabled = true,
}: {
  campaigns: PublicAdCampaign[];
  houseLabels: AdHouseLabels;
  label: string;
  closeLabel: string;
  /** Court-circuit réglage admin (les side-pek suivent ads.sidebar). */
  enabled?: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [activated, setActivated] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const hoverRef = useRef(false);

  // Dismiss persistant pour la session.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(DISMISS_KEY) === "1") {
      setDismissed(true);
    }
  }, []);

  // Activation : ~2,5 s après l'arrivée ET 300 px de scroll.
  useEffect(() => {
    if (dismissed || !enabled) return;
    let elapsedDelay = false;
    const tryActivate = () => {
      if (elapsedDelay && window.scrollY > ACTIVATE_SCROLL_PX) setActivated(true);
    };
    const timer = window.setTimeout(() => {
      elapsedDelay = true;
      tryActivate();
    }, ACTIVATE_DELAY_MS);
    const onScroll = () => tryActivate();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [dismissed, enabled]);

  // Horloge du cycle peek 11 s / away 14 s — en pause au survol et onglet caché.
  useEffect(() => {
    if (dismissed || !enabled || !activated) return;
    const id = window.setInterval(() => {
      if (hoverRef.current || document.hidden) return;
      setElapsed((e) => e + TICK_MS);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [dismissed, enabled, activated]);

  if (!enabled || dismissed) return null;

  const out = !activated || elapsed % CYCLE_MS >= PEEK_MS;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* session indisponible : fermeture pour la navigation courante */
    }
    setDismissed(true);
  };

  return (
    <div
      role="complementary"
      aria-label={`${label} AD-06`}
      data-ad-slot="AD-06"
      className={`side-peek ${out ? "peek-out pointer-events-none" : ""} z-40 hidden w-[300px] xl:block`}
      onMouseEnter={() => (hoverRef.current = true)}
      onMouseLeave={() => (hoverRef.current = false)}
    >
      {/* Bordure dégradée rouge signature */}
      <div className="rounded-[10px] bg-gradient-to-b from-[#A4161A] via-[#0b0a0a] to-[#A4161A] p-[2px] shadow-[0_14px_40px_-14px_rgba(164,22,26,0.55)]">
        <div className="relative overflow-hidden rounded-[8px] bg-paper">
          <div className="flex items-center justify-between gap-2 border-b border-[#A4161A]/20 px-3 py-1.5">
            <span className="text-[0.58rem] font-bold uppercase tracking-[0.26em] text-[#A4161A]">{label}</span>
            <button
              type="button"
              onClick={dismiss}
              aria-label={closeLabel}
              className="flex h-6 w-6 items-center justify-center rounded-full text-ink-faint transition-colors duration-200 hover:bg-[#A4161A] hover:text-white"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
          <div className="h-[250px]">
            <AdRotation campaigns={campaigns} houseLabels={houseLabels} />
          </div>
        </div>
      </div>
    </div>
  );
}
