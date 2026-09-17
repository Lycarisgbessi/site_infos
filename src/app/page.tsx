import { getTranslations } from "@/lib/i18n";
import {
  getActiveLive,
  getHeroArticles,
  getLatestArticles,
  getMostReadArticles,
  getOpinionArticles,
  getSectionArticles,
  getVideoArticles,
  getFeaturedDossier,
  getWeather,
  getWorldArticles,
} from "@/lib/public/homepage-data";
import { TopBar, SiteHeader } from "@/components/public/site-header";
import { FlashTicker } from "@/components/public/flash-ticker";
import { AdBanner, AdNativeCard, AdSelfPromo, AdWeatherSponsor } from "@/components/public/ad-slot";
import { MobileStickyAd } from "@/components/public/mobile-sticky-ad";
import { ContinuousItem, HeroCard, MostReadItem, SideCard } from "@/components/public/article-cards";
import { DossierBlock, OpinionCards, SectionBlock, VideoSection, WorldGrid } from "@/components/public/section-block";
import { NewsletterBlock } from "@/components/public/newsletter-block";
import { WeatherStrip } from "@/components/public/weather-strip";
import { SiteFooter } from "@/components/public/site-footer";

/**
 * Route `/` — ACCUEIL ÉDITORIAL PUBLIC (§09.1) piloté par homepage_blocks.
 * Une, flash défilant, sections par rubrique avec images, en continu,
 * plus lus, vidéos, dossier, monde, opinions, météo réelle, newsletter —
 * et 9 emplacements publicitaires (AD-02/03/04/07/08/12/15/16/19).
 * Task ID: 9-PAGE
 */

export const dynamic = "force-dynamic";

const SECTIONS: { slug: string }[] = [
  { slug: "politique" },
  { slug: "economie" },
  { slug: "societe" },
  { slug: "international" },
  { slug: "sport" },
  { slug: "culture" },
  { slug: "reportages" },
  { slug: "tech" },
];

