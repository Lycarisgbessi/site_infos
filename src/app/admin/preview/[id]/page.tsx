import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { verifyPreviewToken } from "@/lib/auth/preview";
import { parseBlocks } from "@/types/blocks";
import { parseJsonArrayObjects } from "@/lib/json";
import { BlockRenderer, MediaPicture, type MediaLike } from "@/components/blocks/BlockRenderer";
import { PreviewFrame } from "@/components/admin/PreviewFrame";
import { RichTextView } from "@/components/blocks/RichTextView";

export const dynamic = "force-dynamic";

/**
 * Prévisualisation fidèle d'un article sur l'état brouillon (§11.1).
 * Accès : session back-office valide OU jeton signé ?token= (24 h).
 * Rendu 3 tailles via PreviewFrame ; réutilise le BlockRenderer de la
 * Phase 4 (front-office) pour une fidélité exacte.
 */

interface PreviewProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function AdminPreviewPage({ params, searchParams }: PreviewProps) {
  const { id } = await params;
  const { token } = await searchParams;

  let authorized = false;
  const session = await getSession();
  if (session) {
    authorized = true;
  } else if (token && verifyPreviewToken(token, id)) {
    authorized = true;
  }

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper p-6">
        <div className="max-w-md border border-rule bg-paper-alt p-8 text-center">
          <p className="font-serif text-xl font-bold">Aperçu protégé</p>
          <p className="mt-2 text-sm text-ink-soft">
            Connectez-vous au back-office ou ouvrez ce lien avec un jeton de prévisualisation valide.
          </p>
          <a href="/login?next=/admin/preview" className="mt-4 inline-block bg-brand-red px-4 py-2 text-sm font-semibold text-white">
            Se connecter
          </a>
        </div>
      </div>
    );
  }

  const article = await db.article.findFirst({
    where: { id, deleted_at: null },
    include: {
      category: { select: { name: true, slug: true, parent: { select: { slug: true } } } },
      coverMedia: true,
      authors: {
        orderBy: { position: "asc" },
        select: { role: true, user: { select: { display_name: true, slug: true, job_title: true } } },
      },
      tags: { orderBy: { position: "asc" }, select: { tag: { select: { name: true, slug: true } } } },
    },
  });

  if (!article) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <p className="text-sm text-ink-soft">Article introuvable.</p>
      </div>
    );
  }

  const blocks = parseBlocks(article.body);

  // Résolution des médias référencés par les blocs (image, gallery, video, audio, beforeafter)
  const mediaIds = new Set<string>();
  for (const b of blocks) {
    if (b.type === "image") mediaIds.add(b.mediaId);
    if (b.type === "gallery") b.mediaIds.forEach((m) => mediaIds.add(m));
    if (b.type === "video" && b.mediaId) mediaIds.add(b.mediaId);
    if (b.type === "audio") mediaIds.add(b.mediaId);
    if (b.type === "beforeafter") {
      mediaIds.add(b.beforeMediaId);
      mediaIds.add(b.afterMediaId);
    }
  }
  const mediaRows =
    mediaIds.size > 0
      ? await db.media.findMany({
          where: { id: { in: [...mediaIds] } },
          select: { id: true, url: true, alt_text: true, credit: true, caption: true, mime_type: true, width: true, height: true, variants: true, focal_point: true },
        })
      : [];
  const mediaById = new Map<string, MediaLike>(mediaRows.map((m) => [m.id, m]));

  // Titres des articles référencés par les blocs « à lire aussi »
  const readmoreIds = blocks.filter((b) => b.type === "readmore").flatMap((b) => b.articleIds);
  const relatedRows =
    readmoreIds.length > 0
      ? await db.article.findMany({ where: { id: { in: readmoreIds } }, select: { id: true, title: true, slug: true, category: { select: { slug: true } } } })
      : [];
  const articleTitles = new Map<string, string>(relatedRows.map((r) => [r.id, r.title]));

  const publishedLabel = article.published_at
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(article.published_at)
    : "Non publié";

  return (
    <PreviewFrame>
      <article className="mx-auto max-w-3xl px-6 py-10">
        <nav className="kicker" aria-label="Fil d'ariane">
          {article.category.parent?.slug ? `${article.category.parent.slug} · ` : ""}
          {article.category.name}
        </nav>

        {article.kicker && <p className="kicker mt-4 text-brand-red">{article.kicker}</p>}
        <h1 className="mt-2 font-serif text-4xl font-bold leading-tight tracking-tight">{article.title}</h1>
        {article.lede && <p className="mt-4 font-serif text-xl leading-relaxed text-ink-soft">{article.lede}</p>}

        <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-rule py-3 text-xs text-ink-faint">
          <span className="font-semibold text-ink-soft">
            {article.authors.map((a) => a.user.display_name).join(", ") || "Rédaction INFOSPRO"}
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
            {(article.coverMedia.caption || article.coverMedia.credit) && (
              <figcaption className="mt-2 text-xs text-ink-faint">
                {article.coverMedia.caption}
                {article.coverMedia.credit ? ` · ${article.coverMedia.credit}` : ""}
              </figcaption>
            )}
          </figure>
        )}

        <div className="mt-8">
          <BlockRenderer blocks={blocks} mediaById={mediaById} articleTitles={articleTitles} adsEnabled={false} />
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
            typeof v === "object" && v !== null && "label" in v && "url" in v;
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
    </PreviewFrame>
  );
}
