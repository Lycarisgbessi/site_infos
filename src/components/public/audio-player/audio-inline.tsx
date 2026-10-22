"use client";

import { useEffect, useState } from "react";
import { useAudioPlayer } from "./context";

/**
 * Bloc audio inline : lecteur natif dans l'article ET bouton « Écouter »
 * qui déclenche la lecture dans la barre flottante persistante.
 * `driveEmbedUrl` : pour une source Google Drive — si le flux direct est
 * refusé (erreur <audio>), on bascule sur l'aperçu intégré Drive (iframe).
 */
export function AudioInlineBlock({
  url,
  mime,
  title,
  listenLabel,
  nowPlayingLabel,
  driveEmbedUrl,
  unavailableLabel,
}: {
  url: string;
  mime?: string | null;
  title?: string;
  listenLabel: string;
  nowPlayingLabel: string;
  /** URL d'aperçu intégré Drive (https://drive.google.com/file/d/{id}/preview). */
  driveEmbedUrl?: string;
  /** Libellé affiché lorsque le flux direct échoue (repli Drive). */
  unavailableLabel?: string;
}) {
  const { play, track, isPlaying } = useAudioPlayer();
  const [streamFailed, setStreamFailed] = useState(false);
  // Nouvelle source : l'échec éventuel de la précédente ne s'applique plus.
  useEffect(() => setStreamFailed(false), [url]);
  const isCurrent = track?.url === url && isPlaying;
  const useDriveEmbed = streamFailed && driveEmbedUrl;

  return (
    <figure className="my-8 border border-rule p-4">
      {title && <figcaption className="mb-2 text-sm font-semibold">{title}</figcaption>}
      {useDriveEmbed ? (
        <>
          {unavailableLabel && <p className="mb-2 text-xs text-ink-faint">{unavailableLabel}</p>}
          <iframe
            src={driveEmbedUrl}
            title={title ?? "Lecteur audio"}
            allow="autoplay"
            loading="lazy"
            className="h-[90px] w-full border-0"
          />
        </>
      ) : (
        <audio
          controls
          preload="metadata"
          src={url}
          onError={() => driveEmbedUrl && setStreamFailed(true)}
          className="w-full"
        />
      )}
      <button
        type="button"
        onClick={() => !isCurrent && play({ url, title: title ?? nowPlayingLabel, mime, driveEmbedUrl })}
        aria-pressed={isCurrent}
        className={`mt-3 inline-flex h-9 items-center gap-2 px-3 text-xs font-bold uppercase tracking-widest text-white transition-colors duration-200 ${
          isCurrent ? "bg-red-deep" : "bg-brand-red hover:bg-red-deep"
        }`}
      >
        <span aria-hidden>{isCurrent ? "▮▮" : "▶"}</span>
        {isCurrent ? nowPlayingLabel : listenLabel}
      </button>
    </figure>
  );
}
