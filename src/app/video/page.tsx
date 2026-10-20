import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "@/lib/i18n";
import { getAdCampaigns, getSiteBanners, getVideoArticles } from "@/lib/public/homepage-data";
import { getSettingsValues } from "@/server/services/settings";
import { TopBar, SiteHeader } from "@/components/public/site-header";
import { SiteBannerBar } from "@/components/public/site-banner-bar";
import { AdBanner } from "@/components/public/ad-slot";
import { SiteFooter } from "@/components/public/site-footer";
import { Cover } from "@/components/public/article-cards";

/**
 * Route `/video` — liste de tous les contenus vidéo (format vidéo ou bloc
 * vidéo dans le corps de l'article). Chaque carte mène à la page dédiée
 * à la lecture `/video/{slug}` (grand lecteur, pas de pop-up).
 *
 * Module désactivable : `features.tv` à false → 404 (notFound).
 * Section « En direct » en tête si `features.live` est actif ET qu'une
 * URL `direct.live_url` est configurée (embed YouTube ou iframe sandbox).
 */

export const dynamic = "force-dynamic";

/** Extrait l'ID d'une URL YouTube (watch, shorts, live, embed, youtu.be). */
function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./i, "");
    if (host === "youtu.be") return u.pathname.slice(1) || null;
    if (host !== "youtube.com") return null;
    if (u.pathname === "/watch") return u.searchParams.get("v");
    const m = u.pathname.match(/^\/(embed|shorts|live)\/([A-Za-z0-9_-]+)/);
    return m?.[2] ?? null;
  } catch {
    return null;
  }
}

export default async function VideoListPage() {
  const { translate } = await getTranslations();

  const settings = await getSettingsValues([
    "features.tv",
    "features.live",
    "direct.live_url",
    "direct.live_title",
  ]);
  if (settings["features.tv"] === "false") notFound();

  const liveUrl = settings["direct.live_url"] ?? "";
  const liveTitleSetting = settings["direct.live_title"] ?? "";
  const showLive = settings["features.live"] !== "false" && liveUrl !== "";
  const ytId = showLive ? youtubeId(liveUrl) : null;
  const liveTitle = liveTitleSetting !== "" ? liveTitleSetting : translate("public.video.liveTitle");

  const videos = await getVideoArticles(24);

  // Bandeaux du site ciblant /video + campagnes publicitaires actives.
  const [banners, adCampaigns] = await Promise.all([getSiteBanners("/video"), getAdCampaigns()]);

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SiteBannerBar banners={banners} closeLabel={translate("public.banner.close")} />
      <TopBar />
      <SiteHeader />

      <main id="contenu" className="flex-1 pb-16">
        <div className="container-page pt-10">
          {showLive && (
            <section aria-label={translate("public.video.liveTitle")} className="mb-10">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-red px-2.5 py-1 text-[0.7rem] font-black uppercase tracking-widest text-white">
                  <span aria-hidden className="size-2 animate-pulse rounded-full bg-white" />
                  {translate("public.une.live")}
                </span>
                <h2 className="font-serif text-lg font-bold tracking-tight md:text-xl">{liveTitle}</h2>
              </div>
              <div className="mt-3 aspect-video w-full overflow-hidden bg-ink">
                {ytId ? (
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${ytId}`}
                    title={liveTitle}
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    className="h-full w-full border-0"
                  />
                ) : (
                  <iframe
                    src={liveUrl}
                    title={liveTitle}
                    allowFullScreen
                    sandbox="allow-scripts allow-popups allow-presentation"
                    className="h-full w-full border-0"
                  />
                )}
              </div>
            </section>
          )}

          <header className="border-b-2 border-ink pb-3">
            <h1 className="font-serif text-3xl font-black tracking-tight md:text-4xl">
              ▶ {translate("public.video.pageTitle")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-ink-soft">{translate("public.video.pageSubtitle")}</p>
          </header>

          {/* ── AD-10 : leaderboard d'en-tête (rien sans campagne active) ── */}
          <div className="mt-6">
            <AdBanner code="AD-10" campaigns={adCampaigns} />
          </div>

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

          {/* ── AD-06 : pavé MPU de pied de page (300×250, centré) ────────── */}
          <div className="mx-auto mt-10 max-w-[300px]">
            <AdBanner code="AD-06" campaigns={adCampaigns} />
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
