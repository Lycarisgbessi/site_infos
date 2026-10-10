"use client";

import { useEffect, useRef } from "react";
import { useAudioPlayer } from "./context";

function formatTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/**
 * Barre audio flottante persistante — mini-lecteur fixé en bas d'écran :
 * titre, play/pause, seek, durée, volume, fermeture. Survit à la navigation
 * car l'état vit dans <AudioPlayerProvider> (layout racine).
 */
export function AudioFloatingBar({ labels }: { labels: { play: string; pause: string; close: string } }) {
  const { track, isPlaying, position, duration, volume, toggle, seek, setVolume, close, __report } = useAudioPlayer();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastUrlRef = useRef<string>("");

  // Changement de piste : (re)charge la source et reprend à la position mémorisée.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    if (lastUrlRef.current !== track.url) {
      lastUrlRef.current = track.url;
      audio.src = track.url;
      audio.load();
      if (position > 0) {
        const onLoaded = () => {
          audio.currentTime = position;
          audio.removeEventListener("loadedmetadata", onLoaded);
        };
        audio.addEventListener("loadedmetadata", onLoaded);
      }
    }
    if (isPlaying) void audio.play().catch(() => __report({ isPlaying: false }));
    else audio.pause();
  }, [track, isPlaying, position, __report]);

  // Volume contrôlé par la barre.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume, track]);

  if (!track) return null;

  return (
    <div
      role="region"
      aria-label={track.title}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-rule bg-ink/97 text-paper shadow-[0_-4px_16px_rgba(0,0,0,0.25)] backdrop-blur supports-[backdrop-filter]:bg-ink/92"
    >
      <audio
        ref={audioRef}
        preload="metadata"
        onPlay={() => __report({ isPlaying: true })}
        onPause={() => __report({ isPlaying: false })}
        onEnded={() => __report({ isPlaying: false, position: 0 })}
        onTimeUpdate={(e) => __report({ position: e.currentTarget.currentTime })}
        onDurationChange={(e) => __report({ duration: e.currentTarget.duration })}
        className="hidden"
      />
      <div className="container-page flex items-center gap-3 px-4 py-2.5">
        <button
          type="button"
          onClick={toggle}
          aria-label={isPlaying ? labels.pause : labels.play}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-red text-sm text-white transition-colors duration-200 hover:bg-red-deep"
        >
          {isPlaying ? (
            <svg aria-hidden viewBox="0 0 16 16" className="size-4 fill-current"><rect x="3" y="2" width="3.5" height="12" /><rect x="9.5" y="2" width="3.5" height="12" /></svg>
          ) : (
            <svg aria-hidden viewBox="0 0 16 16" className="ml-0.5 size-4 fill-current"><path d="M4 2l9 6-9 6z" /></svg>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-sm font-bold">{track.title}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="w-9 shrink-0 text-right font-mono text-[0.65rem] text-paper/60">{formatTime(position)}</span>
            <input
              type="range"
              min={0}
              max={Math.max(duration, 0.1)}
              step={0.1}
              value={Math.min(position, duration || 0)}
              onChange={(e) => {
                const t = Number(e.target.value);
                seek(t);
                if (audioRef.current) audioRef.current.currentTime = t;
              }}
              aria-label="Position de lecture"
              className="h-1 min-w-0 flex-1 cursor-pointer accent-[var(--brand-red,#C8102E)]"
            />
            <span className="w-9 shrink-0 font-mono text-[0.65rem] text-paper/60">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 fill-paper/60">
            <path d="M8 2L4.5 5H2v6h2.5L8 14zM10.5 5.5a3.5 3.5 0 010 5M12 3.5a6 6 0 010 9" stroke="currentColor" strokeWidth="1.2" fill="none" />
          </svg>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            aria-label="Volume"
            className="h-1 w-20 cursor-pointer accent-[var(--brand-red,#C8102E)]"
          />
        </div>

        <button
          type="button"
          onClick={close}
          aria-label={labels.close}
          className="flex size-8 shrink-0 items-center justify-center text-paper/60 transition-colors duration-200 hover:text-paper"
        >
          <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 fill-none stroke-current" strokeWidth="1.8">
            <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
