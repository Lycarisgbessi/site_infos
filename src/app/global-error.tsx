"use client";

/**
 * Boundary racine de dernier recours (rend <html>/<body> elle-même).
 * Ne se déclenche que si les boundaries segmentaires (error.tsx) échouent
 * elles-mêmes. Message minimal + rechargement ; un chunk périmé purge les
 * caches et recharge automatiquement une seule fois (chunk-recovery).
 */

import { useEffect } from "react";
import { isChunkError, recoverChunkError } from "@/lib/client/chunk-recovery";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[boundary globale]", error);
    if (isChunkError(error)) recoverChunkError();
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.25rem",
          background: "#faf8f5",
          color: "#111111",
          fontFamily: "system-ui, sans-serif",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.32em", color: "#A4161A", textTransform: "uppercase" }}>
          INFOSPRO.net
        </p>
        <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Une erreur critique est survenue</h1>
        <p style={{ maxWidth: "26rem", fontSize: "0.875rem", lineHeight: 1.6, color: "#555555" }}>
          L&apos;application n&apos;a pas pu démarrer. Rechargez la page — si le problème
          persiste, videz le cache du navigateur puis réessayez.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            background: "#A4161A",
            color: "#ffffff",
            border: "none",
            borderRadius: "999px",
            padding: "0.625rem 1.5rem",
            fontSize: "0.72rem",
            fontWeight: 800,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Réessayer
        </button>
      </body>
    </html>
  );
}
