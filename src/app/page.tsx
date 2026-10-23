import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { getTranslations, type Translator } from "@/lib/i18n";
import {
  getActiveLive,
  getComposedHomepage,
  getHeroArticles,
  getLatestArticles,
  getMostReadArticles,
  getOpinionArticles,
  getSectionArticles,
  getVideoArticles,
  getFeaturedDossier,
  getSiteBanners,
  getWeather,
  getWorldArticles,
  getAdCampaigns,
  getFallbackSections,
  type AdCampaignMap,
  type ComposedBlock,
  type PublicArticle,
  type WeatherNow,
} from "@/lib/public/homepage-data";
import { getSettingsValues } from "@/server/services/settings";
import { TopBar, SiteHeader } from "@/components/public/site-header";
import { FlashTicker } from "@/components/public/flash-ticker";
import { AdBanner, AdNativeCard, AdSelfPromo, AdWeatherSponsor } from "@/components/public/ad-slot";
import { MobileStickyAd } from "@/components/public/mobile-sticky-ad";
import { ContinuousItem, timeAgo, HeroCard, MostReadItem, SideCard } from "@/components/public/article-cards";
import { ContinuousFeed, type ContinuousFeedItem } from "@/components/public/continuous-feed";
import { DossierBlock, OpinionCards, SectionBlock, VideoSection, WorldGrid } from "@/components/public/section-block";
import { NewsletterBlock } from "@/components/public/newsletter-block";
import { WeatherStrip } from "@/components/public/weather-strip";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteBannerBar } from "@/components/public/site-banner-bar";
import { Reveal, RevealGroup } from "@/components/public/reveal";

/**
 * Route `/` — ACCUEIL ÉDITORIAL PUBLIC (§09.1), piloté par le composeur
 * `/admin/homepage` (table homepage_blocks) : chaque bloc actif, dans
 * l'ordre des positions, est résolu puis rendu avec les composants
 * existants (une, flash, sections par rubrique, en continu, plus lus,
 * vidéos, dossier, monde, opinions, météo, newsletter, publicités).
 * Repli robuste : si AUCUN bloc actif n'est configuré (table vide, seed
 * absent), le gabarit historique §09.1 est rendu à l'identique.
 * Modules désactivables : features.tv (vidéos), features.weather (météo).
 * Task ID: 9-PAGE
 */

export const dynamic = "force-dynamic";

/** Blocs portés par la colonne latérale (ordre du composeur conservé). */
function isSidebarBlock(block: ComposedBlock): boolean {
  return (
    block.type === "latest" ||
    block.type === "most_read" ||
    block.type === "weather" ||
    (block.type === "ad" && block.settings.placement === "sidebar")
  );
}

function toFeedItems(
  articles: PublicArticle[],
  t: Translator
): ContinuousFeedItem[] {
  const now = new Date();
  return articles.map((a) => ({
    id: a.id,
    title: a.title,
    shortTitle: a.shortTitle ?? null,
    slug: a.slug,
    category: a.category?.name ?? null,
    timeAgo: timeAgo(a.publishedAt, now, {
      today: t("public.time.today"),
      yesterday: t("public.time.yesterday"),
    }),
  }));
}

