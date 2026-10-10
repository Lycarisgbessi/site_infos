import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { BlockRenderer, type MediaLike } from '@/components/blocks/BlockRenderer';
import { MediaPicture } from '@/components/blocks/BlockRenderer';
import { RichTextView } from '@/components/blocks/RichTextView';
import { parseBlocks } from '@/types/blocks';
import { parseJsonArrayObjects } from '@/lib/json';
import { getTranslations, localeTag } from '@/lib/i18n';
import { SiteHeader } from '@/components/public/site-header';
import { SiteFooter } from '@/components/public/site-footer';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://site-infos-six.vercel.app';
const SITE_NAME = 'INFOSPRO';

interface PageProps {
  params: Promise<{ slug: string }>;
}

function truncate(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).trimEnd() + '…';
}

/** URL d'image OG : variante webp/avif ≥1200px si dispo, sinon URL originale. */
function ogImage(cover: { url: string; variants: string } | null): string | undefined {
  if (!cover) return undefined;
  try {
    const parsed: unknown = JSON.parse(cover.variants);
    if (Array.isArray(parsed)) {
      const valid = parsed.filter(
        (v): v is { w: number; format: string; url: string } =>
          typeof v === 'object' && v !== null && 'url' in v && 'w' in v && 'format' in v
      );
      const candidates = valid
        .filter((v) => (v.format === 'webp' || v.format === 'jpeg' || v.format === 'jpg') && v.w >= 1200)
        .sort((a, b) => a.w - b.w);
      const fallback = valid.filter((v) => v.w >= 1000).sort((a, b) => a.w - b.w);
      const best = candidates[0] ?? fallback[0];
      if (best) return best.url;
    }
  } catch {
    // variants invalides : repli sur l'URL originale
  }
  return cover.url;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await db.article.findFirst({
    where: {
      OR: [{ slug: slug }, { id: slug }],
      deleted_at: null,
      status: 'published',
      published_at: { lte: new Date() },
    },
    select: {
      title: true,
      lede: true,
      slug: true,
      published_at: true,
      updated_at: true,
      coverMedia: { select: { url: true, variants: true } },
    },
  });

  if (!article) return {};

  const canonical = `${SITE_URL}/article/${article.slug}`;
  const description = article.lede ? truncate(article.lede, 160) : `Article publié sur ${SITE_NAME}.`;
  const image = ogImage(article.coverMedia);

  return {
    title: article.title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${article.title} · ${SITE_NAME}`,
      description,
      url: canonical,
      type: 'article',
      siteName: SITE_NAME,
      locale: 'fr_FR',
      ...(image ? { images: [{ url: image, width: 1200, alt: article.title }] } : {}),
      ...(article.published_at ? { publishedTime: article.published_at.toISOString() } : {}),
      modifiedTime: article.updated_at.toISOString(),
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const { translate, locale } = await getTranslations();

  const article = await db.article.findFirst({
    where: { 
      OR: [{ slug: slug }, { id: slug }],
      deleted_at: null,
      status: 'published',
      published_at: { lte: new Date() }
    },
    include: {
      category: { select: { name: true, slug: true, parent: { select: { slug: true } } } },
      coverMedia: true,
      authors: {
        orderBy: { position: 'asc' },
        select: { role: true, user: { select: { display_name: true, slug: true, job_title: true } } },
      },
      tags: { orderBy: { position: 'asc' }, select: { tag: { select: { name: true, slug: true } } } },
    },
  });

  if (!article) {
    notFound();
  }

  let blocks = parseBlocks(article.body);
  if (blocks.length > 0 && blocks[0].type === 'image' && blocks[0].mediaId === article.cover_media_id) {
    blocks = blocks.slice(1);
  }
  
  const mediaIds = new Set<string>();
  for (const b of blocks) {
    if (b.type === 'image') mediaIds.add(b.mediaId);
    if (b.type === 'gallery') b.mediaIds.forEach((m) => mediaIds.add(m));
    if (b.type === 'video' && b.mediaId) mediaIds.add(b.mediaId);
    if (b.type === 'audio') mediaIds.add(b.mediaId);
    if (b.type === 'beforeafter') {
      mediaIds.add(b.beforeMediaId);
      mediaIds.add(b.afterMediaId);
    }
  }
  
  const mediaRows = mediaIds.size > 0
    ? await db.media.findMany({
        where: { id: { in: [...mediaIds] } },
        select: { id: true, url: true, alt_text: true, credit: true, caption: true, mime_type: true, width: true, height: true, variants: true, focal_point: true },
      })
    : [];
  const mediaById = new Map<string, MediaLike>(mediaRows.map((m) => [m.id, m]));

  const readmoreIds = blocks.filter((b) => b.type === 'readmore').flatMap((b) => b.articleIds);
  const relatedRows = readmoreIds.length > 0
    ? await db.article.findMany({ where: { id: { in: readmoreIds } }, select: { id: true, title: true, slug: true, category: { select: { slug: true } } } })
    : [];
  const articleTitles = new Map<string, string>(relatedRows.map((r) => [r.id, r.title]));

  const publishedLabel = article.published_at
    ? new Intl.DateTimeFormat(localeTag(locale), { dateStyle: 'long', timeStyle: 'short' }).format(article.published_at)
    : translate('public.article.unpublished');

  const canonical = `${SITE_URL}/article/${article.slug}`;
  const description = article.lede ? truncate(article.lede, 160) : `Article publié sur ${SITE_NAME}.`;
  const image = ogImage(article.coverMedia ? { url: article.coverMedia.url, variants: article.coverMedia.variants } : null);
  const authorNames = article.authors.map((a) => a.user.display_name);

  const newsArticleLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description,
    ...(image ? { image: [image] } : {}),
    ...(article.published_at ? { datePublished: article.published_at.toISOString() } : {}),
    dateModified: article.updated_at.toISOString(),
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    author: { '@type': 'Organization', name: authorNames.length > 0 ? authorNames.join(', ') : `Rédaction ${SITE_NAME}` },
    publisher: { '@type': 'Organization', name: SITE_NAME, ...(image ? { logo: { '@type': 'ImageObject', url: `${SITE_URL}/favicon.ico` } } : {}) },
    inLanguage: 'fr-FR',
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_URL },
      ...(article.category
        ? [{ '@type': 'ListItem', position: 2, name: article.category.name, item: `${SITE_URL}/#${article.category.slug}` }]
        : []),
      { '@type': 'ListItem', position: article.category ? 3 : 2, name: article.title, item: canonical },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(newsArticleLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <SiteHeader />
      <main className="min-h-screen bg-paper pb-20">
        <article className="mx-auto max-w-3xl px-6 py-10">
          <nav className="kicker" aria-label={translate('public.article.breadcrumb')}>
            {article.category?.parent?.slug ? `${article.category.parent.slug} › ` : ''}
            {article.category?.name}
          </nav>

          {article.kicker && <p className="kicker mt-4 text-brand-red">{article.kicker}</p>}
          <h1 className="mt-2 font-serif text-4xl font-bold leading-tight tracking-tight">{article.title}</h1>
          {article.lede && <p className="mt-4 font-serif text-xl leading-relaxed text-ink-soft">{article.lede}</p>}

          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-rule py-3 text-xs text-ink-faint">
            <span className="font-semibold text-ink-soft">
              {article.authors.map((a) => a.user.display_name).join(', ') || translate('public.article.staffByline')}
            </span>
            <span>{publishedLabel}</span>
            <span>{article.reading_time_min} {translate('public.card.readTime')}</span>
            {article.dateline && <span>{article.dateline}</span>}
            {article.source_agency && <span>{translate('public.article.source')} : {article.source_agency}</span>}
          </div>

          {article.coverMedia && (
            <figure className="mt-8">
              <MediaPicture
                media={{
                  id: article.coverMedia.id,
                  url: article.coverMedia.url,
                  alt_text: article.coverMedia.alt_text,
                  credit: article.coverMedia.credit,
                  caption: article.coverMedia.caption,
                  mime_type: article.coverMedia.mime_type,
                  width: article.coverMedia.width,
                  height: article.coverMedia.height,
                  variants: article.coverMedia.variants,
                  focal_point: article.coverMedia.focal_point,
                }}
                sizes="(max-width: 768px) 100vw, 768px"
              />
              {(article.coverMedia.caption || article.coverMedia.credit) && (
                <figcaption className="mt-2 text-xs text-ink-faint">
                  {article.coverMedia.caption}
                  {article.coverMedia.credit ? ` © ${article.coverMedia.credit}` : ''}
                </figcaption>
              )}
            </figure>
          )}

          <div className="mt-8">
            <BlockRenderer blocks={blocks} mediaById={mediaById} articleTitles={articleTitles} adsEnabled={true} />
          </div>

          {article.tags.length > 0 && (
            <div className="mt-10 flex flex-wrap gap-2 border-t border-rule pt-6">
              {article.tags.map((t) => (
                <span key={t.tag.slug} className="rounded-sm bg-paper-alt px-3 py-1 text-xs font-semibold text-ink-soft">
                  {t.tag.name}
                </span>
              ))}
            </div>
          )}

          {(() => {
            const isSource = (v: unknown): v is { label: string; url: string } =>
              typeof v === 'object' && v !== null && 'label' in v && 'url' in v;
            const sources = parseJsonArrayObjects(article.sources, isSource);
            if (sources.length === 0) return null;
            return (
              <section className="mt-8 border border-rule bg-paper-alt p-5">
                <p className="kicker">{translate('public.article.sources')}</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {sources.map((s, i) => (
                    <li key={i}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-brand-red underline">
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })()}

          {article.correction_note && (
            <p className="mt-6 rounded-sm border border-rule bg-paper-alt p-3 text-xs text-ink-soft">
              <strong>{translate('public.article.correctionNote')}</strong> <RichTextView value={[{ text: article.correction_note }]} />
            </p>
          )}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}

