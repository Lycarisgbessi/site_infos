"use client";

/**
 * Boundary d'erreur du back-office (§17 — résilience).
 * Un crash React côté client (chunk périmé après redéploiement, données
 * inattendues…) ne doit jamais laisser un écran mort sans explication :
 * message clair + « Réessayer ». Un chunk périmé purge les caches et
 * recharge automatiquement une seule fois (chunk-recovery).
 */

import { useEffect } from "react";
import { isChunkError, recoverChunkError } from "@/lib/client/chunk-recovery";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[boundary admin]", error);
    if (isChunkError(error)) recoverChunkError();
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-6 py-20 text-center">
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.32em] text-[#A4161A]">
        INFOSPRO — Back-office
      </p>
      <h1 className="max-w-xl font-serif text-2xl font-bold text-[--ink] sm:text-3xl">
        Une erreur est survenue
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-[--ink-soft]">
        La page n&apos;a pas pu se charger complètement. Cliquez sur « Réessayer » pour reprendre
        — vos modifications déjà sauvegardées sont conservées.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-[#A4161A] px-6 py-2.5 text-[0.72rem] font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-[#7e1013]"
        >
          Réessayer
        </button>
        <button
          type="button"
          // Navigation complète volontaire : sortie propre de l'éditeur.
          onClick={() => window.location.assign("/admin/articles")}
          className="rounded-full border border-[#A4161A]/40 px-6 py-2.5 text-[0.72rem] font-bold uppercase tracking-[0.18em] text-[#A4161A] transition-colors hover:bg-[#A4161A]/5"
        >
          Liste des articles
        </button>
      </div>
      {error.digest ? (
        <p className="mt-2 text-[0.65rem] tracking-wide text-[--ink-faint]">
          Référence : {error.digest}
        </p>
      ) : null}
    </div>
  );
}
