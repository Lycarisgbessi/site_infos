import { getTranslations } from "@/lib/i18n";
import type { AdCampaignMap, PublicAdCampaign } from "@/lib/public/homepage-data";
import { AdRotation } from "@/components/public/ad-creative-client";

/**
 * Emplacements publicitaires du front-office (§13.1, slots AD-01→AD-19).
 * Composants SERVEUR. Depuis la rotation (2026-10) : chaque emplacement
 * reçoit TOUTES les campagnes actives de son slot et les fait tourner
 * (tirage pondéré par priorité côté client + rotation 30 s) via AdRotation ;
 * sans campagne active, l'emplacement n'affiche RIEN, sauf auto-promotion
 * maison (AdSelfPromo, AD-19).
 * Task ID: 9-ADS
 */

type AdFormat =
  | "leaderboard"
  | "billboard"
  | "pave"
  | "halfpage"
  | "native"
  | "footer"
  | "promo"
  | "sticky"
  | "video";

/** Format de rendu par emplacement — calqué sur AD_SLOT_RENDER du seed
 * (prisma/seed-data/ads-newsletters.ts) : tous les slots AD-01→AD-19 y
 * sont décrits pour être utilisables via AdBanner code="AD-xx". */
const FORMAT_BY_SLOT: Record<string, AdFormat> = {
  "AD-01": "billboard",
  "AD-02": "leaderboard",
  "AD-03": "billboard",
  "AD-04": "pave",
  "AD-05": "halfpage",
  "AD-06": "pave",
  "AD-07": "leaderboard",
  "AD-08": "native",
  "AD-09": "native",
  "AD-10": "leaderboard",
  "AD-11": "video",
  "AD-12": "sticky",
  "AD-13": "native",
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
  footer: "h-[110px]",
  promo: "h-[200px]",
  sticky: "h-[50px]",
  video: "h-[180px] md:h-[220px]",
};

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
      className={`group relative border border-rule bg-paper-alt ${className}`}
    >
      <span className="absolute -top-2 end-2 z-20 bg-paper px-1.5 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-ink-faint">
        {label}
      </span>
      {children}
    </aside>
  );
}

/** Bannière par emplacement — rotation pondérée des campagnes actives du
 * slot (voir AdRotation), sinon rien. Cas particulier AD-19 : sans
 * campagne active, l'emplacement bascule sur l'auto-promotion maison
 * (repli) au lieu de disparaître. */
export async function AdBanner({
  code,
  campaigns,
  className = "",
}: {
  code: string;
  campaigns: AdCampaignMap;
  className?: string;
}) {
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
    return null;
  }

  const format = FORMAT_BY_SLOT[code] ?? "leaderboard";
  return (
    <SlotShell
      code={code}
      label={translate("public.ad.label")}
      className={`w-full overflow-hidden ${HEIGHTS[format]} ${className}`}
    >
      <AdRotation campaigns={slotCampaigns} />
    </SlotShell>
  );
}

/** Créative native — carte au gabarit éditorial dans le fil (AD-08, AD-16).
 * Carte serveur : la campagne affichée est la première du slot (priorité
 * maximale), pas de rotation temporisée pour ce format. */
export async function AdNativeCard({ code, campaigns }: { code: string; campaigns: AdCampaignMap }) {
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
