"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Révélation au scroll — wrapper client léger basé sur IntersectionObserver.
 * Variantes d'entrée : montée (défaut), glissé latéral, zoom, fondu sec —
 * au service d'une lecture dynamique sans jamais distraire.
 *
 * `RevealGroup` cascade les enfants (délais progressifs 70 ms) pour un
 * effet « dominos » professionnel sur les listes de cartes.
 *
 * Sous `prefers-reduced-motion`, le contenu reste immédiatement visible
 * (géré en CSS, sans JS).
 */

export type RevealVariant = "up" | "left" | "right" | "zoom" | "fade";

const VARIANT_CLASS: Record<RevealVariant, string> = {
  up: "reveal-up",
  left: "reveal-left",
  right: "reveal-right",
  zoom: "reveal-zoom",
  fade: "reveal-fade",
};

export function Reveal({
  children,
  className = "",
  delay = 0,
  variant = "up",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  variant?: RevealVariant;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${VARIANT_CLASS[variant]} ${visible ? "reveal-visible" : ""} ${className}`}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/** Cascade : chaque enfant direct est révélé avec 70 ms d'écart. */
export function RevealGroup({
  children,
  className = "",
  variant = "up",
  stepMs = 70,
}: {
  children: React.ReactNode;
  className?: string;
  variant?: RevealVariant;
  stepMs?: number;
}) {
  return (
    <div className={className}>
      {Array.isArray(children)
        ? children.map((child, i) => (
            <Reveal key={i} variant={variant} delay={i * stepMs}>
              {child}
            </Reveal>
          ))
        : children}
    </div>
  );
}
