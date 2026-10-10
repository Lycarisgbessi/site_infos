"use client";

import { useState } from "react";

/** Bouton de partage — Web Share API, repli copie dans le presse-papier. */
export function ShareButton({ label, okLabel, errorLabel }: { label: string; okLabel: string; errorLabel: string }) {
  const [message, setMessage] = useState<string | null>(null);

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setMessage(okLabel);
    } catch {
      setMessage(errorLabel);
    }
    setTimeout(() => setMessage(null), 3000);
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={share}
        className="inline-flex h-10 items-center border border-paper/30 px-4 text-xs font-bold uppercase tracking-widest text-paper transition-colors duration-200 hover:border-paper hover:bg-paper hover:text-ink"
      >
        {label}
      </button>
      {message && (
        <span role="status" aria-live="polite" className="text-xs text-paper/70">
          {message}
        </span>
      )}
    </span>
  );
}
