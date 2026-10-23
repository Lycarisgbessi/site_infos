"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * Chatbot INFOSPRO — assistant conversationnel léger (sans dépendance) :
 * base de connaissances par mots-clés + réponses rapides cliquables.
 * Bouton flottant coin inférieur droit, au-dessus de la barre audio.
 */

interface BotReply {
  text: string;
  links?: { label: string; href: string }[];
}

interface KbEntry {
  keywords: string[];
  reply: BotReply;
}

const KB: KbEntry[] = [
  {
    keywords: ["bonjour", "salut", "bonsoir", "hello", "salam"],
    reply: {
      text: "Bonjour et bienvenue sur INFOSPRO.net ! Je peux vous renseigner sur nos rubriques, la newsletter, la publicité, nos podcasts et vidéos… Que cherchez-vous ?",
    },
  },
  {
    keywords: ["publicit", "annonceur", "campagne", "regie", "régie", "tarif", "prix", "sponsor"],
    reply: {
      text: "Pour toute demande publicitaire : notre régie propose des formats d'affiches, d'images animées (GIF) et de vidéos sur l'ensemble du site (en-tête, colonne latérale, articles, coin de page…). Écrivez-nous et nous vous enverrons le kit média avec les tarifs.",
      links: [
        { label: "Page Publicité", href: "/pages/publicite" },
        { label: "Nous contacter", href: "/pages/contact" },
      ],
    },
  },
  {
    keywords: ["contact", "telephone", "téléphone", "email", "mail", "adresse", "joindre"],
    reply: {
      text: "Vous pouvez joindre la rédaction par email (contact@infospro.net), par téléphone ou directement à notre siège à Conakry, en Guinée. La page Contact contient toutes les coordonnées.",
      links: [{ label: "Page Contact", href: "/pages/contact" }],
    },
  },
  {
    keywords: ["newsletter", "abonn", "recevoir", "mail"],
    reply: {
      text: "Inscrivez-vous à la newsletter pour recevoir l'essentiel de l'actualité directement par email. C'est gratuit et désinscriptible à tout moment.",
      links: [{ label: "S'inscrire", href: "/pages/newsletters" }],
    },
  },
  {
    keywords: ["podcast", "audio", "fm", "radio", "ecoute", "écoute"],
    reply: {
      text: "Tous nos podcasts et émissions audio (chroniques, interviews, magazines) sont dans la rubrique Podcast / FM — lecture continue pendant votre navigation grâce au lecteur flottant.",
      links: [{ label: "Podcast / FM", href: "/podcast" }],
    },
  },
  {
    keywords: ["video", "vidéo", "tv", "direct", "live", "reportage"],
    reply: {
      text: "Nos reportages, interviews et émissions vidéo sont dans la rubrique Vidéos — y compris les directs. La lecture se fait en pleine page pour un meilleur confort.",
      links: [{ label: "Vidéos", href: "/video" }],
    },
  },
  {
    keywords: ["rubrique", "categorie", "catégorie", "politique", "sport", "economie", "économie", "societe", "société", "culture"],
    reply: {
      text: "Toutes nos rubriques (Politique, Économie, Société, International, Sport, Culture, Reportages…) sont accessibles depuis le menu noir en haut de page, ou depuis l'index complet.",
      links: [{ label: "Toutes les rubriques", href: "/rubriques" }],
    },
  },
  {
    keywords: ["application", "app", "installer", "telecharger", "télécharger", "telephone", "téléphone"],
    reply: {
      text: "INFOSPRO.net s'installe comme une application sur votre téléphone : sur Android/Chrome, ouvrez le menu ⋮ puis « Installer l'application » ; sur iPhone/Safari, partagez puis « Sur l'écran d'accueil ». Vous recevrez aussi une notification à chaque publication importante.",
    },
  },
  {
    keywords: ["meteo", "météo", "temperature", "température", "pluie"],
    reply: {
      text: "La météo des principales villes (Conakry et au-delà) s'affiche en haut du site et dans la colonne latérale de la page d'accueil, mise à jour automatiquement.",
    },
  },
  {
    keywords: ["horaires", "heure", "fuseau", "gmt"],
    reply: {
      text: "Les heures des principaux fuseaux horaires (Conakry, Londres, Paris, New York, Dubaï, Pékin) défilent en haut du site dans la barre rouge.",
    },
  },
  {
    keywords: ["emploi", "stage", "travail", "recrutement", "candidat"],
    reply: {
      text: "Pour les offres d'emploi et de stage à la rédaction, envoyez votre candidature spontanée par email avec CV et lettre de motivation.",
      links: [{ label: "Nous contacter", href: "/pages/contact" }],
    },
  },
];

