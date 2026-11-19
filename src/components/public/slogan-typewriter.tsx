"use client";

import { useEffect, useState } from "react";

/**
 * Slogan animé « Le réflex info en continu » — effet machine à écrire en
 * boucle (le texte se tape lettre par lettre, s'efface, se retape), avec
 * curseur clignotant : l'effet d'un GIF animé, mais net à toutes les
 * résolutions (texte réel, pas d'image). prefers-reduced-motion : texte
 * statique complet.
 */
export function SloganTypewriter({ text }: { text: string }) {
  const [len, setLen] = useState(0);
  const [phase, setPhase] = useState<"typing" | "holding" | "deleting">("typing");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setLen(text.length);
      return;
    }
    let timer: number;
    if (phase === "typing") {
      if (len < text.length) {
        timer = window.setTimeout(() => setLen(len + 1), 65);
      } else {
        timer = window.setTimeout(() => setPhase("holding"), 2600);
      }
    } else if (phase === "holding") {
      timer = window.setTimeout(() => setPhase("deleting"), 200);
    } else {
      if (len > 0) {
        timer = window.setTimeout(() => setLen(len - 1), 28);
      } else {
        timer = window.setTimeout(() => setPhase("typing"), 500);
      }
    }
    return () => window.clearTimeout(timer);
  }, [len, phase, text]);

  return (
    <p className="mt-2 hidden items-center gap-0.5 text-sm font-semibold text-ink-soft sm:flex" aria-label={text}>
      <span>{text.slice(0, len)}</span>
      <span
        aria-hidden
        className="ml-0.5 inline-block h-[1.05em] w-[2px] animate-pulse rounded-sm bg-brand-red"
      />
      <span className="sr-only">{text}</span>
    </p>
  );
}
