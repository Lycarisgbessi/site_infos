import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "@/lib/i18n";
import { TopBar, SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { Cover, timeAgo } from "@/components/public/article-cards";
import { Reveal } from "@/components/public/reveal";
import {
  getArticlesByCategory,
  getCategoryBySlug,
  getVisibleChildCategories,
  parsePageParam,
} from "@/lib/public/taxonomy-data";
import { decodeSlug } from "@/lib/slug-decode";

/**
 * Route `/rubrique/{slug}` — liste paginée des articles publiés d'une
 * rubrique visible ET de ses sous-rubriques visibles (catégorie principale
 * ou secondaire). L'intro éditoriale SEO (intro_html) est affichée si
 * présente, les sous-rubriques visibles sont proposées en liens de
 * navigation. 404 si rubrique invisible, supprimée ou inexistante.
 * Pagination simple : `?page=N` avec liens précédent/suivant.
 */

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://site-infos-six.vercel.app";
const PAGE_SIZE = 12;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}

function clip(text: string, max = 160): string {
  const clean = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).trimEnd() + "…";
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeSlug(rawSlug);
  const category = await getCategoryBySlug(slug);
  if (!category) return {};
  const description =
    clip(category.description ?? category.introHtml ?? "") || `${category.name} — INFOSPRO.net`;
  return {
    title: category.name,
    description,
    alternates: { canonical: `${SITE_URL}/rubrique/${category.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug: rawSlug } = await params;
  const slug = decodeSlug(rawSlug);
  const { translate } = await getTranslations();

  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const [requestedPage, children] = await Promise.all([
    parsePageParam((await searchParams).page),
    getVisibleChildCategories(slug),
  ]);
  const { articles, total, page, totalPages, hasPreviousPage, hasNextPage } =
    await getArticlesByCategory(slug, requestedPage, PAGE_SIZE);
  const now = new Date();

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <TopBar />
      <SiteHeader />

      <main id="contenu" className="flex-1 pb-16">
        <div className="container-page pt-10">
          <header className="border-b-2 border-ink pb-3">
            <p className="kicker text-brand-red">{translate("public.category.kicker")}</p>
            <h1 className="mt-1 font-serif text-3xl font-black tracking-tight md:text-4xl">
              {category.name}
            </h1>
            {category.description && (
              <p className="mt-2 max-w-2xl text-sm text-ink-soft">{category.description}</p>
            )}
            {total > 0 && (
              <p className="mt-2 text-xs uppercase tracking-widest text-ink-faint">
                {translate("public.category.articlesCount", { count: total })}
              </p>
            )}
          </header>

          {children.length > 0 && (
            <nav aria-label={translate("public.rubriques.children")} className="mt-4">
              <p className="text-[0.65rem] uppercase tracking-widest text-ink-faint">
                {translate("public.rubriques.children")}
              </p>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                {children.map((child) => (
                  <li key={child.id}>
                    <Link
                      href={`/rubrique/${child.slug}`}
                      className="text-sm font-semibold text-ink-soft underline-offset-4 transition-colors duration-200 hover:text-brand-red hover:underline"
                    >
                      {child.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {category.introHtml && (
            <div
              className="mt-6 max-w-3xl text-[0.95rem] leading-relaxed text-ink-soft [&_a]:font-semibold [&_a]:text-brand-red [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: category.introHtml }}
            />
          )}

          {articles.length === 0 ? (
            <p className="mt-8 border border-dashed border-rule-strong p-6 text-sm text-ink-soft">
              {translate("public.category.empty")}
            </p>
          ) : (
            <div className="mt-6 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((a, i) => (
                <Reveal key={a.id} delay={Math.min(i, 5) * 60}>
                  <Link href={`/article/${a.slug}`} className="group block">
                    <div className="overflow-hidden">
                      <Cover
                        article={a}
                        className="aspect-[16/10] w-full transition-transform duration-500 group-hover:scale-[1.02]"
                      />
                    </div>
                    <h2 className="mt-3 line-clamp-2 font-serif text-base font-bold leading-snug transition-colors duration-200 group-hover:text-brand-red">
                      {a.shortTitle ?? a.title}
                    </h2>
                    {a.lede && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-soft">{a.lede}</p>}
                    <p className="mt-2 text-xs text-ink-faint">
                      {timeAgo(a.publishedAt, now, {
                        today: translate("public.time.today"),
                        yesterday: translate("public.time.yesterday"),
                      })}
                      {" · "}
                      {a.readingTimeMin} {translate("public.card.readTime")}
                    </p>
                  </Link>
                </Reveal>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <nav
              aria-label={translate("public.pagination.label")}
              className="mt-10 flex items-center justify-between border-t border-rule pt-4"
            >
              {hasPreviousPage ? (
                <Link
                  href={`/rubrique/${category.slug}?page=${page - 1}`}
                  className="text-xs font-semibold uppercase tracking-widest text-ink-soft transition-colors duration-200 hover:text-brand-red"
                >
                  ← {translate("public.pagination.previous")}
                </Link>
              ) : (
                <span aria-hidden />
              )}
              <p className="text-xs uppercase tracking-widest text-ink-faint">
                {translate("public.pagination.page", { page, total: totalPages })}
              </p>
              {hasNextPage ? (
                <Link
                  href={`/rubrique/${category.slug}?page=${page + 1}`}
                  className="text-xs font-semibold uppercase tracking-widest text-ink-soft transition-colors duration-200 hover:text-brand-red"
                >
                  {translate("public.pagination.next")} →
                </Link>
              ) : (
                <span aria-hidden />
              )}
            </nav>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
