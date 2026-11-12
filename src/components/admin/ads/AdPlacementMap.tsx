"use client";

import { AD_SLOT_RENDER } from "../../../../prisma/seed-data/ads-newsletters";

/**
 * Carte visuelle des emplacements publicitaires — dessin simplifié du site
 * (vue « caricaturale ») où chaque zone AD-xx est représentée à sa place
 * réelle. La zone sélectionnée s'illumine en rouge avec ses dimensions ;
 * cliquer une zone la sélectionne dans le formulaire.
 */

interface ZoneInfo {
  code: string;
  label: string;
  /** Position sur la carte (grille CSS libre en %). */
  style: React.CSSProperties;
  page: string;
}

const ZONES: ZoneInfo[] = [
  { code: "AD-01", label: "À côté du logo (toutes pages)", style: { top: 4, right: 3, width: 30, height: 8 }, page: "En-tête" },
  { code: "AD-02", label: "Bandeau haut de l'accueil", style: { top: 14, left: 12, width: 76, height: 6 }, page: "Accueil" },
  { code: "AD-03", label: "Pleine largeur sous la une", style: { top: 26, left: 6, width: 60, height: 9 }, page: "Accueil" },
  { code: "AD-07", label: "Entre les rubriques", style: { top: 40, left: 6, width: 44, height: 7 }, page: "Accueil" },
  { code: "AD-14", label: "Bas de la colonne principale", style: { top: 62, left: 6, width: 44, height: 7 }, page: "Accueil" },
  { code: "AD-04", label: "Colonne droite (entre « En continu »)", style: { top: 38, right: 6, width: 20, height: 14 }, page: "Accueil" },
  { code: "AD-05", label: "Colonne droite — grande verticale", style: { top: 55, right: 6, width: 20, height: 18 }, page: "Accueil" },
  { code: "AD-19", label: "Colonne droite — auto-promotion", style: { top: 76, right: 6, width: 20, height: 8 }, page: "Accueil" },
  { code: "AD-13", label: "Dans les articles (haut/milieu/bas)", style: { top: 36, left: 20, width: 36, height: 8 }, page: "Articles" },
  { code: "AD-10", label: "Pages Vidéos / Podcast", style: { top: 36, left: 62, width: 16, height: 8 }, page: "Vidéo/Podcast" },
  { code: "AD-06", label: "Pied des pages Vidéo/Podcast + panneau latéral", style: { top: 78, left: 40, width: 18, height: 7 }, page: "Vidéo/Podcast" },
  { code: "AD-15", label: "Pied de page", style: { top: 90, left: 6, width: 60, height: 5 }, page: "Toutes" },
  { code: "AD-11", label: "Popup coin bas-gauche + interstitiel", style: { bottom: 12, left: 3, width: 16, height: 10 }, page: "Toutes" },
  { code: "AD-12", label: "Bandeau collant mobile", style: { bottom: 2, left: 20, width: 40, height: 4 }, page: "Mobile" },
];

export function AdPlacementMap({
  selected,
  onSelect,
}: {
  selected?: string | null;
  onSelect?: (code: string) => void;
}) {
  const dims = (code: string) => {
    const r = AD_SLOT_RENDER[code];
    if (!r || !r.width || !r.height) return null;
    return `${r.width} × ${r.height} px`;
  };

  return (
    <div className="rounded-lg border border-rule bg-paper p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-faint">
        Carte des emplacements — cliquez une zone
      </p>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md border border-rule bg-paper-alt">
        {/* Structure caricaturale du site */}
        <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-[3%] py-[2%]">
          <div className="h-3 w-[22%] rounded-sm bg-ink/25" title="Logo" />
          <div className="h-2 w-[10%] rounded-sm bg-rule-strong/40" />
        </div>
        <div className="absolute left-[6%] right-[30%] top-[24%] h-[10%] rounded-sm border border-rule bg-paper" title="La une" />
        <div className="absolute left-[6%] top-[24%] h-full w-[58%] rounded-sm border border-rule/60 bg-gradient-to-b from-paper to-transparent opacity-70" style={{ height: "60%", top: "24%" }} />
        <div className="absolute right-[6%] top-[36%] w-[20%] space-y-[4%]">
          <div className="h-8 rounded-sm bg-rule/30" title="En continu" />
        </div>

        {/* Zones publicitaires */}
        {ZONES.map((z) => {
          const active = selected === z.code;
          return (
            <button
              key={z.code}
              type="button"
              onClick={() => onSelect?.(z.code)}
              title={`${z.code} — ${z.label}${dims(z.code) ? ` (${dims(z.code)})` : ""}`}
              aria-label={`Emplacement ${z.code} : ${z.label}`}
              className={`absolute flex items-center justify-center rounded-[3px] border text-[0.55rem] font-black transition-all duration-200 ${
                active
                  ? "z-20 scale-[1.12] border-[#A4161A] bg-[#A4161A]/25 text-[#A4161A] shadow-[0_0_0_2px_rgba(164,22,26,0.35),0_6px_16px_rgba(164,22,26,0.35)]"
                  : "z-10 border-dashed border-rule-strong/70 bg-rule/25 text-ink-faint hover:border-[#A4161A]/60 hover:bg-[#A4161A]/10 hover:text-[#A4161A]"
              }`}
              style={z.style}
            >
              {z.code}
            </button>
          );
        })}
      </div>

      {/* Légende de la zone sélectionnée */}
      {selected && (
        <div className="mt-3 rounded-md border border-[#A4161A]/30 bg-[#A4161A]/5 p-3">
          <p className="text-sm font-black text-[#A4161A]">{selected}</p>
          <p className="mt-0.5 text-sm font-semibold text-ink">
            {ZONES.find((z) => z.code === selected)?.label ?? "Emplacement"}
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            {(() => {
              const d = dims(selected);
              const z = ZONES.find((x) => x.code === selected);
              return `${z?.page ?? ""}${d ? ` · ${d}` : ""} · format ${AD_SLOT_RENDER[selected]?.format ?? "?"}`;
            })()}
          </p>
        </div>
      )}
    </div>
  );
}