const FALLBACK: BotReply = {
  text: "Je n'ai pas encore la réponse à cette question — mais la rédaction sera ravie de vous aider directement.",
  links: [{ label: "Nous contacter", href: "/pages/contact" }],
};

const QUICK_CHIPS = [
  "Publicité",
  "Newsletter",
  "Podcast",
  "Vidéos",
  "Installer l'application",
];

function answer(input: string): BotReply {
  const q = input.toLowerCase();
  let best: { entry: KbEntry; score: number } | null = null;
  for (const entry of KB) {
    const score = entry.keywords.reduce((n, k) => (q.includes(k) ? n + 1 : n), 0);
    if (score > 0 && (!best || score > best.score)) best = { entry, score };
  }
  return best ? best.entry.reply : FALLBACK;
}

interface Message {
  from: "bot" | "user";
  text: string;
  links?: { label: string; href: string }[];
}

export function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      from: "bot",
      text: "👋 Bienvenue sur INFOSPRO.net ! Posez-moi votre question ou choisissez un sujet :",
    },
  ]);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  const send = (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text) return;
    const reply = answer(text);
    setMessages((prev) => [...prev, { from: "user", text }, { from: "bot", text: reply.text, links: reply.links }]);
    setInput("");
  };

  return (
    <>
      {/* Bouton flottant — coin inférieur droit, au-dessus de la barre audio */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fermer l'assistant" : "Ouvrir l'assistant"}
        className="fixed bottom-24 end-4 z-50 flex size-14 items-center justify-center rounded-full bg-brand-red text-white shadow-[0_6px_24px_rgba(220,38,38,0.45)] transition-transform duration-200 hover:scale-110"
      >
        {open ? (
          <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <span className="relative">
            <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span aria-hidden className="absolute -right-0.5 -top-0.5 size-2.5 animate-ping rounded-full bg-white" />
          </span>
        )}
      </button>

      {/* Panneau de conversation */}
      {open && (
        <div
          role="dialog"
          aria-label="Assistant INFOSPRO"
          className="animate-slide-in-up fixed bottom-40 end-4 z-50 flex h-[26rem] w-[min(92vw,20rem)] flex-col overflow-hidden rounded-lg border border-rule bg-paper shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
        >
          <header className="flex items-center gap-2 bg-ink px-4 py-3 text-white">
            <img src="/logo.svg" alt="" className="h-6 w-auto invert hue-rotate-180" />
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight">Assistant INFOSPRO</p>
              <p className="flex items-center gap-1 text-[0.65rem] text-white/70">
                <span className="inline-block size-1.5 rounded-full bg-green-400" />
                En ligne — réponse immédiate
              </p>
            </div>
          </header>

          <div ref={listRef} className="scrollbar-none flex-1 space-y-3 overflow-y-auto bg-paper-alt p-3">
            {messages.map((m, i) => (
              <div key={i} className={m.from === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-[0.8rem] leading-relaxed ${
                    m.from === "user" ? "bg-brand-red text-white" : "border border-rule bg-paper text-ink"
                  }`}
                >
                  <p>{m.text}</p>
                  {m.links && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.links.map((l) => (
                        <Link
                          key={l.href}
                          href={l.href}
                          className="rounded-full border border-brand-red px-2.5 py-1 text-[0.7rem] font-semibold text-brand-red transition-colors duration-200 hover:bg-brand-red hover:text-white"
                        >
                          {l.label} →
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-rule bg-paper p-2">
            <div className="scrollbar-none mb-2 flex gap-1.5 overflow-x-auto">
              {QUICK_CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => send(c)}
                  className="shrink-0 rounded-full bg-paper-alt px-2.5 py-1 text-[0.7rem] font-medium text-ink-soft transition-colors duration-200 hover:bg-brand-red hover:text-white"
                >
                  {c}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Écrivez votre question…"
                aria-label="Votre question"
                className="min-w-0 flex-1 rounded-md border border-rule bg-paper-alt px-3 py-2 text-[0.8rem] outline-none transition-colors focus:border-brand-red"
              />
              <button
                type="submit"
                aria-label="Envoyer"
                className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-red text-white transition-colors duration-200 hover:bg-red-deep"
              >
                <svg aria-hidden viewBox="0 0 24 24" className="size-4 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
