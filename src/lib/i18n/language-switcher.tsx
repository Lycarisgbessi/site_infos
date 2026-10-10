"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ACTIVE_LOCALES,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  type Locale,
} from "./constants";

/**
 * Sélecteur de langue (composant client) : pose le cookie NEXT_LOCALE
 * (1 an) puis `router.refresh()` pour re-rendre côté serveur avec la
 * nouvelle locale. Discret : un bouton globe + code, un dropdown natif
 * compact — cohérent avec la TopBar (texte xs, tokens ink/paper).
 */

const NATIVE_NAMES: Record<Locale, string> = {
  fr: "Français",
  en: "English",
  es: "Español",
  ar: "العربية",
  zh: "中文",
};

export function LanguageSwitcher({
  currentLocale,
  label,
  title,
}: {
  currentLocale: Locale;
  label: string;
  title: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onEsc(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  function selectLocale(next: Locale) {
    setOpen(false);
    if (next === currentLocale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={title}
        title={title}
        disabled={pending}
        className="flex h-8 items-center gap-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-ink-soft transition-colors duration-200 hover:text-brand-red disabled:opacity-60"
      >
        {/* Globe */}
        <svg viewBox="0 0 24 24" aria-hidden className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
        </svg>
        <span>{currentLocale}</span>
        <svg viewBox="0 0 24 24" aria-hidden className={`size-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute end-0 top-full z-50 mt-1 min-w-40 border border-rule bg-paper py-1 shadow-md"
        >
          {ACTIVE_LOCALES.map((code) => (
            <li key={code} role="option" aria-selected={code === currentLocale}>
              <button
                type="button"
                lang={code}
                onClick={() => selectLocale(code)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-xs transition-colors duration-150 ${
                  code === currentLocale
                    ? "bg-paper-alt font-bold text-brand-red"
                    : "text-ink-soft hover:bg-paper-alt hover:text-ink"
                }`}
              >
                <span>{NATIVE_NAMES[code]}</span>
                <span className="font-mono text-[0.65rem] uppercase text-ink-faint">{code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
