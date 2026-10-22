import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "@/lib/i18n";
import { TopBar, SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { Reveal } from "@/components/public/reveal";
import { getTagsWithPublishedArticles, groupByInitial } from "@/lib/public/taxonomy-data";

/**
 * Route `/tags` — index alphabétique de tous les tags (sujets/mots-clés)
 * utilisés par au moins un article publié, avec leur compte d'articles.
 * Chaque puce est cliquable vers `/tags/{slug}` (liste des articles du
 * mot-clé). Même gabarit que les pages vidéos/rubriques : kicker, titre
 * border-b-2, groupes par lettre initiale (accents normalisés).
 */

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://site-infos-six.vercel.app";

export async function generateMetadata(): Promise<Metadata> {
  const { translate } = await getTranslations();
  return {
    title: translate("public.tags.pageTitle"),
    description: translate("public.tags.pageSubtitle"),
    alternates: { canonical: `${SITE_URL}/tags` },
  };
}

export default async function TagsIndexPage() {
  const { translate } = await getTranslations();
  const tags = await getTagsWithPublishedArticles();
  const groups = groupByInitial(tags);

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <TopBar />
      <SiteHeader />

      <main id="contenu" className="flex-1 pb-16">
        <div className="container-page pt-10">
          <header className="border-b-2 border-ink pb-3">
            <p className="kicker text-brand-red">{translate("public.tags.pageTitle")}</p>
            <h1 className="mt-1 font-serif text-3xl font-black tracking-tight md:text-4xl">
              {translate("public.tags.pageTitle")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-ink-soft">{translate("public.tags.pageSubtitle")}</p>
          </header>

          {groups.length === 0 ? (
            <p className="mt-8 border border-dashed border-rule-strong p-6 text-sm text-ink-soft">
              {translate("public.tags.empty")}
            </p>
          ) : (
            <div className="mt-6 space-y-8">
              {groups.map((group, i) => (
                <Reveal key={group.letter} delay={Math.min(i, 5) * 60}>
                  <section aria-label={group.letter}>
                    <div className="flex items-baseline gap-3 border-b border-rule pb-2">
                      <h2 className="font-serif text-xl font-black tracking-tight">{group.letter}</h2>
                      <span className="text-xs uppercase tracking-widest text-ink-faint">
                        {translate("public.tags.articlesCount", { count: group.items.length })}
                      </span>
                    </div>
                    <ul className="mt-4 flex flex-wrap gap-2.5">
                      {group.items.map((tag) => (
                        <li key={tag.id}>
                          <Link
                            href={`/tags/${tag.slug}`}
                            className="inline-flex items-baseline gap-1.5 border border-rule bg-paper-alt px-3 py-1.5 text-sm font-semibold text-ink transition-colors duration-200 hover:border-brand-red hover:text-brand-red"
                          >
                            {tag.name}
                            <span className="text-[0.65rem] font-normal text-ink-faint">{tag.articleCount}</span>
                          </Link>
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
