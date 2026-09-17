import { getTranslations } from "@/lib/i18n";
import { getFooterMenus } from "@/lib/public/homepage-data";

/**
 * Pied de page public — collé en bas de viewport (mt-auto), menus
 * footer_1→4, mentions et signature Conakry.
 * Task ID: 9-FOOTER
 */

export async function SiteFooter() {
  const { translate } = await getTranslations();
  const menus = await getFooterMenus();
  const year = new Intl.DateTimeFormat("fr-FR", { year: "numeric", timeZone: "Africa/Conakry" }).format(new Date());

  return (
    <footer className="mt-auto border-t-2 border-ink bg-ink text-paper">
      <div className="container-page py-8 md:py-10">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          {/* Marque + description */}
          <div>
            <p className="font-serif text-2xl font-black tracking-tight">
              INFOS<span className="text-red-bright">PRO</span>
              <span className="text-base font-normal text-paper/50">.net</span>
            </p>
            <p className="mt-3 max-w-sm text-xs leading-relaxed text-paper/60">{translate("public.footer.about")}</p>
          </div>

          {/* Colonnes de menus */}
          {menus.map((menu) => (
            <nav key={menu.label} aria-label={menu.label}>
              <p className="kicker text-paper/50">{menu.label}</p>
              <ul className="mt-3 space-y-2">
                {menu.items.map((item) => (
                  <li key={item.label}>
                    <a href={item.href} className="text-xs text-paper/80 transition-colors duration-200 hover:text-red-bright">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
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
