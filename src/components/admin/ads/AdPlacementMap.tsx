"use client";

import { AD_SLOT_RENDER } from "../../../../prisma/seed-data/ads-newsletters";

/**
 * Carte visuelle des emplacements publicitaires — maquette fidèle et
 * LISIBLE du site : chaque zone AD-xx est dessinée à sa vraie place dans
 * la structure (topbar, header, menu, flash, colonne principale, colonne
 * latérale, footer) + une rangée « flottants » pour les surcouches.
 * Clic sur une zone = sélection dans le formulaire ; la zone choisie
 * s'illumine en rouge avec ses dimensions.
 */

const dims = (code: string): string | null => {
  const r = AD_SLOT_RENDER[code];
  return r?.width && r?.height ? `${r.width}×${r.height}` : null;
};

interface ZoneDef {
  code: string;
  label: string;
  hint: string;
}

export function AdPlacementMap({
  selected,
  onSelect,
}: {
  selected?: string | null;
  onSelect?: (code: string) => void;
}) {
  const Zone = ({ code, label, hint, h = 22 }: { code: string; label: string; hint: string; h?: number }) => {
    const active = selected === code;
    const d = dims(code);
    return (
      <button
        type="button"
        onClick={() => onSelect?.(code)}
        title={`${code} — ${label}${d ? ` (${d} px)` : ""}`}
        aria-label={`${code} : ${label}`}
        aria-pressed={active}
        style={{ minHeight: h }}
        className={`group flex w-full flex-col items-center justify-center gap-0.5 rounded-md border px-1.5 py-1 text-center transition-all duration-200 ${
          active
            ? "z-20 border-[#A4161A] bg-[#A4161A]/15 shadow-[0_0_0_2px_rgba(164,22,26,0.35)]"
            : "border-dashed border-rule-strong/60 bg-rule/20 hover:border-[#A4161A]/60 hover:bg-[#A4161A]/10"
        }`}
      >
        <span className={`text-[0.62rem] font-black leading-none ${active ? "text-[#A4161A]" : "text-ink"}`}>{code}</span>
        <span className={`text-[0.52rem] font-semibold leading-tight ${active ? "text-[#A4161A]" : "text-ink-faint group-hover:text-ink-soft"}`}>
          {label}
        </span>
        {d && <span className="text-[0.48rem] leading-none text-ink-faint/80">{d}</span>}
        <span className="sr-only">{hint}</span>
      </button>
    );
  };

  const Ghost = ({ text, h = 18, className = "" }: { text?: string; h?: number; className?: string }) => (
    <div style={{ minHeight: h }} className={`flex items-center justify-center rounded-md bg-rule/25 px-2 text-[0.52rem] font-semibold uppercase tracking-wider text-ink-faint/70 ${className}`}>
      {text}
    </div>
  );

  return (
    <div className="rounded-lg border border-rule bg-paper p-3">
      <p className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-ink-faint">
        Carte du site — cliquez un emplacement
      </p>

      <div className="scrollbar-none overflow-x-auto">
        <div className="min-w-[430px] space-y-1.5 rounded-lg border border-rule bg-paper-alt p-2">

          {/* Topbar */}
          <Ghost text="Barre rouge — date · météo · horloges" h={16} />

          {/* Header : logo + AD-01 */}
          <div className="flex items-stretch gap-2">
            <div className="flex w-[38%] items-center justify-center rounded-md bg-ink/20 text-[0.55rem] font-black uppercase tracking-widest text-ink-faint">
              Logo INFOSPRO
            </div>
            <div className="flex-1">
              <Zone code="AD-01" label="À côté du logo — toutes les pages" hint="Billboard, header" h={40} />
            </div>
          </div>

          {/* Menu */}
          <div className="rounded-md bg-ink px-3 py-2 text-center text-[0.55rem] font-bold uppercase tracking-[0.2em] text-white/80">
            Menu rubriques — noir, filet rouge
          </div>

          {/* Flash */}
          <div className="rounded-md bg-[#A4161A]/80 px-3 py-1 text-center text-[0.5rem] font-bold uppercase tracking-[0.2em] text-white/90">
            Flash info défilant
          </div>

          {/* AD-02 pleine largeur */}
          <Zone code="AD-02" label="Bandeau haut de l'accueil" hint="Leaderboard 970×90" h={34} />

          {/* Corps : 2 colonnes */}
          <div className="grid grid-cols-[1fr_150px] gap-2">
            {/* Colonne principale */}
            <div className="space-y-1.5">
              <Ghost text="À la une" h={54} />
              <Zone code="AD-03" label="Pleine largeur sous la une" hint="Billboard 970×250" h={34} />
              <div className="grid grid-cols-2 gap-1.5">
                <Zone code="AD-07" label="Entre rubriques" hint="Leaderboard 728×90" h={30} />
                <Zone code="AD-08" label="Carte sponsorisée" hint="Natif dans le fil" h={30} />
              </div>
              <Ghost text="Rubriques · Interviews · Vidéos" h={44} />
              <Zone code="AD-14" label="Bas de colonne" hint="Leaderboard 728×90" h={28} />
            </div>

            {/* Colonne latérale */}
            <div className="space-y-1.5">
              <Ghost text="En continu ①" h={34} />
              <Zone code="AD-04" label="Pavé latéral" hint="300×250" h={30} />
              <Ghost text="En continu ②" h={30} />
              <Zone code="AD-05" label="Grande verticale" hint="300×600" h={52} />
              <Ghost text="Plus lus" h={26} />
              <Zone code="AD-19" label="Auto-promo / régie" hint="Pavé maison" h={26} />
              <Zone code="AD-16" label="Sponsoring météo" hint="Natif" h={22} />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-stretch gap-2">
            <div className="flex w-[55%] items-center justify-center rounded-md bg-ink/25 text-[0.52rem] font-semibold uppercase tracking-widest text-ink-faint">
              Pied de page
            </div>
            <div className="flex-1">
              <Zone code="AD-15" label="Pied de page" hint="728×90" h={26} />
            </div>
          </div>
        </div>
      </div>

      {/* Pages intérieures */}
      <p className="mt-3 text-[0.62rem] font-bold uppercase tracking-[0.18em] text-ink-faint">Pages intérieures</p>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <Zone code="AD-13" label="DANS LES ARTICLES — haut, milieu et bas du texte (680×180)" hint="Horizontal" h={36} />
        <Zone code="AD-10" label="VIDÉOS / PODCAST — en-tête des pages (600×150)" hint="Leaderboard" h={36} />
        <Zone code="AD-06" label="Pied des pages vidéo/podcast + panneau latéral (300×250)" hint="Pavé" h={30} />
        <Zone code="AD-09" label="Emplacement natif de réserve" hint="Natif" h={30} />
      </div>

      {/* Flottants */}
      <p className="mt-3 text-[0.62rem] font-bold uppercase tracking-[0.18em] text-ink-faint">Surcouches flottantes</p>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        <Zone code="AD-11" label="Popup coin bas-gauche + interstitiel d'ouverture" hint="Plein écran / coin" h={38} />
        <Zone code="AD-12" label="Bandeau collant MOBILE (320×50) — s'efface devant le lecteur audio" hint="Mobile" h={38} />
        <Zone code="AD-17" label="Réserve —Suggestions latérales écran large" hint="Flottant" h={38} />
      </div>

      {/* Légende sélection */}
      {selected && (
        <div className="mt-3 rounded-md border border-[#A4161A]/30 bg-[#A4161A]/5 p-3">
          <p className="text-sm font-black text-[#A4161A]">
            {selected} — format {AD_SLOT_RENDER[selected]?.format ?? "?"}
            {dims(selected) ? ` · ${dims(selected)} px` : ""}
          </p>
        </div>
      )}
    </div>
  );
}