export default async function HomePage() {
  const { translate } = await getTranslations();
  const now = new Date();

  const [hero, latest, mostRead, live, videos, dossier, opinions, world, weather, ...sections] =
    await Promise.all([
      getHeroArticles(5),
      getLatestArticles(12),
      getMostReadArticles(5),
      getActiveLive(),
      getVideoArticles(6),
      getFeaturedDossier(),
      getOpinionArticles(4),
      getWorldArticles(8),
      getWeather(),
      ...SECTIONS.map((s) => getSectionArticles(s.slug, 5)),
    ]);

  const sectionData = SECTIONS.map((s, i) => ({ slug: s.slug, articles: sections[i] }));
  const [heroMain, ...heroSide] = hero;

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <TopBar />
      <SiteHeader />
      <FlashTicker />

      <main id="contenu" className="flex-1 pb-10">
        {/* ── Z-02 : Leaderboard d'en-tête (compact) ─────────────────────── */}
        <div className="container-page mt-4">
          <AdBanner code="AD-02" />
        </div>

        {/* ── Z-04 : À la une (composeur home_lead) ──────────────────────── */}
        {heroMain && (
          <section aria-label={translate("public.une.title")} className="container-page mt-6">
            <header className="mb-4 flex items-center gap-3">
              <span aria-hidden className="h-[3px] w-8 bg-brand-red" />
              <h1 className="kicker text-ink">{translate("public.une.title")}</h1>
            </header>
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <HeroCard article={heroMain} />
              <div className="flex flex-col gap-3 border-t border-rule pt-3 lg:border-t-0 lg:pt-0">
                {heroSide.map((a) => (
                  <SideCard key={a.id} article={a} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Z-05 : Bandeau direct ──────────────────────────────────────── */}
        {live && (
          <div className="container-page mt-6">
            <a
              href="#en-continu"
              className="group flex items-center gap-4 border border-rule bg-paper-alt px-4 py-3 transition-colors duration-200 hover:border-rule-strong"
            >
              <span className="flex shrink-0 items-center gap-2 bg-brand-red px-2.5 py-1 text-xs font-black uppercase tracking-widest text-white">
                <span aria-hidden className="size-1.5 animate-ping rounded-full bg-white" />
                {translate("public.une.live")}
              </span>
              <p className="min-w-0 flex-1 truncate font-serif text-sm font-bold md:text-base">{live.title}</p>
              <span className="hidden shrink-0 text-xs font-semibold uppercase tracking-widest text-ink-faint transition-colors duration-200 group-hover:text-brand-red md:block">
                {translate("public.une.liveCta")} →
              </span>
            </a>
          </div>
        )}

        {/* ── AD-03 : Billboard sous la une ──────────────────────────────── */}
        <div className="container-page mt-6">
          <AdBanner code="AD-03" />
        </div>

        {/* ── Corps : sections + colonne latérale ────────────────────────── */}
        <div className="container-page mt-8 grid gap-10 lg:grid-cols-[1fr_320px]">
          {/* Colonne principale */}
          <div className="min-w-0 space-y-10">
            {sectionData.slice(0, 3).map(({ slug, articles }, idx) => (
              <SectionBlock
                key={slug}
                id={slug}
                title={articles[0]?.category?.name ?? slug}
                articles={articles}
                adSlot={
                  idx === 0 ? (
                    <div className="mt-6">
                      <AdBanner code="AD-07" />
                    </div>
                  ) : idx === 1 ? (
                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      <AdNativeCard code="AD-08" sponsor="Partenaire" />
                      <AdNativeCard code="AD-16" sponsor="Météo" />
                    </div>
                  ) : undefined
                }
              />
            ))}

            {/* ── Z-08 : Reportages vidéo ─────────────────────────────────── */}
            <div className="-mx-6 lg:-mx-12">
              <VideoSection
                articles={videos}
                title={translate("public.video.section")}
                playLabel={translate("public.video.play")}
              />
            </div>

            {/* ── Z-11 : Dossier immersif ─────────────────────────────────── */}
            {dossier?.cover && <DossierBlock dossier={dossier} kickerLabel={translate("public.dossier.kicker")} />}

            {/* Sections suivantes */}
            {sectionData.slice(3, 6).map(({ slug, articles }, idx) => (
              <SectionBlock
                key={slug}
                id={slug}
                title={articles[0]?.category?.name ?? slug}
                articles={articles}
                adSlot={
                  idx === 2 ? (
                    <div className="mt-6">
                      <AdNativeCard code="AD-08" sponsor="Partenaire" />
                    </div>
                  ) : undefined
                }
              />
            ))}

            {/* ── Z-12 : Monde ────────────────────────────────────────────── */}
            {world.length > 0 && (
              <section aria-label={translate("public.world.title")}>
                <header className="flex items-baseline justify-between border-b-2 border-ink pb-2">
                  <h2 className="font-serif text-xl font-black tracking-tight md:text-2xl">
                    {translate("public.world.title")}
                  </h2>
                </header>
                <div className="pt-5">
                  <WorldGrid articles={world} />
                </div>
              </section>
            )}

            {/* ── Z-13 : Opinions ─────────────────────────────────────────── */}
            {opinions.length > 0 && (
              <section aria-label={translate("public.opinion.title")}>
                <header className="border-b-2 border-ink pb-2">
                  <h2 className="font-serif text-xl font-black tracking-tight md:text-2xl">
                    {translate("public.opinion.title")}
                  </h2>
                  <p className="mt-1 text-xs text-ink-soft">{translate("public.opinion.subtitle")}</p>
                </header>
                <div className="pt-5">
                  <OpinionCards articles={opinions} />
                </div>
              </section>
            )}

            {/* ── Z-09 : Newsletter ───────────────────────────────────────── */}
            <NewsletterBlock
              kicker={translate("public.newsletter.kicker")}
              title={translate("public.newsletter.morningTitle")}
              description={translate("public.newsletter.morningDesc")}
              placeholder={translate("public.newsletter.placeholder")}
              cta={translate("public.newsletter.cta")}
              okMessage={translate("public.newsletter.ok")}
              errorMessage={translate("public.newsletter.error")}
              loadingMessage={translate("public.newsletter.loading")}
            />

            {/* Sections finales + AD-14 */}
            {sectionData.slice(6).map(({ slug, articles }) => (
              <SectionBlock key={slug} id={slug} title={articles[0]?.category?.name ?? slug} articles={articles} />
            ))}
            <AdBanner code="AD-14" />
          </div>

          {/* ── Colonne latérale (Z-06) ──────────────────────────────────── */}
          <aside className="min-w-0 space-y-6 lg:sticky lg:top-16 lg:max-h-[calc(100vh-5rem)] lg:self-start lg:overflow-y-auto lg:pr-1" id="en-continu">
            {/* En continu */}
            <section aria-label={translate("public.list.continuous")} className="scroll-mt-20 border border-rule bg-paper-alt p-4">
              <header className="flex items-center gap-2 border-b border-rule pb-2">
                <span aria-hidden className="size-2 animate-pulse rounded-full bg-brand-red" />
                <h2 className="kicker text-ink">{translate("public.list.continuous")}</h2>
              </header>
              <div className="max-h-[26rem] divide-y divide-rule overflow-y-auto pr-1">
                {latest.map((a, i) => (
                  <ContinuousItem key={a.id} article={a} index={i} />
                ))}
              </div>
            </section>

            {/* AD-04 : pavé latéral */}
            <AdBanner code="AD-04" />

            {/* Les plus lus */}
            <section aria-label={translate("public.list.mostRead")} className="border border-rule bg-paper-alt p-4">
              <header className="border-b border-rule pb-2">
                <h2 className="kicker text-ink">{translate("public.list.mostRead")}</h2>
              </header>
              <div className="divide-y divide-rule">
                {mostRead.map((a, i) => (
                  <MostReadItem key={a.id} article={a} index={i} />
                ))}
              </div>
            </section>

            {/* AD-19 : auto-promotion */}
            <AdSelfPromo />

            {/* Météo réelle (Z-10) + sponsoring AD-16 */}
            <WeatherStrip
              weather={weather}
              sponsorNode={<AdWeatherSponsor />}
            />
          </aside>
        </div>

        {/* ── AD-15 : bannière pied de page ─────────────────────────────── */}
        <div className="container-page mt-10">
          <AdBanner code="AD-15" />
        </div>
      </main>

      <SiteFooter />
      <MobileStickyAd
        label={translate("public.ad.label")}
        title={translate("public.ad.demoTitle")}
        text={translate("public.ad.demoText")}
        cta={translate("public.ad.demoCta")}
        closeLabel={translate("common.close")}
      />
    </div>
  );
}
