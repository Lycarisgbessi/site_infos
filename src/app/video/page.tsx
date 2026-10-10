import Link from "next/link";
import { getTranslations } from "@/lib/i18n";
import { getVideoArticles } from "@/lib/public/homepage-data";
import { TopBar, SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { Cover } from "@/components/public/article-cards";

/**
 * Route `/video` — liste de tous les contenus vidéo (format vidéo ou bloc
 * vidéo dans le corps de l'article). Chaque carte mène à la page dédiée
 * à la lecture `/video/{slug}` (grand lecteur, pas de pop-up).
 */

export const dynamic = "force-dynamic";

export default async function VideoListPage() {
  const { translate } = await getTranslations();
  const videos = await getVideoArticles(24);

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <TopBar />
      <SiteHeader />

      <main id="contenu" className="flex-1 pb-16">
        <div className="container-page pt-10">
          <header className="border-b-2 border-ink pb-3">
            <h1 className="font-serif text-3xl font-black tracking-tight md:text-4xl">
              ▶ {translate("public.video.pageTitle")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-ink-soft">{translate("public.video.pageSubtitle")}</p>
          </header>

          {videos.length === 0 ? (
            <p className="mt-8 border border-dashed border-rule-strong p-6 text-sm text-ink-soft">
              {translate("public.video.none")}
            </p>
          ) : (
            <div className="mt-6 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((a) => (
                <Link key={a.id} href={`/video/${a.slug}`} className="group block">
                  <div className="relative overflow-hidden">
                    <Cover article={a} className="aspect-video w-full transition-transform duration-500 group-hover:scale-[1.02]" />
                    <span
                      aria-hidden
                      className="absolute inset-0 m-auto flex size-12 items-center justify-center rounded-full bg-brand-red/95 text-lg text-white transition-transform duration-300 group-hover:scale-110"
                    >
                      ▶
                    </span>
                  </div>
                  <p className="kicker mt-3 text-[0.65rem] text-brand-red">{a.category?.name}</p>
                  <h2 className="mt-1 line-clamp-2 font-serif text-base font-bold leading-snug transition-colors duration-200 group-hover:text-brand-red">
                    {a.shortTitle ?? a.title}
                  </h2>
                  {a.lede && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-soft">{a.lede}</p>}
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
