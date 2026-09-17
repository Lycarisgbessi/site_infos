"use client";

import { useState } from "react";

/**
 * Bloc newsletter large (Z-09) — inscription réelle via /api/public/subscribe.
 * Task ID: 9-NEWSLETTER
 */

interface Props {
  kicker: string;
  title: string;
  description: string;
  placeholder: string;
  cta: string;
  okMessage: string;
  errorMessage: string;
  loadingMessage: string;
}

type State = "idle" | "loading" | "ok" | "error";

export function NewsletterBlock({
  kicker,
  title,
  description,
  placeholder,
  cta,
  okMessage,
  errorMessage,
  loadingMessage,
}: Props) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "loading") return;
    setState("loading");
    setMessage(loadingMessage);
    try {
      const res = await fetch("/api/public/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, listKey: "morning", source: "home_inline" }),
      });
      const data: { ok?: boolean; error?: string } = await res.json();
      if (res.ok && data.ok) {
        setState("ok");
        setMessage(okMessage);
        setEmail("");
      } else {
        setState("error");
        setMessage(data.error === "invalid_email" ? errorMessage : errorMessage);
      }
    } catch {
      setState("error");
      setMessage(errorMessage);
    }
  }

  return (
    <section id="newsletter" aria-label={title} className="scroll-mt-20 border border-rule bg-ink text-paper">
      <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">
        <div>
          <p className="kicker text-red-bright">{kicker}</p>
          <h2 className="mt-2 font-serif text-2xl font-black tracking-tight md:text-3xl">{title}</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-paper/75">{description}</p>
        </div>
        <form onSubmit={onSubmit} className="w-full md:w-96" noValidate>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="newsletter-email" className="sr-only">
              {placeholder}
            </label>
            <input
              id="newsletter-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={placeholder}
              autoComplete="email"
              className="h-11 flex-1 border border-rule-strong bg-paper px-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand-red"
            />
            <button
              type="submit"
              disabled={state === "loading"}
              className="h-11 shrink-0 bg-brand-red px-5 text-sm font-bold text-white transition-colors duration-200 hover:bg-red-deep disabled:cursor-wait disabled:opacity-70"
            >
              {state === "loading" ? loadingMessage : cta}
            </button>
          </div>
          {message && (
            <p
              role="status"
              aria-live="polite"
              className={`mt-2 text-xs ${state === "ok" ? "text-emerald-400" : "text-red-bright"}`}
            >
              {message}
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
