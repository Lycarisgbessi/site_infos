"use client";

import { useState } from "react";

/**
 * Bandeau collant mobile (AD-12) — refermable, mobile uniquement.
 * Task ID: 9-ADS
 */

export function MobileStickyAd({
  label,
  title,
  text,
  cta,
  closeLabel,
}: {
  label: string;
  title: string;
  text: string;
  cta: string;
  closeLabel: string;
}) {
  const [closed, setClosed] = useState(false);
  if (closed) return null;
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-rule bg-paper-alt shadow-[0_-4px_16px_rgba(0,0,0,0.08)] lg:hidden"
      data-ad-slot="AD-12"
      role="complementary"
      aria-label={`${label} AD-12`}
    >
      <div className="relative">
        <span className="absolute -top-2 left-2 bg-paper px-1.5 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-ink-faint">
          {label}
        </span>
        <button
          type="button"
          onClick={() => setClosed(true)}
          aria-label={closeLabel}
          className="absolute right-1 top-1 z-10 flex size-7 items-center justify-center text-lg leading-none text-ink-soft transition-colors hover:text-ink"
        >
          ×
        </button>
        <div className="h-[60px]">
          <div className="flex h-full w-full items-center justify-between gap-3 px-4">
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-brand-red font-serif text-sm font-black text-white"
              >
                iP
              </span>
              <div className="min-w-0">
                <p className="truncate font-serif text-sm font-bold">{title}</p>
                <p className="truncate text-[0.7rem] text-ink-soft">{text}</p>
              </div>
            </div>
            <span className="shrink-0 bg-brand-red px-2.5 py-1 text-[0.7rem] font-bold text-white">{cta}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
