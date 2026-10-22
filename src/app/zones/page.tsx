import type { Metadata } from "next";
import { getTranslations } from "@/lib/i18n";
import { TopBar, SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { Reveal } from "@/components/public/reveal";
import {
  getZonesWithPublishedArticles,
  groupByInitial,
  type PublicZoneIndexItem,
} from "@/lib/public/taxonomy-data";

/**
 * Route `/zones` — index alphabétique des zones géographiques
 * (continent, pays, région, ville) rattachées à au moins un article
 * publié, avec leur compte d'articles. Même gabarit que `/tags` ; les
 * puces ne sont pas cliquables : aucune page de détail `/zones/{slug}`
 * n'existe encore.
 */

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://site-infos-six.vercel.app";

const TYPE_LABEL_KEYS: Record<PublicZoneIndexItem["type"], string> = {
  continent: "public.zones.type.continent",
  country: "public.zones.type.country",
  region: "public.zones.type.region",
  city: "public.zones.type.city",
};

export async function generateMetadata(): Promise<Metadata> {
  const { translate } = await getTranslations();
  return {
    title: translate("public.zones.pageTitle"),
    description: translate("public.zones.pageSubtitle"),
    alternates: { canonical: `${SITE_URL}/zones` },
  };
}

export default async function ZonesIndexPage() {
  const { translate } = await getTranslations();
  const zones = await getZonesWithPublishedArticles();
  const groups = groupByInitial(zones);

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <TopBar />
      <SiteHeader />

      <main id="contenu" className="flex-1 pb-16">
        <div className="container-page pt-10">
          <header className="border-b-2 border-ink pb-3">
            <p className="kicker text-brand-red">{translate("public.zones.pageTitle")}</p>
            <h1 className="mt-1 font-serif text-3xl font-black tracking-tight md:text-4xl">
              {translate("public.zones.pageTitle")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-ink-soft">{translate("public.zones.pageSubtitle")}</p>
          </header>

          {groups.length === 0 ? (
            <p className="mt-8 border border-dashed border-rule-strong p-6 text-sm text-ink-soft">
              {translate("public.zones.empty")}
            </p>
          ) : (
            <div className="mt-6 space-y-8">
              {groups.map((group, i) => (
                <Reveal key={group.letter} delay={Math.min(i, 5) * 60}>
                  <section aria-label={group.letter}>
                    <div className="flex items-baseline gap-3 border-b border-rule pb-2">
                      <h2 className="font-serif text-xl font-black tracking-tight">{group.letter}</h2>
                      <span className="text-xs uppercase tracking-widest text-ink-faint">
                        {translate("public.zones.articlesCount", { count: group.items.length })}
                      </span>
                    </div>
                    <ul className="mt-4 flex flex-wrap gap-2.5">
                      {group.items.map((zone) => (
                        <li
                          key={zone.id}
                          className="inline-flex items-baseline gap-1.5 border border-rule bg-paper-alt px-3 py-1.5 text-sm font-semibold text-ink"
                        >
                          {zone.name}
                          <span className="text-[0.65rem] font-normal uppercase tracking-wide text-ink-faint">
                            {translate(TYPE_LABEL_KEYS[zone.type])}
                          </span>
                          <span className="text-[0.65rem] font-normal text-ink-faint">{zone.articleCount}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
