import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "@/lib/i18n";
import { db } from "@/lib/db";
import { parseBlocks } from "@/types/blocks";
import { getVideoArticles } from "@/lib/public/homepage-data";
import { TopBar, SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { Cover } from "@/components/public/article-cards";
import { ShareButton } from "../share-button";

/**
 * Route `/video/{slug}` — page dédiée à la lecture : grand lecteur 16:9
 * (YouTube no-cookie ou fichier vidéo natif), titre, chapô, partage et
 * articles vidéo liés. Aucun pop-up.
 */

export const dynamic = "force-dynamic";

export default async function VideoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { translate } = await getTranslations();
  const now = new Date();

  const article = await db.article.findFirst({
    where: { OR: [{ slug }, { id: slug }], deleted_at: null, status: "published", published_at: { lte: now } },
    select: {
      id: true,
      slug: true,
      title: true,
      lede: true,
      kicker: true,
      published_at: true,
      reading_time_min: true,
      body: true,
      category: { select: { name: true, slug: true } },
      authors: { orderBy: { position: "asc" }, select: { role: true, user: { select: { display_name: true } } } },
    },
  });
  if (!article) notFound();

  const blocks = parseBlocks(article.body);
  const videoBlocks = blocks.filter((b): b is Extract<typeof b, { type: "video" }> => b.type === "video");
  const mainVideo = videoBlocks[0];

  // Média vidéo natif éventuel
  const mediaId = mainVideo?.mediaId;
  const media = mediaId
    ? await db.media.findUnique({
        where: { id: mediaId },
        select: { url: true, mime_type: true, alt_text: true },
      })
    : null;

  const related = (await getVideoArticles(7)).filter((a) => a.id !== article.id).slice(0, 6);

  const publishedLabel = article.published_at
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Conakry" }).format(article.published_at)
    : "";

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <TopBar />
      <SiteHeader />

      <main id="contenu" className="flex-1 pb-16">
        {/* Lecteur — grand format 16:9 sur fond sombre */}
        <div className="bg-ink pt-8">
          <div className="container-page">
            <div className="aspect-video w-full overflow-hidden bg-ink">
              {mainVideo?.provider === "youtube" && mainVideo.playbackId ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${mainVideo.playbackId}`}
                  title={article.title}
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  className="h-full w-full border-0"
                />
              ) : media ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video controls autoPlay={mainVideo?.autoplayMuted ?? false} muted={mainVideo?.autoplayMuted ?? false} playsInline className="h-full w-full">
                  <source src={media.url} type={media.mime_type ?? undefined} />
                </video>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-paper/60">
                  {translate("public.video.none")}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="container-page max-w-4xl pt-6">
          <Link
            href="/video"
            className="text-xs font-semibold uppercase tracking-widest text-ink-faint transition-colors duration-200 hover:text-brand-red"
          >
            {translate("public.video.back")}
          </Link>

          <nav className="kicker mt-4" aria-label="Fil d'ariane">
            {translate("public.video.pageTitle")}
            {article.category ? ` › ${article.category.name}` : ""}
          </nav>

          {article.kicker && <p className="kicker mt-3 text-brand-red">{article.kicker}</p>}
          <h1 className="mt-2 font-serif text-3xl font-black leading-tight tracking-tight md:text-4xl">{article.title}</h1>
          {article.lede && <p className="mt-3 font-serif text-lg leading-relaxed text-ink-soft">{article.lede}</p>}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-y border-rule py-3 text-xs text-ink-faint">
            <span>
              <span className="font-semibold text-ink-soft">
                {article.authors.map((a) => a.user.display_name).join(", ")}
              </span>
              {publishedLabel ? ` · ${publishedLabel}` : ""}
              {article.reading_time_min ? ` · ${article.reading_time_min} ${translate("public.card.readTime")}` : ""}
            </span>
            <ShareButton
              label={translate("public.video.share")}
              okLabel={translate("public.video.shareOk")}
              errorLabel={translate("public.video.shareError")}
            />
          </div>

          {/* Vidéos liées */}
          {related.length > 0 && (
            <section aria-label={translate("public.video.related")} className="mt-10">
              <header className="border-b-2 border-ink pb-2">
                <h2 className="font-serif text-xl font-black tracking-tight md:text-2xl">
                  {translate("public.video.related")}
                </h2>
              </header>
              <div className="mt-5 grid gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((a) => (
                  <Link key={a.id} href={`/video/${a.slug}`} className="group block">
                    <div className="relative overflow-hidden">
                      <Cover article={a} className="aspect-video w-full transition-transform duration-500 group-hover:scale-[1.03]" />
                      <span
                        aria-hidden
                        className="absolute inset-0 m-auto flex size-10 items-center justify-center rounded-full bg-brand-red/95 text-sm text-white transition-transform duration-300 group-hover:scale-110"
                      >
                        ▶
                      </span>
                    </div>
                    <p className="kicker mt-2 text-[0.65rem] text-brand-red">{a.category?.name}</p>
                    <h3 className="mt-1 line-clamp-2 font-serif text-sm font-bold leading-snug transition-colors duration-200 group-hover:text-brand-red">
                      {a.shortTitle ?? a.title}
                    </h3>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
