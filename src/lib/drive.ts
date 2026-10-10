/**
 * Conversion des liens Google Drive en URL lisibles pour l'audio/la vidéo.
 *
 * Formats d'entrée acceptés :
 *  - https://drive.google.com/file/d/{ID}/view?usp=sharing
 *  - https://drive.google.com/open?id={ID}
 *  - https://docs.google.com/document/d/{ID}/...
 *  - {ID} brut (44 caractères alphanumériques)
 *
 * Sorties :
 *  - streamUrl  : URL de flux direct (lecture <audio>/<video> quand le serveur
 *                 Drive autorise la lecture progressive)
 *  - downloadUrl: URL de téléchargement direct
 *  - embedUrl   : URL d'aperçu intégré (iframe Google Drive Player)
 */

export interface DriveLink {
  id: string;
  streamUrl: string;
  downloadUrl: string;
  embedUrl: string;
}

const DRIVE_ID_RE =
  /(?:drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)|docs\.google\.com\/\w+\/d\/)([A-Za-z0-9_-]{20,})/;

export function parseDriveId(input: string): string | null {
  const trimmed = input.trim();
  const match = trimmed.match(DRIVE_ID_RE);
  if (match) return match[1];
  // ID brut
  if (/^[A-Za-z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

export function isDriveLink(input: string): boolean {
  return /drive\.google\.com|docs\.google\.com/.test(input) || parseDriveId(input) !== null;
}

/** Convertit un lien Drive (ou un ID) en URLs exploitables. Null si non reconnu. */
export function toDriveLink(input: string): DriveLink | null {
  const id = parseDriveId(input);
  if (!id) return null;
  return {
    id,
    streamUrl: `https://drive.google.com/uc?export=download&id=${id}`,
    downloadUrl: `https://drive.google.com/uc?export=download&id=${id}`,
    embedUrl: `https://drive.google.com/file/d/${id}/preview`,
  };
}

/**
 * Pour un bloc audio/vidéo : renvoie l'URL de lecture la plus adaptée.
 * Le flux direct `uc?export=download` fonctionne pour les fichiers partagés
 * publiquement ; sinon le lecteur doit utiliser l'iframe d'aperçu Drive.
 */
export function drivePlaybackUrl(input: string): string | null {
  return toDriveLink(input)?.streamUrl ?? null;
}
