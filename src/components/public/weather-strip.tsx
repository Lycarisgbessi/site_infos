import { getTranslations } from "@/lib/i18n";
import type { WeatherNow } from "@/lib/public/homepage-data";

/**
 * Bandeau météo (Z-10) — données réelles Open-Meteo pour les villes visibles.
 * Task ID: 9-WEATHER
 */

/** Correspondance code météo WMO → libellé + pictogramme. */
function describe(code: number): { label: string; icon: string } {
  if (code === 0) return { label: "Ciel dégagé", icon: "☀" };
  if (code <= 2) return { label: "Peu nuageux", icon: "🌤" };
  if (code === 3) return { label: "Couvert", icon: "☁" };
  if (code <= 48) return { label: "Brouillard", icon: "🌫" };
  if (code <= 57) return { label: "Bruine", icon: "🌦" };
  if (code <= 67) return { label: "Pluie", icon: "🌧" };
  if (code <= 77) return { label: "Neige", icon: "🌨" };
  if (code <= 82) return { label: "Averses", icon: "🌧" };
  if (code <= 86) return { label: "Neige forte", icon: "❄" };
  return { label: "Orage", icon: "⛈" };
}

export async function WeatherStrip({ weather, sponsorNode }: { weather: WeatherNow[]; sponsorNode?: React.ReactNode }) {
  const { translate } = await getTranslations();
  if (weather.length === 0) return null;

  return (
    <section aria-label={translate("public.weather.title")} className="border border-rule bg-paper-alt">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-4 py-2.5">
        <h2 className="font-serif text-base font-bold">{translate("public.weather.title")}</h2>
        {sponsorNode}
      </div>
      <ul className="grid grid-cols-2 divide-rule sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
        {weather.map((w, i) => {
          const d = describe(w.code);
          return (
            <li
              key={w.city}
              className={`flex items-center gap-3 px-4 py-3 ${i >= 2 ? "border-t border-rule sm:border-t-0" : ""} ${
                i >= 3 ? "lg:border-t-0" : ""
              }`}
            >
              <span aria-hidden className="text-2xl leading-none">
                {d.icon}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{w.city}</p>
                <p className="font-mono text-lg font-bold leading-tight text-brand-red">{w.temperature}°C</p>
                <p className="truncate text-[0.65rem] text-ink-faint">
                  {d.label} · {translate("public.weather.humidity")} {w.humidity}%
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
