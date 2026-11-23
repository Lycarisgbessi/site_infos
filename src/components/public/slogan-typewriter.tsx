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
    <p
      className="font-cursive -mt-1 hidden items-center gap-0.5 text-xl font-bold leading-none text-brand-red sm:flex"
      style={{ fontFamily: "var(--font-caveat), 'Segoe Script', 'Brush Script MT', cursive", transform: "rotate(-1.5deg)" }}
      aria-label={text}
    >
      <span className="drop-shadow-[0_1px_0_rgba(0,0,0,0.04)]">{text.slice(0, len)}</span>
      <span
        aria-hidden
        className="ml-0.5 inline-block h-[1em] w-[2.5px] animate-pulse rounded-sm bg-brand-red"
      />
      <span className="sr-only">{text}</span>
    </p>
  );
}
