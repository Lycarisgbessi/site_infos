import { getTranslations } from "@/lib/i18n";

/**
 * Emplacements publicitaires du front-office (§13.1, slots AD-01→AD-19).
 * Composants SERVEUR. Créatives de démonstration professionnelles par
 * emplacement, marges compactes (jamais de grand vide autour d'une pub).
 * Task ID: 9-ADS
 */

type AdFormat = "leaderboard" | "billboard" | "pave" | "halfpage" | "native" | "footer" | "promo";

const FORMAT_BY_SLOT: Record<string, AdFormat> = {
  "AD-01": "billboard",
  "AD-02": "leaderboard",
  "AD-03": "billboard",
  "AD-04": "pave",
  "AD-05": "halfpage",
  "AD-06": "pave",
  "AD-07": "leaderboard",
  "AD-08": "native",
  "AD-14": "leaderboard",
  "AD-15": "footer",
  "AD-16": "native",
  "AD-19": "promo",
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
      <span className="absolute -top-2 right-2 bg-paper px-1.5 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-ink-faint">
        {label}
      </span>
      {children}
    </aside>
  );
}

function DemoCreative({
  code,
  format,
  title,
  text,
  cta,
  dark = false,
}: {
  code: string;
  format: AdFormat;
  title: string;
  text: string;
  cta: string;
  dark?: boolean;
}) {
  return (
    <div
      className={`flex h-full w-full items-center justify-between gap-4 px-5 ${
        dark ? "bg-ink text-paper" : "bg-paper-alt text-ink"
      }`}
    >
      <div className="flex min-w-0 items-center gap-4">
        <span
          aria-hidden
          className={`flex shrink-0 items-center justify-center rounded-sm bg-brand-red font-serif font-black text-white ${
            format === "native" ? "size-9 text-base" : "size-11 text-lg"
          }`}
        >
          iP
        </span>
        <div className="min-w-0">
          <p className={`truncate font-serif font-bold ${format === "native" ? "text-sm" : "text-base md:text-lg"}`}>
            {title}
          </p>
          <p className={`truncate text-ink-soft ${format === "native" ? "text-xs" : "text-xs md:text-sm"}`}>{text}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="hidden bg-brand-red px-3 py-1.5 text-xs font-bold text-white transition-colors duration-200 group-hover:bg-red-deep sm:inline-block">
          {cta}
        </span>
        <span className="font-mono text-[0.6rem] tracking-widest text-ink-faint">{code}</span>
      </div>
    </div>
  );
}

/** Bannière par emplacement — marges compactes. */
export async function AdBanner({ code, className = "" }: { code: string; className?: string }) {
  const { translate } = await getTranslations();
  const format = FORMAT_BY_SLOT[code] ?? "leaderboard";

  const heights: Record<AdFormat, string> = {
    leaderboard: "h-[90px]",
    billboard: "h-[140px] md:h-[180px]",
    pave: "h-[250px]",
    halfpage: "h-[400px]",
    native: "h-[110px]",
    footer: "h-[110px]",
    promo: "h-[200px]",
  };

  return (
    <SlotShell code={code} label={translate("public.ad.label")} className={`w-full ${heights[format]} ${className}`}>
      <DemoCreative
        code={code}
        format={format}
        title={translate("public.ad.demoTitle")}
        text={translate("public.ad.demoText")}
        cta={translate("public.ad.demoCta")}
        dark={format === "billboard"}
      />
    </SlotShell>
  );
}

/** Créative native — carte dans le fil (AD-08, AD-16). */
export async function AdNativeCard({ code, sponsor }: { code: string; sponsor: string }) {
  const { translate } = await getTranslations();
  return (
    <aside
      aria-label={`${translate("public.ad.label")} ${code}`}
      data-ad-slot={code}
      className="relative border border-rule bg-paper-alt p-4"
    >
      <p className="kicker text-[0.6rem] text-ink-faint">
        {translate("public.ad.label")} · {sponsor}
      </p>
      <p className="mt-2 font-serif text-base font-bold leading-snug">{translate("public.ad.demoTitle")}</p>
      <p className="mt-1 text-sm text-ink-soft">{translate("public.ad.demoText")}</p>
      <span className="mt-3 inline-block bg-brand-red px-3 py-1.5 text-xs font-bold text-white transition-colors duration-200 hover:bg-red-deep">
        {translate("public.ad.demoCta")}
      </span>
    </aside>
  );
}

/** Auto-promotion INFOSPRO (AD-19) — newsletter. */
export async function AdSelfPromo() {
  const { translate } = await getTranslations();
  return (
    <SlotShell code="AD-19" label={translate("public.ad.label")} className="w-full">
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
    </SlotShell>
  );
}

/** Mécénat météo (AD-16) — mention discrète dans le bloc météo. */
export async function AdWeatherSponsor() {
  const { translate } = await getTranslations();
  return (
    <p className="text-right text-[0.65rem] uppercase tracking-[0.14em] text-ink-faint">
      {translate("public.ad.weatherSponsor")}
    </p>
  );
}
