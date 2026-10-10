"use client";

import { useAudioPlayer } from "./context";

/**
 * Bloc audio inline : lecteur natif dans l'article ET bouton « Écouter »
 * qui déclenche la lecture dans la barre flottante persistante.
 */
export function AudioInlineBlock({
  url,
  mime,
  title,
  listenLabel,
  nowPlayingLabel,
}: {
  url: string;
  mime?: string | null;
  title?: string;
  listenLabel: string;
  nowPlayingLabel: string;
}) {
  const { play, track, isPlaying } = useAudioPlayer();
  const isCurrent = track?.url === url && isPlaying;

  return (
    <figure className="my-8 border border-rule p-4">
      {title && <figcaption className="mb-2 text-sm font-semibold">{title}</figcaption>}
      <audio controls preload="metadata" className="w-full">
        <source src={url} type={mime ?? undefined} />
      </audio>
      <button
        type="button"
        onClick={() => !isCurrent && play({ url, title: title ?? nowPlayingLabel, mime })}
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
