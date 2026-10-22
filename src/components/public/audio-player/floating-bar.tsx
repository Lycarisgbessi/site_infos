"use client";

import { useEffect, useRef, useState } from "react";
import { useAudioPlayer } from "./context";
import { cn } from "@/lib/utils";

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
 *
 * Sources Google Drive : l'URL de flux (`uc?export=download`) redirige (302)
 * vers une URL signée — le <audio> direct échoue souvent (CORS/redirect).
 * Sur erreur (ou refus de play()), repli propre sur l'aperçu intégré Drive :
 * un petit panneau repliable (≤320px) s'affiche AU-DESSUS de la barre, qui
 * continue de montrer titre et état de la piste.
 */
export function AudioFloatingBar({ labels }: { labels: { play: string; pause: string; close: string } }) {
  const { track, isPlaying, position, duration, volume, toggle, seek, setVolume, close, __report } = useAudioPlayer();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastUrlRef = useRef<string>("");
  // Flux direct refusé : mémorisé par URL de piste (réinitialisé au changement).
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  // Panneau d'aperçu Drive repliable (ouvert par défaut au premier échec).
  const [panelOpen, setPanelOpen] = useState(true);

  const streamFailed = track !== null && failedUrl !== null && failedUrl === track.url;

  // Nouvelle piste : ré-ouvre le panneau d'aperçu.
  useEffect(() => setPanelOpen(true), [track?.url]);

  // Changement de piste : (re)charge la source et reprend à la position mémorisée.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    // Flux direct indisponible pour cette piste : lecture via l'aperçu Drive,
    // on n'insiste pas sur la source native.
    if (streamFailed) {
      audio.pause();
      return;
    }
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
    if (isPlaying) {
      void audio.play().catch((err: unknown) => {
        // AbortError = simple course entre pause/lecture, pas un échec de flux.
        if ((err as { name?: string } | null)?.name === "AbortError") return;
        __report({ isPlaying: false });
        if (track.driveEmbedUrl) setFailedUrl(track.url);
      });
    } else audio.pause();
  }, [track, isPlaying, position, streamFailed, __report]);

  // Volume contrôlé par la barre.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume, track]);

  if (!track) return null;

  const embedUrl = streamFailed ? track.driveEmbedUrl : undefined;

  return (
    <div
      role="region"
      aria-label={track.title}
      className="animate-slide-in-up fixed inset-x-0 bottom-0 z-50 border-t border-rule bg-ink/97 text-paper shadow-[0_-4px_16px_rgba(0,0,0,0.25)] backdrop-blur supports-[backdrop-filter]:bg-ink/92"
    >
      <audio
        ref={audioRef}
        preload="metadata"
        onPlay={() => __report({ isPlaying: true })}
        onPause={() => __report({ isPlaying: false })}
        onEnded={() => __report({ isPlaying: false, position: 0 })}
        onTimeUpdate={(e) => __report({ position: e.currentTarget.currentTime })}
        onDurationChange={(e) => __report({ duration: e.currentTarget.duration })}
        onError={() => {
          if (track.driveEmbedUrl) setFailedUrl(track.url);
        }}
        className="hidden"
      />

      {/* ── Panneau repliable d'aperçu Drive (hauteur totale ≤320px) ── */}
      {embedUrl && panelOpen && (
        <div className="border-b border-paper/15">
          <div className="container-page flex items-center gap-2 px-4 pt-2">
            <p className="min-w-0 flex-1 truncate text-[0.7rem] uppercase tracking-widest text-paper/60">
              Aperçu Google Drive · {track.title}
            </p>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              aria-label="Replier l'aperçu Google Drive"
              className="flex size-7 shrink-0 items-center justify-center text-paper/60 transition-colors duration-200 hover:text-paper"
            >
              <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 fill-none stroke-current" strokeWidth="1.8">
                <path d="M3 10l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <iframe
            src={embedUrl}
            title={track.title}
            allow="autoplay"
            loading="lazy"
            className="container-page mt-1 block h-[248px] w-full border-0 px-4 pb-3"
          />
        </div>
      )}

      {/* ── Barre : titre + état dans tous les modes ── */}
      <div className="container-page flex items-center gap-3 px-4 py-2.5">
        <button
          type="button"
          onClick={toggle}
          disabled={!!embedUrl}
          aria-label={isPlaying ? labels.pause : labels.play}
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-red text-sm text-white transition-colors duration-200 hover:bg-red-deep",
            embedUrl && "cursor-not-allowed opacity-40 hover:bg-brand-red",
          )}
        >
          {isPlaying ? (
            <svg aria-hidden viewBox="0 0 16 16" className="size-4 fill-current"><rect x="3" y="2" width="3.5" height="12" /><rect x="9.5" y="2" width="3.5" height="12" /></svg>
          ) : (
            <svg aria-hidden viewBox="0 0 16 16" className="ms-0.5 size-4 fill-current"><path d="M4 2l9 6-9 6z" /></svg>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-sm font-bold">{track.title}</p>
          {embedUrl ? (
            <p className="mt-1 truncate text-[0.7rem] text-paper/60">
              Lecture directe indisponible — lecture via l'aperçu Google Drive
            </p>
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <span className="w-9 shrink-0 text-end font-mono text-[0.65rem] text-paper/60">{formatTime(position)}</span>
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
          )}
        </div>

        {embedUrl ? (
          <button
            type="button"
            onClick={() => setPanelOpen((p) => !p)}
            aria-label={panelOpen ? "Replier l'aperçu Google Drive" : "Déplier l'aperçu Google Drive"}
            className="flex size-8 shrink-0 items-center justify-center text-paper/60 transition-colors duration-200 hover:text-paper"
          >
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className={cn("size-3.5 fill-none stroke-current transition-transform duration-300", !panelOpen && "rotate-180")}
              strokeWidth="1.8"
            >
              <path d="M3 6l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
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
        )}

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
