import type { Metadata } from "next";
import { getTranslations } from "@/lib/i18n";
import { TopBar, SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { Reveal } from "@/components/public/reveal";
import {
  getEntitiesWithPublishedArticles,
  groupByInitial,
  type PublicEntityIndexItem,
} from "@/lib/public/taxonomy-data";

/**
 * Route `/entites` — index alphabétique des entités (personnalités,
 * organisations, lieux) citées par au moins un article publié, avec leur
 * compte d'articles. Même gabarit que `/tags` ; les puces ne sont pas
 * cliquables : aucune page de détail `/entites/{slug}` n'existe encore.
 */

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://site-infos-six.vercel.app";

const TYPE_LABEL_KEYS: Record<PublicEntityIndexItem["type"], string> = {
  person: "public.entites.type.person",
  organization: "public.entites.type.organization",
  place: "public.entites.type.place",
};

export async function generateMetadata(): Promise<Metadata> {
  const { translate } = await getTranslations();
  return {
    title: translate("public.entites.pageTitle"),
    description: translate("public.entites.pageSubtitle"),
    alternates: { canonical: `${SITE_URL}/entites` },
  };
}

export default async function EntitesIndexPage() {
  const { translate } = await getTranslations();
  const entities = await getEntitiesWithPublishedArticles();
  const groups = groupByInitial(entities);

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <TopBar />
      <SiteHeader />

      <main id="contenu" className="flex-1 pb-16">
        <div className="container-page pt-10">
          <header className="border-b-2 border-ink pb-3">
            <p className="kicker text-brand-red">{translate("public.entites.pageTitle")}</p>
            <h1 className="mt-1 font-serif text-3xl font-black tracking-tight md:text-4xl">
              {translate("public.entites.pageTitle")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-ink-soft">{translate("public.entites.pageSubtitle")}</p>
          </header>

          {groups.length === 0 ? (
            <p className="mt-8 border border-dashed border-rule-strong p-6 text-sm text-ink-soft">
              {translate("public.entites.empty")}
            </p>
          ) : (
            <div className="mt-6 space-y-8">
              {groups.map((group, i) => (
                <Reveal key={group.letter} delay={Math.min(i, 5) * 60}>
                  <section aria-label={group.letter}>
                    <div className="flex items-baseline gap-3 border-b border-rule pb-2">
                      <h2 className="font-serif text-xl font-black tracking-tight">{group.letter}</h2>
                      <span className="text-xs uppercase tracking-widest text-ink-faint">
                        {translate("public.entites.articlesCount", { count: group.items.length })}
                      </span>
                    </div>
                    <ul className="mt-4 flex flex-wrap gap-2.5">
                      {group.items.map((entity) => (
                        <li
                          key={entity.id}
                          className="inline-flex items-baseline gap-1.5 border border-rule bg-paper-alt px-3 py-1.5 text-sm font-semibold text-ink"
                          title={entity.roleTitle ?? undefined}
                        >
                          {entity.name}
                          <span className="text-[0.65rem] font-normal uppercase tracking-wide text-ink-faint">
                            {translate(TYPE_LABEL_KEYS[entity.type])}
                          </span>
                          <span className="text-[0.65rem] font-normal text-ink-faint">{entity.articleCount}</span>
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
