import { getTranslations } from "@/lib/i18n";
import { getMainMenu, type NavItem } from "@/lib/public/homepage-data";

/**
 * Barre utilitaire + en-tête + menu principal (§05.2).
 * UN SEUL menu horizontal — effet de survol : barre rouge qui se déploie
 * sous l'item actif (validée éditorialement).
 * Task ID: 9-HEADER
 */

function formatDate(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar" : "fr-FR", {
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
          <a href="/pages/newsletters" className="transition-colors duration-200 hover:text-red-bright">
            {translate("public.topbar.newsletters")}
          </a>
          <a href="/pages/contact" className="transition-colors duration-200 hover:text-red-bright">
            {translate("public.topbar.contact")}
          </a>
          <a href="/pages/publicite" className="transition-colors duration-200 hover:text-red-bright">
            {translate("public.topbar.advertise")}
          </a>
          <a
            href="/login?next=/admin"
            className="bg-brand-red px-2.5 py-1 font-semibold transition-colors duration-200 hover:bg-red-deep"
          >
            {translate("public.topbar.desk")}
          </a>
        </nav>
      </div>
    </div>
  );
}

function NavLinks({ items }: { items: NavItem[] }) {
  return (
    <>
      {items.map((item) => (
        <a
          key={item.label}
          href={item.href}
          className="group relative flex h-11 items-center whitespace-nowrap px-3 text-sm font-semibold tracking-wide text-ink transition-colors duration-200 hover:text-brand-red lg:px-4"
        >
          {item.label}
          {/* Barre de survol — se déploie de gauche à droite sous l'item */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-2 bottom-0 h-[3px] origin-left scale-x-0 bg-brand-red transition-transform duration-300 ease-[var(--ease-signal)] group-hover:scale-x-100"
          />
        </a>
      ))}
    </>
  );
}

export async function SiteHeader() {
  const { translate } = await getTranslations();
  const items = await getMainMenu();

  return (
    <header className="bg-paper">
      {/* Bloc marque */}
      <div className="container-page flex items-end justify-between gap-6 pb-4 pt-6">
        <div>
          <a href="/" className="inline-block" aria-label="INFOSPRO.net — Accueil">
            <span className="font-serif text-4xl font-black leading-none tracking-tight md:text-5xl">
              INFOS<span className="text-brand-red">PRO</span>
              <span className="text-xl font-normal text-ink-faint md:text-2xl">.net</span>
            </span>
          </a>
          <p className="mt-2 hidden text-sm text-ink-soft sm:block">{translate("public.header.tagline")}</p>
        </div>
        <p className="hidden shrink-0 items-center gap-2 text-right text-xs text-ink-faint md:flex">
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
          <div className="flex items-center overflow-x-auto">
            <NavLinks items={items} />
          </div>
          <a
            href="/login?next=/admin"
            className="hidden h-11 shrink-0 items-center border-l border-rule px-4 text-sm font-semibold text-ink-soft transition-colors duration-200 hover:text-brand-red md:flex"
          >
            {translate("public.topbar.desk")}
          </a>
        </div>
      </nav>
    </header>
  );
}
