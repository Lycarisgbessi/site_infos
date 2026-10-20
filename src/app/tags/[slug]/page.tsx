import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "@/lib/i18n";
import { TopBar, SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { Cover, timeAgo } from "@/components/public/article-cards";
import { Reveal } from "@/components/public/reveal";
import { getArticlesByTag, getTagBySlug, parsePageParam } from "@/lib/public/taxonomy-data";
import { decodeSlug } from "@/lib/slug-decode";

/**
 * Route `/tags/{slug}` — liste paginée des articles publiés portant un
 * tag (relation article_tags). 404 si le tag n'existe pas (ou est supprimé).
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
  const tag = await getTagBySlug(slug);
  if (!tag) return {};
  const description = clip(tag.description ?? tag.introHtml ?? "") || `${tag.name} — INFOSPRO.net`;
  return {
    title: tag.name,
    description,
    alternates: { canonical: `${SITE_URL}/tags/${tag.slug}` },
  };
}

export default async function TagPage({ params, searchParams }: PageProps) {
  const { slug: rawSlug } = await params;
  const slug = decodeSlug(rawSlug);
  const { translate } = await getTranslations();

  const tag = await getTagBySlug(slug);
  if (!tag) notFound();

  const requestedPage = parsePageParam((await searchParams).page);
  const { articles, total, page, totalPages, hasPreviousPage, hasNextPage } =
    await getArticlesByTag(slug, requestedPage, PAGE_SIZE);
  const now = new Date();

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <TopBar />
      <SiteHeader />

      <main id="contenu" className="flex-1 pb-16">
        <div className="container-page pt-10">
          <header className="border-b-2 border-ink pb-3">
            <p className="kicker text-brand-red">{translate("public.tag.kicker")}</p>
            <h1 className="mt-1 font-serif text-3xl font-black tracking-tight md:text-4xl">
              {tag.name}
            </h1>
            {tag.description && <p className="mt-2 max-w-2xl text-sm text-ink-soft">{tag.description}</p>}
            {total > 0 && (
              <p className="mt-2 text-xs uppercase tracking-widest text-ink-faint">
                {translate("public.tag.articlesCount", { count: total })}
              </p>
            )}
          </header>

          {tag.introHtml && (
            <div
              className="mt-6 max-w-3xl text-[0.95rem] leading-relaxed text-ink-soft [&_a]:font-semibold [&_a]:text-brand-red [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: tag.introHtml }}
            />
          )}

          {articles.length === 0 ? (
            <p className="mt-8 border border-dashed border-rule-strong p-6 text-sm text-ink-soft">
              {translate("public.tag.empty")}
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
                    <p className="kicker mt-3 text-[0.65rem] text-brand-red">{a.category?.name}</p>
                    <h2 className="mt-1 line-clamp-2 font-serif text-base font-bold leading-snug transition-colors duration-200 group-hover:text-brand-red">
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
                  href={`/tags/${tag.slug}?page=${page - 1}`}
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
                  href={`/tags/${tag.slug}?page=${page + 1}`}
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
