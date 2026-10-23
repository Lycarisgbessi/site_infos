"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Barre de progression fine (haut de page, rouge/orange animé) :
 * - changement de route : barre indéterminée le temps du rendu ;
 * - lecture : progression réelle du scroll (pourcentage de page lu).
 * Le site « réagit » en continu aux gestes du lecteur.
 */

export function ProgressBar() {
  const pathname = usePathname();
  const [navigating, setNavigating] = useState(false);
  const [progress, setProgress] = useState(0);
  const lastPath = useRef(pathname);

  // Navigation : flash de barre animée au changement de route
  useEffect(() => {
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;
    setNavigating(true);
    const timer = window.setTimeout(() => setNavigating(false), 650);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  // Lecture : progression du scroll
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return null;
  }

  return (
    <div
      aria-hidden
      className="progress-bar"
      style={{
        width: navigating ? "70%" : `${progress}%`,
        opacity: navigating || progress > 1 ? 1 : 0,
      }}
    />
  );
}
