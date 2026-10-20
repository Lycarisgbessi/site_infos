import { notFound } from "next/navigation";
import { getTranslations } from "@/lib/i18n";
import { getAdCampaigns, getSiteBanners } from "@/lib/public/homepage-data";
import { getSettingsValues } from "@/server/services/settings";
import { listPublicSeasons } from "@/server/services/podcast";
import { TopBar, SiteHeader } from "@/components/public/site-header";
import { SiteBannerBar } from "@/components/public/site-banner-bar";
import { AdBanner } from "@/components/public/ad-slot";
import { SiteFooter } from "@/components/public/site-footer";
import { PodcastList, type PublicSeason } from "@/components/public/podcast/PodcastList";

/**
 * Route `/podcast` — FM / Podcasts : saisons en accordéons (première
 * ouverte), épisodes numérotés joués dans la barre audio flottante
 * persistante (lecture continue à travers la navigation).
 *
 * Module désactivable : `features.fm` à false → 404 (notFound).
 */

export const dynamic = "force-dynamic";

export default async function PodcastPage() {
  const { translate, locale } = await getTranslations();

  const settings = await getSettingsValues(["features.fm"]);
  if (settings["features.fm"] === "false") notFound();

  const seasons = await listPublicSeasons();

  // Bandeaux du site ciblant /podcast + campagnes publicitaires actives.
  const [banners, adCampaigns] = await Promise.all([getSiteBanners("/podcast"), getAdCampaigns()]);

  const publicSeasons: PublicSeason[] = seasons
    .map((season) => ({
      id: season.id,
      title: season.title,
      description: season.description,
      episodes: season.episodes.map((ep) => ({
        id: ep.id,
        title: ep.title,
        description: ep.description,
        audioUrl: ep.audio_url,
        durationSec: ep.duration_sec,
        coverUrl: ep.cover_url,
        publishedAt: ep.published_at,
      })),
    }))
    .filter((season) => season.episodes.length > 0);

  const episodeCount = publicSeasons.reduce((sum, s) => sum + s.episodes.length, 0);

  const labels = {
    episode: translate("public.podcast.episode"),
    play: translate("public.audio.play"),
    playing: translate("public.podcast.nowPlaying"),
    noDuration: translate("public.podcast.noDuration"),
    episodesCount: (n: number) => translate("public.podcast.episodesCount", { count: n }),
  };

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SiteBannerBar banners={banners} closeLabel={translate("public.banner.close")} />
      <TopBar />
      <SiteHeader />

      <main id="contenu" className="flex-1 pb-16">
        <div className="container-page pt-10">
          <header className="border-b-2 border-ink pb-4">
            <p className="kicker text-brand-red">FM</p>
            <h1 className="mt-1 font-serif text-3xl font-black tracking-tight md:text-4xl">
              🎙 {translate("public.podcast.pageTitle")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-ink-soft">{translate("public.podcast.pageSubtitle")}</p>
            {episodeCount > 0 && (
              <p className="mt-2 text-xs uppercase tracking-widest text-ink-faint">
                {translate("public.podcast.stats", { seasons: publicSeasons.length, episodes: episodeCount })}
              </p>
            )}
          </header>

          {/* ── AD-10 : leaderboard d'en-tête (rien sans campagne active) ── */}
          <div className="mt-6">
            <AdBanner code="AD-10" campaigns={adCampaigns} />
          </div>

          {publicSeasons.length === 0 ? (
            <div className="mt-8 border border-dashed border-rule-strong p-10 text-center">
              <span aria-hidden className="text-3xl">🎙</span>
              <p className="mt-3 font-serif text-lg font-bold text-ink">{translate("public.podcast.noneTitle")}</p>
              <p className="mt-1 text-sm text-ink-soft">{translate("public.podcast.noneText")}</p>
            </div>
          ) : (
            <PodcastList seasons={publicSeasons} labels={labels} locale={locale} />
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
