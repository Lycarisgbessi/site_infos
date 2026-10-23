import Link from "next/link";
import { getTranslations, localeTag, type Locale } from "@/lib/i18n";
import { LanguageSwitcher } from "@/lib/i18n/language-switcher";
import { getAdCampaigns, getMainMenu, getWeather, type NavItem } from "@/lib/public/homepage-data";
import { AdBanner } from "./ad-slot";
import { WorldClock } from "./world-clock";
import { getSettingsValues } from "@/server/services/settings";
import { MobileMenu, ThemeToggle } from "./mobile-nav";

/**
 * Barre utilitaire + en-tête + menu principal (§05.2).
 * UN SEUL menu horizontal — effet de survol : barre rouge qui se déploie
 * sous l'item actif (validée éditorialement).
 * Après les items issus de la base (menu « main ») : liens statiques
 * Rubriques (/rubriques), Vidéos (/video, si features.tv actif),
 * Podcast (/podcast) et Dossiers (/dossiers) — même style NavLinks,
 * également présents dans le drawer mobile (MobileMenu reçoit la même
 * liste d'items).
 * Task ID: 9-HEADER
 */

function formatDate(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Conakry",
  }).format(d);
}

export async function TopBar() {
  const { translate, locale } = await getTranslations();
  const now = new Date();

  // Météo compacte (1re ville visible — Conakry) : best-effort, jamais bloquant
  let weather: { city: string; temperature: number } | null = null;
  try {
    const w = await getWeather(1);
    if (w[0]) weather = { city: w[0].city, temperature: Math.round(w[0].temperature) };
  } catch {
    weather = null;
  }

  return (
    <div className="bg-brand-red text-white">
      <div className="container-page flex h-9 items-center justify-between gap-4 text-xs">
        <p className="flex shrink-0 items-center gap-3 truncate">
          <span>
            <span className="text-white/75">{translate("public.topbar.edition")} </span>
            <span className="font-medium">{formatDate(now, locale)}</span>
          </span>
          {weather && (
            <span className="hidden items-center gap-1 text-white/90 sm:flex" title={`Météo ${weather.city}`}>
              <svg aria-hidden viewBox="0 0 24 24" className="size-3.5 fill-none stroke-current" strokeWidth="2">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
              </svg>
              <span className="font-medium">{weather.city} {weather.temperature}°C</span>
            </span>
          )}
        </p>
        <WorldClock />
        <nav aria-label={translate("public.topbar.advertise")} className="hidden items-center gap-5 md:flex">
          <div className="flex items-center gap-5">
            <Link href="/pages/newsletters" className="font-medium text-white/90 transition-colors duration-200 hover:text-white hover:underline hover:decoration-white/60 hover:underline-offset-4">
              {translate("public.topbar.newsletters")}
            </Link>
            <Link href="/pages/contact" className="font-medium text-white/90 transition-colors duration-200 hover:text-white hover:underline hover:decoration-white/60 hover:underline-offset-4">
              {translate("public.topbar.contact")}
            </Link>
            <Link href="/pages/publicite" className="font-medium text-white/90 transition-colors duration-200 hover:text-white hover:underline hover:decoration-white/60 hover:underline-offset-4">
              {translate("public.topbar.advertise")}
            </Link>
          </div>
          <Link
            href="/login?next=/admin"
            className="bg-ink px-2.5 py-1 font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-black"
          >
            {translate("public.topbar.desk")}
          </Link>
        </nav>
      </div>
    </div>
  );
}

/** Lit un drapeau optionnel du modèle MenuItem (open_new_tab, highlight).
 * Défensif : la couche données (NavItem) ne les expose pas encore forcément,
 * et le nommage peut être camelCase (openNewTab) ou snake_case (open_new_tab). */
function menuFlag(item: NavItem, camelCase: string, snakeCase: string): boolean {
  const rec = item as unknown as Record<string, unknown>;
  return Boolean(rec[camelCase] ?? rec[snakeCase]);
}