export default async function HomePage() {
  const { translate } = await getTranslations();

  const [banners, adCampaigns, settings, composed] = await Promise.all([
    getSiteBanners("/"),
    getAdCampaigns(),
    getSettingsValues(["features.tv", "features.weather"]),
    getComposedHomepage(),
  ]);

  // Modules désactivables (§11.2 /admin/parametres) — lus comme /video :
  // absence de ligne ou "true" = actif, "false" = masqué.
  const tvEnabled = settings["features.tv"] !== "false";
  const weatherEnabled = settings["features.weather"] !== "false";
  const flashEnabled = composed === null || composed.some((b) => b.type === "flash");

  const siteHeader = (
    <>
      <SiteBannerBar banners={banners} closeLabel={translate("public.banner.close")} />
      <TopBar />
      <SiteHeader />
      {flashEnabled && <FlashTicker />}
    </>
  );
  const siteFooter = (
    <>
      <SiteFooter />
      <MobileStickyAd
        label={translate("public.ad.label")}
        cta={translate("public.ad.cta")}
        closeLabel={translate("common.close")}
        campaigns={adCampaigns["AD-12"] ?? []}
      />
    </>
  );

  if (composed) {
    return (
      <div className="flex min-h-screen flex-col bg-paper">
        {siteHeader}
        <main id="contenu" className="flex-1 pb-10">
          <ComposedMain
            blocks={composed}
            adCampaigns={adCampaigns}
            tvEnabled={tvEnabled}
            weatherEnabled={weatherEnabled}
            translate={translate}
          />
        </main>
        {siteFooter}
      </div>
    );
  }

  // ── Repli : AUCUN bloc actif → gabarit §09.1 historique ──────────────
  // Sections dynamiques : toutes les rubriques parentes visibles ayant au
  // moins un article publié, triées par position (les 8 historiques en
  // tête d'affichage) — résolution dans homepage-data.getFallbackSections.
  const sectionsConfig = await getFallbackSections();
  const [hero, latest, mostRead, live, videos, dossier, opinions, world, weather, ...sections] = await Promise.all([
    getHeroArticles(5),
    getLatestArticles(12),
    getMostReadArticles(5),
    getActiveLive(),
    tvEnabled ? getVideoArticles(6) : Promise.resolve<PublicArticle[]>([]),
    getFeaturedDossier(),
    getOpinionArticles(4),
    getWorldArticles(8),
    weatherEnabled ? getWeather() : Promise.resolve<WeatherNow[]>([]),
    ...sectionsConfig.map((s) => getSectionArticles(s.slug, 5)),
  ]);

  const sectionData = sectionsConfig.map((s, i) => ({ slug: s.slug, articles: sections[i] }));
  const [heroMain, ...heroSide] = hero;

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      {siteHeader}

      <main id="contenu" className="flex-1 pb-10">
        {/* ── Z-02 : Leaderboard d'en-tête (compact) ─────────────────────── */}
        <div className="container-page mt-4">
          <AdBanner code="AD-02" campaigns={adCampaigns} />
        </div>

        {/* ── Z-04 : À la une (composeur home_lead) ──────────────────────── */}
        {heroMain && (
          <section aria-label={translate("public.une.title")} className="container-page mt-6">
            <header className="mb-4 flex items-center gap-3">
              <span aria-hidden className="h-[3px] w-8 bg-brand-red" />
              <h1 className="kicker text-ink">{translate("public.une.title")}</h1>
            </header>
            <div className="hero-stage grid gap-6 lg:grid-cols-[2fr_1fr]">
              <HeroCard article={heroMain} />
              <div className="flex flex-col gap-3 border-t border-rule pt-3 lg:border-t-0 lg:pt-0">
                {heroSide.map((a, i) => (
                  <Reveal key={a.id} variant="right" delay={i * 90}>
                    <SideCard article={a} />
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Z-05 : Bandeau direct ──────────────────────────────────────── */}
        {live && (
          <div className="container-page mt-6">
            <Link
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
            </Link>
          </div>
        )}

        {/* ── AD-03 : Billboard sous la une ──────────────────────────────── */}
        <div className="container-page mt-6">
          <AdBanner code="AD-03" campaigns={adCampaigns} />
        </div>

        {/* ── Corps : sections + colonne latérale ────────────────────────── */}
        <div className="container-page mt-8 grid gap-10 lg:grid-cols-[1fr_320px]">
          {/* Colonne principale */}
          <div className="min-w-0 space-y-10">

            {sectionData.slice(0, 3).map(({ slug, articles }, idx) => (
              <Reveal key={slug} variant={idx % 2 === 0 ? "left" : "right"}>
                <SectionBlock
                  id={slug}
                  title={articles[0]?.category?.name ?? slug}
                  articles={articles}
                  adSlot={
                    idx === 0 ? (
                      <div className="mt-6">
                        <AdBanner code="AD-07" campaigns={adCampaigns} />
                      </div>
                    ) : idx === 1 ? (
                      <div className="mt-6 grid gap-4 sm:grid-cols-2">
                        <AdNativeCard code="AD-08" campaigns={adCampaigns} />
                        <AdNativeCard code="AD-16" campaigns={adCampaigns} />
                      </div>
                    ) : undefined
                  }
                />
              </Reveal>
            ))}

            {/* ── Z-08 : Reportages vidéo ─────────────────────────────────── */}
            <div className="-mx-6 lg:-mx-12">
              <Reveal>
                <VideoSection
                  articles={videos}
                  title={translate("public.video.section")}
                  playLabel={translate("public.video.play")}
                />
              </Reveal>
            </div>

            {/* ── Z-11 : Dossier immersif ─────────────────────────────────── */}
            {dossier?.cover && <DossierBlock dossier={dossier} kickerLabel={translate("public.dossier.kicker")} />}

            {/* Sections suivantes */}
            {sectionData.slice(3, 6).map(({ slug, articles }, idx) => (
              <Reveal key={slug} variant="up">
                <SectionBlock
                  id={slug}
                  title={articles[0]?.category?.name ?? slug}
                  articles={articles}
                  adSlot={
                    idx === 2 ? (
                      <div className="mt-6">
                        <AdNativeCard code="AD-08" campaigns={adCampaigns} />
                      </div>
                    ) : undefined
                  }
                />
              </Reveal>
            ))}

            {/* ── Z-12 : Monde ────────────────────────────────────────────── */}
            {world.length > 0 && (
              <Reveal>
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
              </Reveal>
            )}

            {/* ── Z-13 : Opinions ─────────────────────────────────────────── */}
            {opinions.length > 0 && (
              <Reveal>
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
              </Reveal>
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
              <Reveal key={slug}>
                <SectionBlock id={slug} title={articles[0]?.category?.name ?? slug} articles={articles} />
              </Reveal>
            ))}
            <AdBanner code="AD-14" campaigns={adCampaigns} />
          </div>

          {/* ── Colonne latérale (Z-06) ──────────────────────────────────── */}
          <aside className="min-w-0 space-y-6 lg:sticky lg:top-16 lg:self-start" id="en-continu">
            {/* En continu */}
            <section aria-label={translate("public.list.continuous")} className="scroll-mt-20 border border-rule bg-paper-alt p-4">
              <header className="flex items-center gap-2 border-b-2 border-brand-red pb-2">
                <span aria-hidden className="live-dot size-2.5 rounded-full bg-brand-red" />
                <h2 className="kicker text-base font-bold text-brand-red">{translate("public.list.continuous")}</h2>
              </header>
              <ContinuousFeed items={toFeedItems(latest, translate)} labels={{ all: translate("public.list.continuous") }} />
            </section>

            {/* AD-04 : pavé latéral */}
            <AdBanner code="AD-04" campaigns={adCampaigns} />

            {/* AD-05 : demi-page verticale (300×600) */}
            <AdBanner code="AD-05" campaigns={adCampaigns} />

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
            {weatherEnabled && <WeatherStrip weather={weather} sponsorNode={<AdWeatherSponsor />} />}
          </aside>
        </div>

        {/* ── AD-15 : bannière pied de page ─────────────────────────────── */}
        <div className="container-page mt-10">
          <AdBanner code="AD-15" campaigns={adCampaigns} />
        </div>
      </main>

      {siteFooter}
    </div>
  );
}

// ─── Rendu piloté par le composeur (homepage_blocks) ───────────────────

interface ComposedMainProps {
  blocks: ComposedBlock[];
  adCampaigns: AdCampaignMap;
  tvEnabled: boolean;
  weatherEnabled: boolean;
  translate: Translator;
}

/** Corps de l'accueil composé : la une, les directs et les publicités qui
 * précèdent le premier bloc de contenu s'ouvrent pleine largeur (comme le
 * zoning §09.1) ; les blocs latest/most_read/weather peuplent la colonne
 * latérale ; tout le reste suit l'ordre du composeur dans la colonne
 * principale. Le bandeau flash est rendu dans l'en-tête de la page. */
function ComposedMain({ blocks, adCampaigns, tvEnabled, weatherEnabled, translate }: ComposedMainProps) {
  const flow = blocks.filter((b) => !isSidebarBlock(b) && b.type !== "flash");
  let topCount = 0;
  while (topCount < flow.length && ["lead", "live", "ad"].includes(flow[topCount].type)) {
    topCount += 1;
  }
  const topBlocks = flow.slice(0, topCount);
  const mainBlocks = flow.slice(topCount);
  const sidebarBlocks = blocks.filter(isSidebarBlock);

  const renderLead = (b: Extract<ComposedBlock, { type: "lead" }>) => {
    const [heroMain, ...heroSide] = b.articles;
    if (!heroMain) return null;
    return (
      <section aria-label={b.title ?? translate("public.une.title")}>
        <header className="mb-4 flex items-center gap-3">
          <span aria-hidden className="h-[3px] w-8 bg-brand-red" />
          <h1 className="kicker text-ink">{b.title ?? translate("public.une.title")}</h1>
        </header>
        <div className="hero-stage grid gap-6 lg:grid-cols-[2fr_1fr]">
          <HeroCard article={heroMain} />
          <div className="flex flex-col gap-3 border-t border-rule pt-3 lg:border-t-0 lg:pt-0">
            {heroSide.map((a, i) => (
              <Reveal key={a.id} variant="right" delay={i * 90}>
                <SideCard article={a} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    );
  };

  const renderLive = (b: Extract<ComposedBlock, { type: "live" }>) =>
    b.live ? (
      <Link
        href="#en-continu"
        className="group flex items-center gap-4 border border-rule bg-paper-alt px-4 py-3 transition-colors duration-200 hover:border-rule-strong"
      >
        <span className="flex shrink-0 items-center gap-2 bg-brand-red px-2.5 py-1 text-xs font-black uppercase tracking-widest text-white">
          <span aria-hidden className="size-1.5 animate-ping rounded-full bg-white" />
          {translate("public.une.live")}
        </span>
        <p className="min-w-0 flex-1 truncate font-serif text-sm font-bold md:text-base">{b.live.title}</p>
        <span className="hidden shrink-0 text-xs font-semibold uppercase tracking-widest text-ink-faint transition-colors duration-200 group-hover:text-brand-red md:block">
          {translate("public.une.liveCta")} →
        </span>
      </Link>
    ) : null;

  const renderAd = (slotCode: string | undefined) => (slotCode ? <AdBanner code={slotCode} campaigns={adCampaigns} /> : null);

  const mostReadWidget = (articles: PublicArticle[]) =>
    articles.length > 0 ? (
      <section aria-label={translate("public.list.mostRead")} className="border border-rule bg-paper-alt p-4">
        <header className="border-b border-rule pb-2">
          <h2 className="kicker text-ink">{translate("public.list.mostRead")}</h2>
        </header>
        <div className="divide-y divide-rule">
          {articles.map((a, i) => (
            <MostReadItem key={a.id} article={a} index={i} />
          ))}
        </div>
      </section>
    ) : null;

  const latestWidget = (b: Extract<ComposedBlock, { type: "latest" }>) => {
    const mostRead = b.settings.sidebarMostRead === true ? mostReadWidget(b.mostRead) : null;
    if (b.articles.length === 0 && !mostRead) return null;
    return (
      <>
        {b.articles.length > 0 && (
          <section aria-label={translate("public.list.continuous")} className="scroll-mt-20 border border-rule bg-paper-alt p-4">
            <header className="flex items-center gap-2 border-b-2 border-brand-red pb-2">
              <span aria-hidden className="live-dot size-2.5 rounded-full bg-brand-red" />
              <h2 className="kicker text-base font-bold text-brand-red">{b.title ?? translate("public.list.continuous")}</h2>
            </header>
            <ContinuousFeed items={toFeedItems(b.articles, translate)} labels={{ all: translate("public.list.continuous") }} />
          </section>
        )}
        {b.settings.sidebarAd ? <AdBanner code={b.settings.sidebarAd} campaigns={adCampaigns} /> : null}
        {mostRead}
      </>
    );
  };

  const renderMainBlock = (b: ComposedBlock, blockIndex = 0): ReactNode => {
    switch (b.type) {
      case "section":
        return b.articles.length > 0 ? (
          <Reveal variant={blockIndex % 2 === 0 ? "left" : "right"}>
            <SectionBlock id={b.anchorId} title={b.heading} articles={b.articles} />
          </Reveal>
        ) : null;
      case "video":
        return tvEnabled && b.articles.length > 0 ? (
          <div className="-mx-6 lg:-mx-12">
            <Reveal>
              <VideoSection
                articles={b.articles}
                title={b.title ?? translate("public.video.section")}
                playLabel={translate("public.video.play")}
              />
            </Reveal>
          </div>
        ) : null;
      case "dossier":
        return b.dossier?.cover ? <DossierBlock dossier={b.dossier} kickerLabel={translate("public.dossier.kicker")} /> : null;
      case "world":
        return b.articles.length > 0 ? (
          <Reveal>
            <section aria-label={b.title ?? translate("public.world.title")}>
              <header className="flex items-baseline justify-between border-b-2 border-ink pb-2">
                <h2 className="font-serif text-xl font-black tracking-tight md:text-2xl">
                  {b.title ?? translate("public.world.title")}
                </h2>
              </header>
              <div className="pt-5">
                <WorldGrid articles={b.articles} />
              </div>
            </section>
          </Reveal>
        ) : null;
      case "opinion":
        return b.articles.length > 0 ? (
          <Reveal>
            <section aria-label={b.title ?? translate("public.opinion.title")}>
              <header className="border-b-2 border-ink pb-2">
                <h2 className="font-serif text-xl font-black tracking-tight md:text-2xl">
                  {b.title ?? translate("public.opinion.title")}
                </h2>
                <p className="mt-1 text-xs text-ink-soft">{b.subtitle ?? translate("public.opinion.subtitle")}</p>
              </header>
              <div className="pt-5">
                <OpinionCards articles={b.articles} />
              </div>
            </section>
          </Reveal>
        ) : null;
      case "newsletter":
        return (
          <NewsletterBlock
            kicker={translate("public.newsletter.kicker")}
            title={b.title ?? translate("public.newsletter.morningTitle")}
            description={translate("public.newsletter.morningDesc")}
            placeholder={translate("public.newsletter.placeholder")}
            cta={translate("public.newsletter.cta")}
            okMessage={translate("public.newsletter.ok")}
            errorMessage={translate("public.newsletter.error")}
            loadingMessage={translate("public.newsletter.loading")}
          />
        );
      case "lead":
        return renderLead(b);
      case "live":
        return renderLive(b);
      case "ad":
        return renderAd(b.settings.slotCode);
      default:
        // Blocs non supportés (alert, custom_html…) : ignorés au rendu
        return null;
    }
  };

  // Colonne latérale : widgets dans l'ordre du composeur ; l'auto-promotion
  // (AD-19) reste un élément d'habillage, insérée avant la météo comme sur
  // le zoning historique (ou en fin de colonne s'il n'y a pas de météo).
  const sidebarWidgets: ReactNode[] = [];
  let selfPromoInserted = false;
  for (const b of sidebarBlocks) {
    switch (b.type) {
      case "latest": {
        const widget = latestWidget(b);
        if (widget) sidebarWidgets.push(<Fragment key={b.id}>{widget}</Fragment>);
        break;
      }
      case "most_read": {
        const widget = mostReadWidget(b.articles);
        if (widget) sidebarWidgets.push(<Fragment key={b.id}>{widget}</Fragment>);
        break;
      }
      case "weather": {
        if (!weatherEnabled || b.weather.length === 0) break;
        if (!selfPromoInserted) {
          sidebarWidgets.push(<AdSelfPromo key="ad-self-promo" />);
          selfPromoInserted = true;
        }
        sidebarWidgets.push(<WeatherStrip key={b.id} weather={b.weather} sponsorNode={<AdWeatherSponsor />} />);
        break;
      }
      case "ad": {
        if (b.settings.slotCode) sidebarWidgets.push(<AdBanner key={b.id} code={b.settings.slotCode} campaigns={adCampaigns} />);
        break;
      }
      default:
        break;
    }
  }
  if (!selfPromoInserted && sidebarWidgets.length > 0) {
    sidebarWidgets.push(<AdSelfPromo key="ad-self-promo" />);
  }

  const hasSidebar = sidebarWidgets.length > 0;

  return (
    <>
      {/* Ouverture pleine largeur : publicités d'en-tête, une, direct */}
      {topBlocks.map((b, i) => {
        const shell = i === 0 ? "container-page mt-4" : "container-page mt-6";
        if (b.type === "lead") return <div key={b.id} className={shell}>{renderLead(b)}</div>;
        if (b.type === "live") return <div key={b.id} className={shell}>{renderLive(b)}</div>;
        return <div key={b.id} className={shell}>{renderAd(b.settings.slotCode)}</div>;
      })}

      {topBlocks.length > 0 && (
        <div className="container-page mt-6">
          <AdBanner code="AD-03" campaigns={adCampaigns} />
        </div>
      )}

      {/* Corps : blocs composés dans l'ordre + colonne latérale */}
      <div className={hasSidebar ? "container-page mt-8 grid gap-10 lg:grid-cols-[1fr_320px]" : "container-page mt-8"}>
        <div className="min-w-0 space-y-10">

          {mainBlocks.map((b, i) => {
            const node = renderMainBlock(b, i);
            return node ? <Fragment key={b.id}>{node}</Fragment> : null;
          })}
        </div>
        {hasSidebar && (
          <aside
            className="min-w-0 space-y-6 lg:sticky lg:top-16 lg:self-start"
            id="en-continu"
          >
            {sidebarWidgets}
          </aside>
        )}
      </div>

      {/* ── AD-15 : bannière pied de page ─────────────────────────────── */}
      <div className="container-page mt-10">
        <AdBanner code="AD-15" campaigns={adCampaigns} />
      </div>
    </>
  );
}
