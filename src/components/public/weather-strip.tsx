import { getTranslations } from "@/lib/i18n";
import type { WeatherNow } from "@/lib/public/homepage-data";

/**
 * Bandeau météo (Z-10) — données réelles Open-Meteo pour les villes
 * visibles. Rendu épuré : cartes uniformes, icônes SVG cohérentes,
 * température en vedette, filet rouge d'accent.
 */

/** Code WMO → libellé + icône SVG (soleil/lune selon isDay inclus). */
function describe(code: number, isDay: boolean): { label: string; icon: React.ReactNode } {
  const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const sun = (
    <svg viewBox="0 0 24 24" className="size-6 text-amber-500" {...stroke}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
  const moon = (
    <svg viewBox="0 0 24 24" className="size-6 text-indigo-400" {...stroke}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
  const cloudSun = (
    <svg viewBox="0 0 24 24" className="size-6 text-amber-500" {...stroke}>
      <path d="M12 2v2M4.9 4.9l1.4 1.4M2 12h2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M17.5 21a4.5 4.5 0 1 0-.4-8.98A6 6 0 1 0 6 16" />
    </svg>
  );
  const cloud = (
    <svg viewBox="0 0 24 24" className="size-6 text-slate-400" {...stroke}>
      <path d="M17.5 21a4.5 4.5 0 1 0-.4-8.98A6 6 0 1 0 6 16" />
    </svg>
  );
  const rain = (
    <svg viewBox="0 0 24 24" className="size-6 text-sky-500" {...stroke}>
      <path d="M17.5 17a4.5 4.5 0 1 0-.4-8.98A6 6 0 1 0 6 12" />
      <path d="M8 19v2M12 18v2M16 19v2" />
    </svg>
  );
  const storm = (
    <svg viewBox="0 0 24 24" className="size-6 text-violet-500" {...stroke}>
      <path d="M17.5 15a4.5 4.5 0 1 0-.4-8.98A6 6 0 1 0 6 10" />
      <path d="M13 12l-2 5h3l-2 5" />
    </svg>
  );
  const fog = (
    <svg viewBox="0 0 24 24" className="size-6 text-slate-400" {...stroke}>
      <path d="M4 9h16M6 13h12M8 17h8" />
    </svg>
  );
  const snow = (
    <svg viewBox="0 0 24 24" className="size-6 text-sky-300" {...stroke}>
      <path d="M12 3v18M4 7l16 10M20 7L4 17" />
    </svg>
  );

  if (code === 0) return { label: "Ciel dégagé", icon: isDay ? sun : moon };
  if (code <= 2) return { label: "Peu nuageux", icon: isDay ? cloudSun : moon };
  if (code === 3) return { label: "Couvert", icon: cloud };
  if (code <= 48) return { label: "Brouillard", icon: fog };
  if (code <= 57) return { label: "Bruine", icon: rain };
  if (code <= 67) return { label: "Pluie", icon: rain };
  if (code <= 77) return { label: "Neige", icon: snow };
  if (code <= 82) return { label: "Averses", icon: rain };
  if (code <= 86) return { label: "Neige forte", icon: snow };
  return { label: "Orage", icon: storm };
}

export async function WeatherStrip({ weather, sponsorNode }: { weather: WeatherNow[]; sponsorNode?: React.ReactNode }) {
  const { translate } = await getTranslations();
  if (weather.length === 0) return null;

  return (
    <section aria-label={translate("public.weather.title")} className="border border-rule bg-paper">
      {/* En-tête — filet rouge, aligné avec l'identité « En continu » */}
      <header className="flex items-center gap-2 border-b-2 border-brand-red px-4 pb-2 pt-3">
        <svg aria-hidden viewBox="0 0 24 24" className="size-4 text-brand-red" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.5 21a4.5 4.5 0 1 0-.4-8.98A6 6 0 1 0 6 16" />
        </svg>
        <h2 className="kicker text-base font-bold text-brand-red">{translate("public.weather.title")}</h2>
      </header>

      {/* Cartes ville — grille uniforme, sans filets croisés */}
      <ul className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-1">
        {weather.map((w) => {
          const d = describe(w.code, w.isDay);
          return (
            <li
              key={w.city}
              className="flex items-center gap-3 rounded-md border border-rule bg-paper-alt px-3 py-2.5 transition-colors duration-200 hover:border-brand-red/40"
            >
              <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-paper">
                {d.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.8rem] font-bold leading-tight">{w.city}</p>
                <p className="truncate text-[0.65rem] text-ink-faint">
                  {d.label} · {translate("public.weather.humidity")} {w.humidity}%
                </p>
              </div>
              <p className="shrink-0 font-mono text-lg font-bold leading-none text-brand-red">
                {Math.round(w.temperature)}°
              </p>
            </li>
          );
        })}
      </ul>

      {sponsorNode && <div className="border-t border-rule px-4 py-2">{sponsorNode}</div>}
    </section>
  );
}
