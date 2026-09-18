import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { BlockRenderer, type MediaLike } from '@/components/blocks/BlockRenderer';
import { MediaPicture } from '@/components/blocks/BlockRenderer';
import { RichTextView } from '@/components/blocks/RichTextView';
import { parseBlocks } from '@/types/blocks';
import { parseJsonArrayObjects } from '@/lib/json';
import { SiteHeader } from '@/components/public/site-header';
import { SiteFooter } from '@/components/public/site-footer';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  
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
    ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(article.published_at)
    : 'Non publié';

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-paper pb-20">
        <article className="mx-auto max-w-3xl px-6 py-10">
          <nav className="kicker" aria-label="Fil d'ariane">
            {article.category?.parent?.slug ? `${article.category.parent.slug} › ` : ''}
            {article.category?.name}
          </nav>

          {article.kicker && <p className="kicker mt-4 text-brand-red">{article.kicker}</p>}
          <h1 className="mt-2 font-serif text-4xl font-bold leading-tight tracking-tight">{article.title}</h1>
          {article.lede && <p className="mt-4 font-serif text-xl leading-relaxed text-ink-soft">{article.lede}</p>}

          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-rule py-3 text-xs text-ink-faint">
            <span className="font-semibold text-ink-soft">
              {article.authors.map((a) => a.user.display_name).join(', ') || 'Rédaction INFOSPRO'}
            </span>
            <span>{publishedLabel}</span>
            <span>{article.reading_time_min} min de lecture</span>
            {article.dateline && <span>{article.dateline}</span>}
            {article.source_agency && <span>Source : {article.source_agency}</span>}
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
              ${(article.coverMedia.caption || article.coverMedia.credit) && (
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
                <p className="kicker">Sources</p>
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
              <strong>Note de correction :</strong> <RichTextView value={[{ text: article.correction_note }]} />
            </p>
          )}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}

