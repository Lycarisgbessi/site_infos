import Link from "next/link";
import { getTranslations, localeTag, type Locale } from "@/lib/i18n";
import { LanguageSwitcher } from "@/lib/i18n/language-switcher";
import { getMainMenu, type NavItem } from "@/lib/public/homepage-data";
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

  return (
    <div className="bg-brand-red text-white">
      <div className="container-page flex h-9 items-center justify-between gap-4 text-xs">
        <p className="truncate">
          <span className="text-white/75">{translate("public.topbar.edition")} </span>
          <span className="font-medium">{formatDate(now, locale)}</span>
        </p>
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
            className={`group relative flex h-11 items-center whitespace-nowrap px-3 text-sm font-semibold tracking-wide text-white transition-colors duration-200 hover:text-white lg:px-4 ${
              highlighted ? "text-red-bright" : "text-paper/90"
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
  const [dbItems, settings] = await Promise.all([
    getMainMenu(),
    getSettingsValues(["features.tv"]),
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
      {/* Bloc marque */}
      <div className="container-page flex items-end justify-between gap-6 pb-4 pt-6">
        <div>
          <Link href="/" className="group inline-block" aria-label="FMK 224 Info — Accueil">
            {/* Logo FMK 224 Info — remplaçable en une seule opération : public/logo.jpg */}
            <img
              src="/logo.jpg"
              alt="FMK 224 Info"
              className="h-14 w-auto transition-transform duration-300 group-hover:scale-105 md:h-16"
            />
          </Link>
          <p className="mt-2 hidden text-sm text-ink-soft sm:block">{translate("public.header.tagline")}</p>
        </div>
        <p className="hidden shrink-0 items-center gap-2 text-end text-xs text-ink-faint md:flex">
          <span className="inline-block size-2 animate-pulse rounded-full bg-brand-red" aria-hidden />
          {translate("public.topbar.city")}
        </p>
      </div>

      {/* Menu principal — UNIQUE, sticky, fond noir + accents rouges */}
      <nav
        aria-label={translate("public.nav.menu")}
        className="sticky top-0 z-40 border-b-2 border-brand-red bg-ink shadow-[0_4px_16px_rgba(0,0,0,0.25)]"
      >
        <div className="container-page flex items-center justify-between">
          <MobileMenu items={items} deskLabel={translate("public.topbar.desk")} deskHref="/login?next=/admin" />
          <div className="hidden items-center overflow-x-auto md:flex">
            <NavLinks items={items} />
          </div>
          <div className="flex items-center gap-1">
            <LanguageSwitcher
              currentLocale={locale as Locale}
              label={translate("public.language.label")}
              title={translate("public.language.switcher")}
            />
            <ThemeToggle />
            <Link
              href="/login?next=/admin"
              className="hidden h-11 shrink-0 items-center border-s border-paper/20 px-4 text-sm font-semibold text-paper/80 transition-colors duration-200 hover:text-red-bright md:flex"
            >
              {translate("public.topbar.desk")}
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
