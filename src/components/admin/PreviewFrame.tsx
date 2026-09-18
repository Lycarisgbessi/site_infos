"use client";

import { useState } from "react";

/**
 * Cadre de prévisualisation fidèle (§11.1) — 3 tailles d'écran.
 * Le contenu est rendu côté serveur ; ce client ne fait que choisir
 * la largeur simulée (desktop 1280 / tablette 768 / mobile 375).
 */

const SIZES = [
  { key: "desktop", label: "Bureau", width: 1280 },
  { key: "tablet", label: "Tablette", width: 768 },
  { key: "mobile", label: "Mobile", width: 375 },
] as const;

export function PreviewFrame({ children }: { children: React.ReactNode }) {
  const [size, setSize] = useState<(typeof SIZES)[number]["key"]>("desktop");
  const current = SIZES.find((s) => s.key === size) ?? SIZES[0];

  return (
    <div className="min-h-screen bg-ink/5">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-rule bg-paper px-4 py-2">
        <span className="kicker mr-2">Aperçu</span>
        {SIZES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSize(s.key)}
            aria-pressed={size === s.key}
            className={`rounded-sm px-3 py-1.5 text-xs font-semibold transition-colors ${
              size === s.key ? "bg-brand-red text-white" : "bg-paper-alt text-ink-soft hover:bg-rule"
            }`}
          >
            {s.label} · {s.width}px
          </button>
        ))}
        <span className="ml-auto text-xs text-ink-faint">État brouillon — non publié</span>
      </div>
      <div className="mx-auto py-6" style={{ maxWidth: current.width }}>
        <div className="mx-4 bg-paper shadow-sm ring-1 ring-rule">{children}</div>
      </div>
    </div>
  );
}
