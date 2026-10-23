import Link from "next/link";
import { getTranslations, localeTag } from "@/lib/i18n";
import { db } from "@/lib/db";
import { getFooterMenus, type NavItem } from "@/lib/public/homepage-data";

/**
 * Pied de page public — collé en bas de viewport (mt-auto), menus
 * footer_1→4, colonne « Explorer » (rubriques, dossiers, mots-clés,
 * vidéos, podcast), colonne « Pages » alimentée par les pages publiées
 * en base (repli sur les liens statiques historiques newsletters /
 * contact / publicité si aucune), mentions et signature Conakry.
 * Task ID: 9-FOOTER
 */

/** Lit un drapeau optionnel du modèle MenuItem (open_new_tab, highlight).
 * Défensif : la couche données (NavItem) ne les expose pas encore forcément,
 * et le nommage peut être camelCase (openNewTab) ou snake_case (open_new_tab). */
function menuFlag(item: NavItem, camelCase: string, snakeCase: string): boolean {
  const rec = item as unknown as Record<string, unknown>;
  return Boolean(rec[camelCase] ?? rec[snakeCase]);
}

/** Lien de menu du pied de page — open_new_tab (nouvel onglet) et
 * highlight (style CTA : rouge vif + soulignement) consommés optionnellement. */
function FooterLink({ item }: { item: NavItem }) {
  const highlighted = menuFlag(item, "highlight", "highlight");
  const openNewTab = menuFlag(item, "openNewTab", "open_new_tab");
  return (
    <Link
      href={item.href}
      target={openNewTab ? "_blank" : undefined}
      rel={openNewTab ? "noopener noreferrer" : undefined}
      className={
        highlighted
          ? "text-xs font-bold text-red-bright underline decoration-red-bright decoration-2 underline-offset-4 transition-colors duration-200 hover:text-paper"
          : "text-xs text-paper/80 transition-colors duration-200 hover:text-red-bright"
      }
    >
      {item.label}
    </Link>
  );
}

/** Pages publiées en base (is_published) pour la colonne « Pages ».
 * Repli statique — liens historiques vers les pages éditoriales — si la
 * base ne renvoie aucune page publiée. */
async function getFooterPageLinks(fallback: NavItem[]): Promise<NavItem[]> {
  const pages = await db.page.findMany({
    where: { is_published: true, deleted_at: null, locale: "fr" },
    orderBy: { updated_at: "desc" },
    take: 6,
    select: { title: true, slug: true },
  });
  if (pages.length === 0) return fallback;
  return pages.map((p) => ({ label: p.title, href: `/pages/${p.slug}` }));
}

export async function SiteFooter() {
  const { translate, locale } = await getTranslations();
  const [menus, pageLinks] = await Promise.all([
    getFooterMenus(),
    getFooterPageLinks([
      { label: translate("public.topbar.newsletters"), href: "/pages/newsletters" },
      { label: translate("public.topbar.contact"), href: "/pages/contact" },
      { label: translate("public.topbar.advertise"), href: "/pages/publicite" },
    ]),
  ]);
  const year = new Intl.DateTimeFormat(localeTag(locale), { year: "numeric", timeZone: "Africa/Conakry" }).format(new Date());

  const exploreLinks: NavItem[] = [
    { label: translate("public.nav.rubriques"), href: "/rubriques" },
    { label: translate("public.nav.dossiers"), href: "/dossiers" },
    { label: translate("public.tags.pageTitle"), href: "/tags" },
    { label: translate("public.nav.videos"), href: "/video" },
    { label: translate("public.nav.podcast"), href: "/podcast" },
  ];

  return (
    <footer className="mt-auto border-t-2 border-ink bg-ink text-paper">
      <div className="container-page py-8 md:py-10">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_repeat(6,1fr)]">
          {/* Marque + description */}
          <div>
            <img src="/logo.png" alt="INFOSPRO.net" className="h-14 w-auto rounded-lg bg-white px-2.5 py-1" />
            <p className="mt-3 max-w-sm text-xs leading-relaxed text-paper/60">{translate("public.footer.about")}</p>
          </div>

          {/* Colonnes de menus (footer_1..4 en base) */}
          {menus.map((menu) => (
            <nav key={menu.label} aria-label={menu.label}>
              <p className="kicker flex items-center gap-1.5 text-paper/50">{menu.label}</p>
              <ul className="mt-3 space-y-2">
                {menu.items.map((item) => (
                  <li key={item.label}>
                    <FooterLink item={item} />
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          {/* Colonne Explorer : classifications et modules du site */}
          <nav aria-label={translate("public.footer.explore")}>
            <p className="kicker flex items-center gap-1.5 text-paper/50">{translate("public.footer.explore")}</p>
            <ul className="mt-3 space-y-2">
              {exploreLinks.map((item) => (
                <li key={item.href}>
                  <FooterLink item={item} />
                </li>
              ))}
            </ul>
          </nav>

          {/* Colonne Pages : pages publiées en base (repli statique) */}
          <nav aria-label={translate("public.footer.pages")}>
            <p className="kicker flex items-center gap-1.5 text-paper/50">{translate("public.footer.pages")}</p>
            <ul className="mt-3 space-y-2">
              {pageLinks.map((item) => (
                <li key={item.href}>
                  <FooterLink item={item} />
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-2 border-t border-paper/15 pt-4 text-[0.7rem] text-paper/50 md:flex-row md:items-center">
          <p>
            © {year} INFOSPRO.net — {translate("public.footer.rights")}
          </p>
          <p>{translate("public.footer.madeIn")}</p>
        </div>
      </div>
    </footer>
  );
}
