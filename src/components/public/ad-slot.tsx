import { getTranslations } from "@/lib/i18n";
import type { AdCampaignMap, PublicAdCampaign } from "@/lib/public/homepage-data";
import { AdRotation, type AdHouseLabels } from "@/components/public/ad-creative-client";

/**
 * Emplacements publicitaires du front-office (§13.1, slots AD-01→AD-19).
 * Composants SERVEUR. Système « taquin » 2026-10 : chaque emplacement
 * reçoit TOUTES les campagnes actives éligibles de son slot et les fait
 * tourner (roue 5 s + glissières auto-promo selon la règle 0→3 / 1-2→2 /
 * ≥3→1) via AdRotation ; sans campagne active, l'employment vit avec les
 * seules glissières auto-promo, sauf auto-promotion maison (AdSelfPromo,
 * AD-19). Charte ROUGE SANG #A4161A / BLANC / NOIR.
 * Task ID: 9-ADS
 */

type AdFormat =
  | "leaderboard"
  | "billboard"
  | "pave"
  | "halfpage"
  | "native"
  | "footer"
  | "header"
  | "promo"
  | "sticky"
  | "video"
  | "inarticle"
  | "sidebar_sticky";

/** Format de rendu par emplacement — calqué sur AD_SLOT_RENDER du seed
 * (prisma/seed-data/ads-newsletters.ts). Mise à jour « taquin » 2026-10 :
 *  - AD-02 : bandeau d'en-tête pleine largeur h-28/h-36 ;
 *  - AD-04 : pavé sidebar 250 px ;
 *  - AD-05 : demi-page sticky sidebar 600 px ;
 *  - AD-13 : IN_ARTICLE horizontal 680×180 ;
 *  - AD-15 : pied de page pleine largeur h-28/h-36. */
const FORMAT_BY_SLOT: Record<string, AdFormat> = {
  "AD-01": "billboard",
  "AD-02": "header",
  "AD-03": "billboard",
  "AD-04": "pave",
  "AD-05": "sidebar_sticky",
  "AD-06": "pave",
  "AD-07": "leaderboard",
  "AD-08": "native",
  "AD-09": "native",
  "AD-10": "leaderboard",
  "AD-11": "video",
  "AD-12": "sticky",
  "AD-13": "inarticle",
  "AD-14": "leaderboard",
  "AD-15": "footer",
  "AD-16": "native",
  "AD-17": "native",
  "AD-18": "native",
  "AD-19": "promo",
};

const HEIGHTS: Record<AdFormat, string> = {
  leaderboard: "h-[90px]",
  billboard: "h-[140px] md:h-[180px]",
  pave: "h-[250px]",
  halfpage: "h-[400px]",
  native: "h-[110px]",
  footer: "h-28 md:h-36",
  header: "h-28 md:h-36",
  promo: "h-[200px]",
  sticky: "h-[50px]",
  video: "h-[180px] md:h-[220px]",
  /** Horizontal 680×180 dans le corps d'article (max-w-full, ratio auto). */
  inarticle: "h-[110px] md:h-[180px]",
  /** Colonne latérale collante : 300×600. */
  sidebar_sticky: "h-[600px]",
};

/** Contrainte de largeur par format (inarticle : 680 px centrés). */
const WIDTHS: Partial<Record<AdFormat, string>> = {
  inarticle: "mx-auto w-full max-w-full md:max-w-[680px]",
};

/** Libellés des glissières auto-promo, traduits côté serveur — réutilisé
 * par les présences taquines du layout (SidePeekAd, InterstitialAd). */
export async function buildHouseLabels(): Promise<AdHouseLabels> {
  const { translate } = await getTranslations();
  return {
    adLabel: translate("public.ad.label"),
    eyebrow: translate("public.ad.houseEyebrow"),
    count: translate("public.ad.houseCount"),
    brand: {
      title: translate("public.ad.houseBrandTitle"),
      subtitle: translate("public.ad.houseBrandSub"),
      cta: translate("public.ad.houseCta"),
    },
    audience: {
      title: translate("public.ad.houseAudienceTitle"),
      subtitle: translate("public.ad.houseAudienceSub"),
      cta: translate("public.ad.houseLaunchCta"),
    },
    motion: {
      title: translate("public.ad.houseMotionTitle"),
      subtitle: translate("public.ad.houseMotionSub"),
      cta: translate("public.ad.houseFormatsCta"),
    },
    formatBanner: translate("public.ad.houseFormatBanner"),
    formatVideo: translate("public.ad.houseFormatVideo"),
    formatNative: translate("public.ad.houseFormatNative"),
  };
}

function SlotShell({
  code,
  label,
  children,
  className = "",
}: {
  code: string;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <aside
      aria-label={`${label} ${code}`}
      data-ad-slot={code}
      className={`group relative bg-paper-alt [&_.ad-placeholder]:border-dashed [&_.ad-placeholder]:bg-paper ${className}`}
    >
      {/* Étiquette éditoriale — filets latéraux, centrée */}
      <span className="absolute -top-2.5 start-1/2 z-20 flex -translate-x-1/2 items-center gap-2 bg-paper px-2.5 rtl:translate-x-1/2">
        <span aria-hidden className="h-px w-4 bg-rule-strong" />
        <span className="text-[0.56rem] font-semibold uppercase tracking-[0.34em] text-ink-faint">{label}</span>
        <span aria-hidden className="h-px w-4 bg-rule-strong" />
      </span>
      {children}
    </aside>
  );
}

