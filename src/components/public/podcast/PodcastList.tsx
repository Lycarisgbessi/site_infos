"use client";

import { useState } from "react";
import { useAudioPlayer } from "@/components/public/audio-player/context";
import { cn } from "@/lib/utils";

/**
 * Liste publique des saisons du podcast (/podcast) — accordéons élégants
 * (première saison ouverte par défaut), épisodes numérotés avec titre,
 * durée, date et bouton de lecture dans la barre audio flottante persistante.
 */

export interface PublicEpisode {
  id: string;
  title: string;
  description: string | null;
  audioUrl: string;
  durationSec: number | null;
  coverUrl: string | null;
  publishedAt: string;
}

export interface PublicSeason {
  id: string;
  title: string;
  description: string | null;
  episodes: PublicEpisode[];
}

export interface PodcastLabels {
  episode: string;
  play: string;
  playing: string;
  noDuration: string;
  episodesCount: (n: number) => string;
}

function formatDuration(sec: number | null, fallback: string): string {
  if (!sec || sec <= 0) return fallback;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")}`;
  return `${m} min`;
}

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, { dateStyle: "long" });
}

export function PodcastList({
  seasons,
  labels,
  locale,
}: {
  seasons: PublicSeason[];
  labels: PodcastLabels;
  locale: string;
}) {
  const { play, track } = useAudioPlayer();
  const [open, setOpen] = useState<Set<string>>(() => new Set(seasons[0] ? [seasons[0].id] : []));

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const playEpisode = (episode: PublicEpisode) => {
    play({ url: episode.audioUrl, title: episode.title });
  };

  return (
    <div className="mt-8 space-y-4">
      {seasons.map((season, index) => {
        const isOpen = open.has(season.id);
        return (
          <section key={season.id} aria-label={season.title} className="border border-rule bg-paper">
            <button
              type="button"
              onClick={() => toggle(season.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-3 p-4 text-start transition-colors duration-200 hover:bg-paper-alt/60"
            >
              <span className="font-mono text-xs text-ink-faint">{String(index + 1).padStart(2, "0")}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-serif text-lg font-bold tracking-tight text-ink">{season.title}</span>
                {season.description && (
                  <span className="mt-0.5 line-clamp-2 block text-sm text-ink-soft">{season.description}</span>
                )}
                <span className="mt-1 block text-xs uppercase tracking-widest text-ink-faint">
                  {labels.episodesCount(season.episodes.length)}
                </span>
              </span>
              <svg
                aria-hidden
                viewBox="0 0 16 16"
                className={cn("size-4 shrink-0 text-ink-faint transition-transform duration-300", isOpen && "rotate-180")}
              >
                <path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {isOpen && (
              <ul className="border-t border-rule">
                {season.episodes.map((episode, epIndex) => {
                  const isCurrent = track?.url === episode.audioUrl;
                  return (
                    <li key={episode.id} className={cn("border-b border-rule last:border-0", isCurrent && "bg-red-wash/40")}>
                      <div className="flex items-start gap-3 p-4">
                        {episode.coverUrl ? (
                          <img src={episode.coverUrl} alt="" className="hidden size-14 shrink-0 border border-rule object-cover sm:block" loading="lazy" />
                        ) : (
                          <span className="hidden size-14 shrink-0 items-center justify-center border border-rule bg-paper-alt font-mono text-sm text-ink-faint sm:flex">
                            {String(epIndex + 1).padStart(2, "0")}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-serif text-base font-bold leading-snug text-ink">
                            <span className="mr-1.5 font-mono text-xs font-normal text-brand-red">É{epIndex + 1}</span>
                            {episode.title}
                          </p>
                          {episode.description && (
                            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-soft">{episode.description}</p>
                          )}
                          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-faint">
                            <span>{formatDate(episode.publishedAt, locale)}</span>
                            <span aria-hidden>·</span>
                            <span>{formatDuration(episode.durationSec, labels.noDuration)}</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => playEpisode(episode)}
                          aria-label={`${isCurrent ? labels.playing : labels.play} : ${episode.title}`}
                          className={cn(
                            "flex size-11 shrink-0 items-center justify-center rounded-full transition-transform duration-200 hover:scale-105",
                            isCurrent ? "bg-ink text-white" : "bg-brand-red text-white",
                          )}
                        >
                          <svg aria-hidden viewBox="0 0 16 16" className="ms-0.5 size-4 fill-current">
                            <path d="M4 2l9 6-9 6z" />
                          </svg>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
