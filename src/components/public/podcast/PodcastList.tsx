"use client";

import { useState } from "react";
import { useAudioPlayer } from "@/components/public/audio-player/context";
import { parseDriveId, parseYouTubeId } from "@/lib/drive";
import { cn } from "@/lib/utils";

/**
 * Liste publique des saisons du podcast (/podcast) — accordéons élégants
 * (première saison ouverte par défaut), épisodes numérotés avec titre,
 * durée, date et bouton de lecture dans la barre audio flottante persistante.
 *
 * Épisodes vidéo (mediaKind = "video") : pas de barre flottante — un bouton
 * « Voir » déplie un lecteur 16:9 intégré sous la ligne de l'épisode
 * (iframe youtube-nocookie, aperçu Google Drive ou <video> mp4 direct).
 * Un seul lecteur ouvert à la fois (l'ouverture replie le précédent).
 */

export interface PublicEpisode {
  id: string;
  title: string;
  description: string | null;
  audioUrl: string;
  /** ID du fichier Google Drive conservé en base (null si audio externe). */
  driveFileId?: string | null;
  /** "audio" (défaut) ou "video" — une vidéo se lit dans la page. */
  mediaKind?: "audio" | "video";
  /** URL vidéo (YouTube watch / aperçu Drive / .mp4) — null pour l'audio. */
  videoUrl?: string | null;
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
  /** Libellé « Vidéo » (badge des épisodes vidéo). */
  video: string;
  /** Libellé du bouton de lecture vidéo (« Voir »). */
  watch: string;
  /** Libellé « Audio » (badge des épisodes audio). */
  audio: string;
  /** Gabarit avec {count} — les fonctions ne sont pas sérialisables en props client. */
  episodesCount: string;
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

/** Paramètre `id` d'une URL de flux Drive (uc?export=download&id=…). */
function driveIdFromUrlParam(url: string): string | null {
  try {
    const id = new URL(url).searchParams.get("id");
    return id && /^[A-Za-z0-9_-]{20,}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/**
 * URL d'aperçu intégré Drive (repli iframe du lecteur) pour un épisode.
 * Priorité à l'ID stocké en base ; sinon extraction depuis l'URL via
 * parseDriveId (liens /file/d/, open?id=, ID brut) puis le paramètre `id`
 * (l'URL de flux `uc?export=download&id=…` n'est pas couverte par parseDriveId).
 */
function driveEmbedUrlFor(audioUrl: string, driveFileId: string | null | undefined): string | undefined {
  const stored = driveFileId?.trim();
  const id = stored ? stored : (parseDriveId(audioUrl) ?? driveIdFromUrlParam(audioUrl));
  return id ? `https://drive.google.com/file/d/${id}/preview` : undefined;
}

// ─── Épisodes vidéo : source du lecteur intégré ─────────────────────────

type VideoSource =
  | { kind: "youtube"; id: string }
  | { kind: "drive"; id: string }
  | { kind: "direct"; url: string };

/**
 * Détermine le lecteur à intégrer d'après l'URL vidéo stockée :
 * YouTube (watch/youtu.be/embed/shorts, ID réextrait au rendu), aperçu
 * Google Drive (`/file/d/{ID}/preview`, y compris repli par paramètre
 * d'URL) ou fichier direct (.mp4).
 */
function videoSourceFor(videoUrl: string): VideoSource {
  const youTubeId = parseYouTubeId(videoUrl);
  if (youTubeId) return { kind: "youtube", id: youTubeId };
  const driveId = parseDriveId(videoUrl) ?? driveIdFromUrlParam(videoUrl);
  if (driveId) return { kind: "drive", id: driveId };
  return { kind: "direct", url: videoUrl };
}

/** Lecteur 16:9 intégré : iframe youtube-nocookie / Drive, ou <video> mp4. */
function VideoPlayer({ source, title }: { source: VideoSource; title: string }) {
  if (source.kind === "youtube") {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${source.id}?autoplay=1&rel=0`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="absolute inset-0 h-full w-full border-0"
      />
    );
  }
  if (source.kind === "drive") {
    return (
      <iframe
        src={`https://drive.google.com/file/d/${source.id}/preview`}
        title={title}
        allow="autoplay; encrypted-media"
        allowFullScreen
        className="absolute inset-0 h-full w-full border-0"
      />
    );
  }
  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption -- sous-titres gérés par la source distante
    <video
      src={source.url}
      controls
      autoPlay
      muted
      playsInline
      className="absolute inset-0 h-full w-full"
    />
  );
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
  // Un seul lecteur vidéo déplié à la fois (null = tous repliés).
  const [openVideoId, setOpenVideoId] = useState<string | null>(null);

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const playEpisode = (episode: PublicEpisode) => {
    play({
      url: episode.audioUrl,
      title: episode.title,
      driveEmbedUrl: driveEmbedUrlFor(episode.audioUrl, episode.driveFileId),
    });
  };

  /** Déplie/replie le lecteur vidéo d'un épisode (replie le précédent). */
  const toggleVideo = (episodeId: string) =>
    setOpenVideoId((prev) => (prev === episodeId ? null : episodeId));

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
                  {labels.episodesCount.replace("{count}", String(season.episodes.length))}
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
                  const isVideo = episode.mediaKind === "video";
                  const isCurrent = !isVideo && track?.url === episode.audioUrl;
                  const isVideoOpen = isVideo && openVideoId === episode.id;
                  return (
                    <li
                      key={episode.id}
                      className={cn(
                        "border-b border-rule last:border-0",
                        (isCurrent || isVideoOpen) && "bg-red-wash/40",
                      )}
                    >
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
                            <span aria-hidden>·</span>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 font-semibold uppercase tracking-wide",
                                isVideo ? "text-red-deep" : "text-ink-faint",
                              )}
                            >
                              <span aria-hidden>{isVideo ? "🎬" : "🎧"}</span>
                              {isVideo ? labels.video : labels.audio}
                            </span>
                          </p>
                        </div>
                        {isVideo ? (
                          <button
                            type="button"
                            onClick={() => toggleVideo(episode.id)}
                            aria-expanded={isVideoOpen}
                            aria-controls={`video-player-${episode.id}`}
                            aria-label={`${labels.watch} : ${episode.title}`}
                            className={cn(
                              "flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-brand-red px-4 text-sm font-semibold text-white transition-transform duration-200 hover:scale-105",
                              isVideoOpen && "bg-ink",
                            )}
                          >
                            <svg aria-hidden viewBox="0 0 16 16" className="ms-0.5 size-4 fill-current">
                              <path d="M4 2l9 6-9 6z" />
                            </svg>
                            {labels.watch}
                          </button>
                        ) : (
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
                        )}
                      </div>

                      {/* Lecteur vidéo 16:9 intégré — jamais la barre flottante */}
                      {isVideoOpen && episode.videoUrl && (
                        <div id={`video-player-${episode.id}`} className="border-t border-rule bg-paper-alt/50 p-3">
                          <div className="relative mx-auto aspect-video w-full max-w-2xl overflow-hidden bg-ink">
                            <VideoPlayer
                              source={videoSourceFor(episode.videoUrl)}
                              title={episode.title}
                            />
                          </div>
                        </div>
                      )}
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
