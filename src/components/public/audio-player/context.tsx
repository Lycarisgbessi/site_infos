"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

/**
 * Contexte global du lecteur audio flottant : la lecture persiste à travers
 * toute navigation (état monté dans le layout racine). La position de lecture
 * est mémorisée par piste et restituée à la reprise.
 */

export interface AudioTrack {
  url: string;
  title: string;
  mime?: string | null;
  /** URL d'aperçu intégré Google Drive — repli iframe si le flux direct échoue. */
  driveEmbedUrl?: string;
}

interface AudioPlayerContextValue {
  track: AudioTrack | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  volume: number;
  /** Lance (ou reprend) une piste dans la barre flottante. */
  play: (track: AudioTrack) => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  close: () => void;
  /** Notifié par la barre lors des mises à jour <audio> natives. */
  __report: (state: { isPlaying?: boolean; position?: number; duration?: number }) => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const [track, setTrack] = useState<AudioTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);

  // Positions mémorisées par URL de piste (reprise de lecture).
  const positionsRef = useRef<Record<string, number>>({});
  const trackRef = useRef<AudioTrack | null>(null);

  const play = useCallback((next: AudioTrack) => {
    if (trackRef.current && trackRef.current.url !== next.url) {
      positionsRef.current[trackRef.current.url] = position;
    }
    trackRef.current = next;
    setTrack(next);
    const saved = positionsRef.current[next.url] ?? 0;
    setPosition(saved < (duration || Infinity) - 2 ? saved : 0);
    setIsPlaying(true);
  }, [position, duration]);

  const toggle = useCallback(() => setIsPlaying((p) => !p), []);
  const seek = useCallback((seconds: number) => setPosition(seconds), []);
  const setVolume = useCallback((v: number) => setVolumeState(v), []);
  const close = useCallback(() => {
    if (trackRef.current) positionsRef.current[trackRef.current.url] = position;
    trackRef.current = null;
    setTrack(null);
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
  }, [position]);

  const __report = useCallback((state: { isPlaying?: boolean; position?: number; duration?: number }) => {
    if (state.isPlaying !== undefined) setIsPlaying(state.isPlaying);
    if (state.position !== undefined) setPosition(state.position);
    if (state.duration !== undefined && !Number.isNaN(state.duration)) setDuration(state.duration);
  }, []);

  const value = useMemo(
    () => ({ track, isPlaying, position, duration, volume, play, toggle, seek, setVolume, close, __report }),
    [track, isPlaying, position, duration, volume, play, toggle, seek, setVolume, close, __report],
  );

  return <AudioPlayerContext.Provider value={value}>{children}</AudioPlayerContext.Provider>;
}

export function useAudioPlayer(): AudioPlayerContextValue {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error("useAudioPlayer doit être utilisé dans <AudioPlayerProvider>");
  return ctx;
}
