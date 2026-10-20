import Link from "next/link";
import { getTranslations, localeTag, type Locale } from "@/lib/i18n";
import { LanguageSwitcher } from "@/lib/i18n/language-switcher";
import { getMainMenu, type NavItem } from "@/lib/public/homepage-data";
import { MobileMenu, ThemeToggle } from "./mobile-nav";

/**
 * Barre utilitaire + en-tête + menu principal (§05.2).
 * UN SEUL menu horizontal — effet de survol : barre rouge qui se déploie
 * sous l'item actif (validée éditorialement).
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
    <div className="bg-ink text-paper">
      <div className="container-page flex h-9 items-center justify-between gap-4 text-xs">
        <p className="truncate">
          <span className="text-paper/60">{translate("public.topbar.edition")} </span>
          {formatDate(now, locale)}
        </p>
        <nav aria-label={translate("public.topbar.advertise")} className="hidden items-center gap-5 md:flex">
          <div className="flex items-center gap-5">
            <Link href="/pages/newsletters" className="transition-colors duration-200 hover:text-red-bright">
              {translate("public.topbar.newsletters")}
            </Link>
            <Link href="/pages/contact" className="transition-colors duration-200 hover:text-red-bright">
              {translate("public.topbar.contact")}
            </Link>
            <Link href="/pages/publicite" className="transition-colors duration-200 hover:text-red-bright">
              {translate("public.topbar.advertise")}
            </Link>
          </div>
          <Link
            href="/login?next=/admin"
            className="bg-brand-red px-2.5 py-1 font-semibold transition-colors duration-200 hover:bg-red-deep"
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
            className={`group relative flex h-11 items-center whitespace-nowrap px-3 text-sm font-semibold tracking-wide transition-colors duration-200 hover:text-brand-red lg:px-4 ${
              highlighted ? "text-brand-red" : "text-ink"
            }`}
          >
            {item.label}
            {/* Barre rouge — se déploie de gauche à droite sous l'item au
                survol ; permanente si l'item est mis en avant (highlight) */}
            <span
              aria-hidden
              className={`pointer-events-none absolute inset-x-2 bottom-0 h-[3px] origin-left bg-brand-red transition-transform duration-300 ease-[var(--ease-signal)] rtl:origin-right ${
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
  const items = await getMainMenu();

  return (
    <header className="bg-paper">
      {/* Bloc marque */}
      <div className="container-page flex items-end justify-between gap-6 pb-4 pt-6">
        <div>
          <Link href="/" className="inline-block" aria-label="INFOSPRO.net — Accueil">
            <span className="font-serif text-4xl font-black leading-none tracking-tight md:text-5xl">
              INFOS<span className="text-brand-red">PRO</span>
              <span className="text-xl font-normal text-ink-faint md:text-2xl">.net</span>
            </span>
          </Link>
          <p className="mt-2 hidden text-sm text-ink-soft sm:block">{translate("public.header.tagline")}</p>
        </div>
        <p className="hidden shrink-0 items-center gap-2 text-end text-xs text-ink-faint md:flex">
          <span className="inline-block size-2 animate-pulse rounded-full bg-brand-red" aria-hidden />
          {translate("public.topbar.city")}
        </p>
      </div>

      {/* Menu principal — UNIQUE, sticky, filets haut/bas */}
      <nav
        aria-label={translate("public.nav.menu")}
        className="sticky top-0 z-40 border-y border-rule bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85"
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
              className="hidden h-11 shrink-0 items-center border-l border-rule px-4 text-sm font-semibold text-ink-soft transition-colors duration-200 hover:text-brand-red md:flex"
            >
              {translate("public.topbar.desk")}
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