function NavLinks({ items }: { items: NavItem[] }) {
  return (
    <>
      {items.map((item) => {
        const highlighted = menuFlag(item, "highlight", "highlight");
        const openNewTab = menuFlag(item, "openNewTab", "open_new_tab");
        return (
          <Link
            key={item.label}
            href={item.href}
            target={openNewTab ? "_blank" : undefined}
            rel={openNewTab ? "noopener noreferrer" : undefined}
            className={`group relative flex h-11 items-center whitespace-nowrap px-3 text-sm font-semibold tracking-wide transition-colors duration-200 hover:text-white lg:px-4 ${
              highlighted ? "text-red-bright" : "text-white/90"
            }`}
          >
            {item.label}
            {/* Barre rouge — se déploie de gauche à droite sous l'item au
                survol ; permanente si l'item est mis en avant (highlight) */}
            <span
              aria-hidden
              className={`pointer-events-none absolute inset-x-2 bottom-0 h-[3px] origin-left rounded-full bg-gradient-to-r from-brand-red to-orange-500 transition-transform duration-300 ease-[var(--ease-signal)] rtl:origin-right ${
                highlighted ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
              }`}
            />
          </Link>
        );
      })}
    </>
  );
}

export async function SiteHeader() {
  const { translate, locale } = await getTranslations();
  const [dbItems, settings, adCampaigns] = await Promise.all([
    getMainMenu(),
    getSettingsValues(["features.tv"]),
    getAdCampaigns().catch(() => ({})),
  ]);

  // Liens statiques ajoutés après les items DB (pas de doublon si le menu
  // « main » pointe déjà vers l'une de ces routes). Vidéos suit le flag
  // features.tv, lu comme /video : absent ou "true" = actif.
  const tvEnabled = settings["features.tv"] !== "false";
  const staticItems: NavItem[] = [
    { label: translate("public.nav.rubriques"), href: "/rubriques" },
    ...(tvEnabled ? [{ label: translate("public.nav.videos"), href: "/video" }] : []),
    { label: translate("public.nav.podcast"), href: "/podcast" },
    { label: translate("public.nav.dossiers"), href: "/dossiers" },
  ];
  const seenHrefs = new Set(dbItems.map((it) => it.href));
  const items = [...dbItems, ...staticItems.filter((it) => !seenHrefs.has(it.href))];

  return (
    <header className="bg-paper">
      {/* Bloc marque — logo à gauche, espace publicitaire à droite */}
      <div className="container-page flex flex-wrap items-center justify-between gap-x-8 gap-y-4 pb-4 pt-6">
        <div>
          <Link href="/" className="group inline-block" aria-label="INFOSPRO.net — Accueil">
            {/* Logo INFOSPRO.net (fond transparent) — remplaçable : public/logo.png */}
            <img
              src="/logo.png"
              alt="INFOSPRO.net"
              className="h-20 w-auto transition-transform duration-300 group-hover:scale-105 sm:h-24 md:h-28 dark:invert dark:hue-rotate-180"
            />
          </Link>
          <p className="mt-2 hidden text-sm text-ink-soft sm:block">{translate("public.header.tagline")}</p>
        </div>
        {/* AD-01 : espace publicitaire animé à côté du logo — gabarit
            compact (leaderboard 728×90) : s'inscrit dans l'espace libre
            sans chevaucher le logo ni allonger l'en-tête. */}
        <div className="hidden min-w-0 flex-1 justify-end md:flex">
          <div className="w-full max-w-[560px] shrink">
            <AdBanner
              code="AD-01"
              campaigns={adCampaigns}
              formatOverride="leaderboard"
              placeholder
            />
          </div>
        </div>
        <p className="flex shrink-0 items-center gap-2 text-end text-xs text-ink-faint md:hidden">
          <span className="inline-block size-2 animate-pulse rounded-full bg-brand-red" aria-hidden />
          {translate("public.topbar.city")}
        </p>
      </div>

      {/* Menu principal — UNIQUE, sticky, fond noir + accents rouges */}
      <nav
        aria-label={translate("public.nav.menu")}
        className="sticky top-0 z-40 border-b-2 border-brand-red bg-[#0a0a0b] shadow-[0_4px_16px_rgba(0,0,0,0.25)]"
      >
        <div className="container-page flex items-center justify-between">
          <MobileMenu items={items} deskLabel={translate("public.topbar.desk")} deskHref="/login?next=/admin" />
          <div className="hidden items-center overflow-x-auto scrollbar-none md:flex">
            <NavLinks items={items} />
          </div>
          <div className="flex items-center gap-1 [&_button]:text-white/90 [&_button:hover]:text-red-bright [&_svg]:current-color">
            <LanguageSwitcher
              currentLocale={locale as Locale}
              label={translate("public.language.label")}
              title={translate("public.language.switcher")}
            />
            <ThemeToggle />
            <Link
              href="/login?next=/admin"
              className="hidden h-11 shrink-0 items-center border-s border-white/20 px-4 text-sm font-semibold text-white/80 transition-colors duration-200 hover:text-red-bright md:flex"
            >
              {translate("public.topbar.desk")}
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
