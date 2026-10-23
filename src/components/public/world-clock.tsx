"use client";

import { useEffect, useState } from "react";

/**
 * Horloges des fuseaux horaires (TopBar) — heure locale de villes clés
 * pour les lecteurs de la diaspora. Rendu client (heure juste), mise à
 * jour toutes les 30 s, discret sur fond rouge.
 */

const CITIES: { label: string; timeZone: string }[] = [
  { label: "Conakry", timeZone: "Africa/Conakry" },
  { label: "Londres", timeZone: "Europe/London" },
  { label: "Paris", timeZone: "Europe/Paris" },
  { label: "New York", timeZone: "America/New_York" },
  { label: "Dubaï", timeZone: "Asia/Dubai" },
  { label: "Pékin", timeZone: "Asia/Shanghai" },
];

function timeIn(timeZone: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date());
}

export function WorldClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // Heure calculée côté client uniquement (évite l'hydratation divergente)
  if (!now) {
    return (
      <span className="hidden items-center gap-3 text-[0.68rem] font-medium text-white/85 xl:flex">
        {CITIES.map((c) => (
          <span key={c.label}>
            {c.label} <span className="font-mono">--:--</span>
          </span>
        ))}
      </span>
    );
  }

  return (
    <span className="hidden items-center gap-3 text-[0.68rem] font-medium text-white/85 xl:flex" aria-label="Heures GMT et fuseaux horaires">
      {CITIES.map((c, i) => (
        <span key={c.label} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden className="text-white/40">·</span>}
          {c.label} <span className="font-mono tabular-nums text-white">{timeIn(c.timeZone)}</span>
        </span>
      ))}
    </span>
  );
}
