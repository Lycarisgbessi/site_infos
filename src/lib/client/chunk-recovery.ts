"use client";

/**
 * Récupération automatique d'un chunk JS périmé (§17 — résilience client).
 *
 * Après un redéploiement, les anciens /_next/static/*.js référencés par une
 * page encore ouverte (ou servie depuis le cache) n'existent plus côté
 * serveur : le chargement dynamique échoue (ChunkLoadError / "Failed to
 * fetch dynamically imported module") et, sans boundary, la page meurt en
 * silence. On purge alors les caches INFOSPRO du service worker et on
 * recharge UNE fois (garde anti-boucle de 15 s via sessionStorage).
 */

const KEY = "infospro.chunkRetryAt";
/** Fenêtre anti-boucle : un seul rechargement automatique par 15 s. */
const MAX_AGE_MS = 15_000;

const CHUNK_ERROR_PATTERN =
  /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|error dynamically imported module|Importing a module script failed|missing required error components/i;

export function isChunkError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return CHUNK_ERROR_PATTERN.test(message);
}

/**
 * Tente la récupération (purge caches + reload). Retourne true si le
 * rechargement a été déclenché (la page se démonte), false sinon.
 */
export function recoverChunkError(): boolean {
  try {
    const previous = Number(sessionStorage.getItem(KEY) ?? 0);
    if (previous && Date.now() - previous < MAX_AGE_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false; // sessionStorage indisponible : ne pas risquer une boucle
  }
  const purge =
    typeof caches !== "undefined"
      ? caches
          .keys()
          .then((keys) =>
            Promise.all(
              keys
                .filter((k) => k.startsWith("infospro-"))
                .map((k) => caches.delete(k))
            )
          )
          .catch(() => undefined)
      : Promise.resolve();
  purge.then(() => {
    window.location.reload();
  });
  return true;
}
