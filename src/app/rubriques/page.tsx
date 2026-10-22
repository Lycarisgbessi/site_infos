import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "@/lib/i18n";
import { TopBar, SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { Reveal } from "@/components/public/reveal";
import { getCategoryTree, type PublicCategoryNode } from "@/lib/public/taxonomy-data";

/**
 * Route `/rubriques` — index de TOUTES les classifications par rubrique :
 * chaque catégorie visible (et ses sous-rubriques visibles) devient
 * navigable ici. Grille élégante parent → enfants dans le style des pages
 * vidéos/rubrique (kicker, titre border-b-2, cartes) ; chaque niveau est
 * cliquable vers `/rubrique/{slug}`.
 */

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://site-infos-six.vercel.app";

export async function generateMetadata(): Promise<Metadata> {
  const { translate } = await getTranslations();
  return {
    title: translate("public.rubriques.pageTitle"),
    description: translate("public.rubriques.pageSubtitle"),
    alternates: { canonical: `${SITE_URL}/rubriques` },
  };
}

/** Carte d'une rubrique parente : titre cliquable, compte d'articles
 * (direct + sous-rubriques), description et sous-rubriques en
 * sous-liste cliquable. Pas de <a> imbriqué : seuls le titre parent et
 * les enfants sont des liens. */
function CategoryCard({
  category,
  childrenLabel,
  articlesCountLabel,
}: {
  category: PublicCategoryNode;
  childrenLabel: string;
  articlesCountLabel: (count: number) => string;
}) {
  return (
    <article className="flex h-full flex-col border border-rule bg-paper-alt p-5 transition-colors duration-200 hover:border-rule-strong">
      <div className="flex items-baseline justify-between gap-3">
        <Link
          href={`/rubrique/${category.slug}`}
          className="font-serif text-lg font-bold leading-snug transition-colors duration-200 hover:text-brand-red"
        >
          {category.shortName ?? category.name}
        </Link>
        <span className="kicker shrink-0 text-ink-faint">{articlesCountLabel(category.articleCount)}</span>
      </div>
      {category.description && (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-soft">{category.description}</p>
      )}
      {category.children.length > 0 && (
        <div className="mt-auto pt-4">
          <p className="text-[0.65rem] uppercase tracking-widest text-ink-faint">{childrenLabel}</p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
            {category.children.map((child) => (
              <li key={child.id}>
                <Link
                  href={`/rubrique/${child.slug}`}
                  className="text-sm font-semibold text-ink-soft underline-offset-4 transition-colors duration-200 hover:text-brand-red hover:underline"
                >
                  {child.shortName ?? child.name}
                  <span className="ml-1 text-[0.65rem] font-normal text-ink-faint">({child.articleCount})</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

export default async function RubriquesIndexPage() {
  const { translate } = await getTranslations();
  const categories = await getCategoryTree();

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <TopBar />
      <SiteHeader />

      <main id="contenu" className="flex-1 pb-16">
        <div className="container-page pt-10">
          <header className="border-b-2 border-ink pb-3">
            <p className="kicker text-brand-red">{translate("public.rubriques.pageTitle")}</p>
            <h1 className="mt-1 font-serif text-3xl font-black tracking-tight md:text-4xl">
              {translate("public.rubriques.pageTitle")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-ink-soft">{translate("public.rubriques.pageSubtitle")}</p>
          </header>

          {categories.length === 0 ? (
            <p className="mt-8 border border-dashed border-rule-strong p-6 text-sm text-ink-soft">
              {translate("public.rubriques.empty")}
            </p>
          ) : (
            <div className="mt-6 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((c, i) => (
                <Reveal key={c.id} delay={Math.min(i, 5) * 60} className="h-full">
                  <CategoryCard
                    category={c}
                    childrenLabel={translate("public.rubriques.children")}
                    articlesCountLabel={(count) =>
                      translate("public.rubriques.articlesCount", { count })
                    }
                  />
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