/** Bannière par emplacement — roue animée des campagnes actives du slot
 * (voir AdRotation) + glissières auto-promo. Cas particulier AD-19 : sans
 * campagne active, l'emplacement bascule sur l'auto-promotion maison
 * (repli) au lieu de la roue.
 * `enabled=false` (réglage ads.* de l'admin) : l'emplacement disparaît. */
export async function AdBanner({
  code,
  campaigns,
  className = "",
  formatOverride,
  placeholder = false,
  enabled = true,
}: {
  code: string;
  campaigns: AdCampaignMap;
  className?: string;
  /** Forcer le gabarit de rendu (ex. leaderboard compact dans l'en-tête). */
  formatOverride?: AdFormat;
  /** Afficher un cadre réservé discret même sans campagne active. */
  placeholder?: boolean;
  /** Court-circuit réglages admin (ads.header, ads.sidebar…). */
  enabled?: boolean;
}) {
  if (!enabled) return null;
  const { translate } = await getTranslations();
  const slotCampaigns: PublicAdCampaign[] | undefined = campaigns[code];
  if (!slotCampaigns || slotCampaigns.length === 0) {
    if (code === "AD-19") {
      return (
        <SlotShell code={code} label={translate("public.ad.label")} className={`w-full ${className}`}>
          <AdSelfPromoContent />
        </SlotShell>
      );
    }
    // Sans campagne : la roue auto-promo anime déjà l'emplacement (le cycle
    // vit même vide et incite à commander l'espace).
    const ph = HEIGHTS[formatOverride ?? FORMAT_BY_SLOT[code] ?? "leaderboard"];
    const pw = WIDTHS[formatOverride ?? FORMAT_BY_SLOT[code] ?? "leaderboard"] ?? "w-full";
    return (
      <SlotShell
        code={code}
        label={translate("public.ad.label")}
        className={`${pw} overflow-hidden ${ph} ${className}`}
      >
        <AdRotation campaigns={[]} houseLabels={await buildHouseLabels()} />
      </SlotShell>
    );
  }

  const format = formatOverride ?? FORMAT_BY_SLOT[code] ?? "leaderboard";
  return (
    <SlotShell
      code={code}
      label={translate("public.ad.label")}
      className={`${WIDTHS[format] ?? "w-full"} overflow-hidden ${HEIGHTS[format]} ${className}`}
    >
      <AdRotation campaigns={slotCampaigns} houseLabels={await buildHouseLabels()} />
    </SlotShell>
  );
}

/** Créative native — carte au gabarit éditorial dans le fil (AD-08, AD-16).
 * Carte serveur : la campagne affichée est la première du slot (priorité
 * maximale), pas de rotation temporisée pour ce format.
 * `enabled=false` : la carte disparaît (réglage ads.native). */
export async function AdNativeCard({
  code,
  campaigns,
  enabled = true,
}: {
  code: string;
  campaigns: AdCampaignMap;
  enabled?: boolean;
}) {
  if (!enabled) return null;
  const { translate } = await getTranslations();
  const campaign: PublicAdCampaign | undefined = campaigns[code]?.[0];
  if (!campaign) return null;

  return (
    <aside
      aria-label={`${translate("public.ad.label")} ${code}`}
      data-ad-slot={code}
      className="relative border border-rule bg-paper-alt p-4"
    >
      <p className="kicker text-[0.6rem] text-ink-faint">
        {translate("public.ad.label")} · {campaign.advertiser}
      </p>
      {campaign.mediaKind !== "video" && campaign.imageUrl ? (
        <img
          src={campaign.imageUrl}
          alt={campaign.alt}
          className="mt-2 h-28 w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : null}
      <p className="mt-2 font-serif text-base font-bold leading-snug">{campaign.name}</p>
      <a
        href={campaign.clickUrl}
        target="_blank"
        rel="sponsored nofollow noopener"
        className="mt-3 inline-block bg-brand-red px-3 py-1.5 text-xs font-bold text-white transition-colors duration-200 hover:bg-red-deep"
      >
        {translate("public.ad.cta")}
      </a>
    </aside>
  );
}

/** Contenu d'auto-promotion INFOSPRO (newsletter) — partagé par AdSelfPromo
 * (accueil) et par le repli AD-19 de AdBanner quand aucune campagne n'est
 * active sur ce code. */
async function AdSelfPromoContent() {
  const { translate } = await getTranslations();
  return (
    <div className="bg-ink p-5 text-paper">
      <p className="kicker text-red-bright">INFOSPRO</p>
      <p className="mt-2 font-serif text-lg font-bold leading-snug">{translate("public.newsletter.morningTitle")}</p>
      <p className="mt-1 text-xs leading-relaxed text-paper/70">{translate("public.newsletter.morningDesc")}</p>
      <a
        href="#newsletter"
        className="mt-3 inline-block bg-brand-red px-3 py-1.5 text-xs font-bold text-white transition-colors duration-200 hover:bg-red-deep"
      >
        {translate("public.newsletter.cta")}
      </a>
    </div>
  );
}

/** Auto-promotion INFOSPRO (AD-19) — newsletter. */
export async function AdSelfPromo() {
  const { translate } = await getTranslations();
  return (
    <SlotShell code="AD-19" label={translate("public.ad.label")} className="w-full">
      <AdSelfPromoContent />
    </SlotShell>
  );
}

/** Mécénat météo (AD-16) — mention discrète dans le bloc météo. */
export async function AdWeatherSponsor() {
  const { translate } = await getTranslations();
  return (
    <p className="text-end text-[0.65rem] uppercase tracking-[0.14em] text-ink-faint">
      {translate("public.ad.weatherSponsor")}
    </p>
  );
}
