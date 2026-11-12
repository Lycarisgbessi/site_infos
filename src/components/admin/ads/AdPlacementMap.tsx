"use client";

import { AD_SLOT_RENDER } from "../../../../prisma/seed-data/ads-newsletters";

/**
 * Carte visuelle des emplacements publicitaires — maquette fidèle et
 * LISIBLE du site : chaque zone AD-xx est dessinée à sa vraie place dans
 * la structure (topbar, header, menu, flash, colonne principale, colonne
 * latérale, footer) + une rangée « flottants » pour les surcouches.
 * Clic sur une zone = sélection dans le formulaire ; la zone choisie
 * s'illumine en rouge avec ses dimensions.
 *
 * SLOT_HINTS est la SOURCE UNIQUE DE VÉRITÉ sur les emplacements (usages
 * vérifiés dans src/app/page.tsx, article/[slug]/page.tsx, video, podcast,
 * layout.tsx et site-header.tsx) — AdsClient.tsx la réutilise pour le
 * sélecteur et les mentions d'aide : une seule vérité pour les deux vues.
 */

/** Vérité des emplacements — où la publicité est réellement affichée. */
export const SLOT_HINTS: Record<string, string> = {
  "AD-01": "À côté du logo, TOUTES les pages (billboard compact)",
  "AD-02": "Bandeau haut de l'accueil",
  "AD-03": "Pleine largeur sous la une (accueil)",
  "AD-04": "Pavé 300×250, colonne latérale (accueil + articles)",
  "AD-05": "Grande verticale 300×600, colonne latérale (accueil + articles)",
  "AD-06": "Pied des pages vidéo/podcast + encart latéral (toutes pages)",
  "AD-07": "Entre les rubriques (accueil)",
  "AD-08": "Carte sponsorisée dans le fil (accueil)",
  "AD-10": "En-tête des pages vidéo/podcast",
  "AD-11": "Popup coin bas-gauche + interstitiel d'ouverture",
  "AD-12": "Bandeau collant mobile (320×50)",
  "AD-13": "Dans le texte des articles — haut, milieu et bas (680×180)",
  "AD-14": "Bas de colonne principale (accueil)",
  "AD-15": "Pied de page, toutes les pages",
  "AD-16": "Carte sponsorisée dans le fil (accueil)",
  "AD-19": "Auto-promotion, colonne latérale (accueil)",
};

export const SLOT_RESERVED_HINT = "Réservé — non affiché actuellement";

export function slotHint(code: string): string {
  return SLOT_HINTS[code] ?? SLOT_RESERVED_HINT;
}

/** Dimensions nominales absentes de AD_SLOT_RENDER mais réelles au rendu. */
const SLOT_DIM_FALLBACK: Record<string, { w: number; h: number }> = {
  "AD-13": { w: 680, h: 180 }, // horizontal in-article (FORMAT_BY_SLOT ad-slot.tsx)
};

/** Dimensions nominales d'un emplacement (aperçu proportionné du formulaire). */
export function slotDims(code: string): { w: number; h: number } | null {
  const fallback = SLOT_DIM_FALLBACK[code];
  if (fallback) return fallback;
  const r = AD_SLOT_RENDER[code];
  return r?.width && r?.height ? { w: r.width, h: r.height } : null;
}

const dimsLabel = (code: string): string | null => {
  const d = slotDims(code);
  return d ? `${d.w}×${d.h}` : null;
};

/** Zone cliquable d'un emplacement publicitaire (définie hors rendu : stable). */
function Zone({
  code,
  label,
  h = 22,
  selected,
  onSelect,
}: {
  code: string;
  label: string;
  h?: number;
  selected?: string | null;
  onSelect?: (code: string) => void;
}) {
  const active = selected === code;
  const d = dimsLabel(code);
  const hint = slotHint(code);
  return (
    <button
      type="button"
      onClick={() => onSelect?.(code)}
      title={`${code} — ${hint}${d ? ` (${d} px)` : ""}`}
      aria-label={`${code} : ${hint}`}
      aria-pressed={active}
      style={{ minHeight: h }}
      className={`group flex w-full flex-col items-center justify-center gap-0.5 rounded-md border px-1.5 py-1 text-center transition-all duration-200 ${
        active
          ? "z-20 border-[#A4161A] bg-[#A4161A]/15 shadow-[0_0_0_2px_rgba(164,22,26,0.35)]"
          : "border-dashed border-rule-strong/60 bg-rule/20 hover:border-[#A4161A]/60 hover:bg-[#A4161A]/10"
      }`}
    >
      <span className={`text-[0.68rem] font-black leading-none ${active ? "text-[#A4161A]" : "text-ink"}`}>{code}</span>
      <span className={`text-[0.6rem] font-semibold leading-tight ${active ? "text-[#A4161A]" : "text-ink-faint group-hover:text-ink-soft"}`}>
        {label}
      </span>
      {d && <span className="text-[0.56rem] leading-none text-ink-faint/80">{d}</span>}
      <span className="sr-only">{hint}</span>
    </button>
  );
}

/** Bloc décoratif (structure du site, non cliquable). */
function Ghost({ text, h = 18, className = "" }: { text?: string; h?: number; className?: string }) {
  return (
    <div style={{ minHeight: h }} className={`flex items-center justify-center rounded-md bg-rule/25 px-2 text-[0.58rem] font-semibold uppercase tracking-wider text-ink-faint/70 ${className}`}>
      {text}
    </div>
  );
}

