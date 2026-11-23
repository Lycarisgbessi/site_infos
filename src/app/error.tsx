"use client";

/**
 * Boundary d'erreur des pages publiques (§17 — résilience).
 * Récupère les crashes React : message lisible en français + bouton
 * « Réessayer ». Un chunk périmé après redéploiement déclenche une purge
 * automatique des caches et un rechargement unique (chunk-recovery).
 */

import { useEffect } from "react";
import { isChunkError, recoverChunkError } from "@/lib/client/chunk-recovery";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[boundary public]", error);
    if (isChunkError(error)) recoverChunkError();
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-6 py-20 text-center">
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.32em] text-[#A4161A]">INFOSPRO.net</p>
      <h1 className="max-w-xl font-serif text-2xl font-bold text-[#111] sm:text-3xl">
        Cette page n&apos;a pas pu s&apos;afficher
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-[#444]">
        Une erreur inattendue est survenue. Si le problème persiste, rechargez la page — vos
        contenus publiés ne sont pas affectés.
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
          // Navigation complète volontaire : reset peut échouer si l'arbre
          // React lui-même est corrompu (boundary de dernier recours).
          onClick={() => window.location.assign("/")}
          className="rounded-full border border-[#A4161A]/40 px-6 py-2.5 text-[0.72rem] font-bold uppercase tracking-[0.18em] text-[#A4161A] transition-colors hover:bg-[#A4161A]/5"
        >
          Retour à l&apos;accueil
        </button>
      </div>
      {error.digest ? (
        <p className="mt-2 text-[0.65rem] tracking-wide text-[#999]">Référence : {error.digest}</p>
      ) : null}
    </div>
  );
}