export function AdPlacementMap({
  selected,
  onSelect,
}: {
  selected?: string | null;
  onSelect?: (code: string) => void;
}) {
  return (
    <div className="w-full rounded-lg border border-rule bg-paper p-3">
      <p className="mb-2 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-ink-faint">
        Carte du site — cliquez un emplacement
      </p>

      {/* Maquette en pleine largeur du panneau */}
      <div className="w-full space-y-1.5 rounded-lg border border-rule bg-paper-alt p-2">

          {/* Topbar */}
          <Ghost text="Barre rouge — date · météo · horloges" h={16} />

          {/* Header : logo + AD-01 */}
          <div className="flex items-stretch gap-2">
            <div className="flex w-[38%] items-center justify-center rounded-md bg-ink/20 text-[0.6rem] font-black uppercase tracking-widest text-ink-faint">
              Logo INFOSPRO
            </div>
            <div className="flex-1">
              <Zone selected={selected} onSelect={onSelect} code="AD-01" label="À côté du logo — toutes pages" h={40} />
            </div>
          </div>

          {/* Menu */}
          <div className="rounded-md bg-ink px-3 py-2 text-center text-[0.6rem] font-bold uppercase tracking-[0.2em] text-white/80">
            Menu rubriques — noir, filet rouge
          </div>

          {/* Flash */}
          <div className="rounded-md bg-[#A4161A]/80 px-3 py-1 text-center text-[0.58rem] font-bold uppercase tracking-[0.2em] text-white/90">
            Flash info défilant
          </div>

          {/* AD-02 bandeau haut de l'accueil */}
          <Zone selected={selected} onSelect={onSelect} code="AD-02" label="Bandeau haut de l'accueil" h={34} />

          {/* Corps : 2 colonnes */}
          <div className="grid grid-cols-[1fr_32%] gap-2">
            {/* Colonne principale */}
            <div className="space-y-1.5">
              <Ghost text="À la une" h={54} />
              <Zone selected={selected} onSelect={onSelect} code="AD-03" label="Pleine largeur sous la une" h={34} />
              <Zone selected={selected} onSelect={onSelect} code="AD-07" label="Entre les rubriques" h={30} />
              <div className="grid grid-cols-2 gap-1.5">
                <Zone selected={selected} onSelect={onSelect} code="AD-08" label="Carte sponsorisée dans le fil" h={30} />
                <Zone selected={selected} onSelect={onSelect} code="AD-16" label="Carte sponsorisée dans le fil" h={30} />
              </div>
              <Ghost text="Rubriques · Interviews · Vidéos" h={44} />
              <Zone selected={selected} onSelect={onSelect} code="AD-14" label="Bas de colonne principale" h={28} />
            </div>

            {/* Colonne latérale */}
            <div className="space-y-1.5">
              <Ghost text="En continu ①" h={34} />
              <Zone selected={selected} onSelect={onSelect} code="AD-04" label="Pavé colonne latérale" h={30} />
              <Ghost text="En continu ②" h={30} />
              <Zone selected={selected} onSelect={onSelect} code="AD-05" label="Grande verticale colonne latérale" h={52} />
              <Ghost text="Plus lus" h={26} />
              <Zone selected={selected} onSelect={onSelect} code="AD-19" label="Auto-promo colonne latérale" h={26} />
              <Ghost text="Météo" h={22} />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-stretch gap-2">
            <div className="flex w-[55%] items-center justify-center rounded-md bg-ink/25 text-[0.58rem] font-semibold uppercase tracking-widest text-ink-faint">
              Pied de page
            </div>
            <div className="flex-1">
              <Zone selected={selected} onSelect={onSelect} code="AD-15" label="Pied de page — toutes pages" h={26} />
            </div>
          </div>
      </div>

      {/* Pages intérieures */}
      <p className="mt-3 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-ink-faint">Pages intérieures</p>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <Zone selected={selected} onSelect={onSelect} code="AD-13" label="Dans le texte des articles — haut, milieu, bas" h={36} />
        <Zone selected={selected} onSelect={onSelect} code="AD-10" label="En-tête des pages vidéo/podcast" h={36} />
        <Zone selected={selected} onSelect={onSelect} code="AD-06" label="Pied vidéo/podcast + encart latéral" h={30} />
        <Zone selected={selected} onSelect={onSelect} code="AD-09" label="Emplacement natif de réserve" h={30} />
      </div>

      {/* Flottants */}
      <p className="mt-3 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-ink-faint">Surcouches flottantes</p>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        <Zone selected={selected} onSelect={onSelect} code="AD-11" label="Popup coin bas-gauche + interstitiel" h={38} />
        <Zone selected={selected} onSelect={onSelect} code="AD-12" label="Bandeau collant mobile" h={38} />
        <Zone selected={selected} onSelect={onSelect} code="AD-17" label="Réserve — écran large" h={38} />
      </div>

      {/* Légende sélection */}
      {selected && (
        <div className="mt-3 rounded-md border border-[#A4161A]/30 bg-[#A4161A]/5 p-3">
          <p className="text-sm font-black leading-snug text-[#A4161A]">
            {selected} — {slotHint(selected)}
            {dimsLabel(selected) ? ` · ${dimsLabel(selected)} px` : ""}
          </p>
        </div>
      )}
    </div>
  );
}
