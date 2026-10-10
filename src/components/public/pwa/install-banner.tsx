"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Bannière discrète d'installation PWA + activation des notifications push.
 * - beforeinstallprompt → « Installer INFOSPRO » (refus mémorisé 7 j en localStorage)
 * - masquée si déjà installée (display-mode: standalone) ou refusée récemment
 * - bouton cloche : Notification.requestPermission() puis POST /api/public/push/subscribe
 * Textes FR en dur (volontaire — l'i18n est piloté par ailleurs).
 */

const DISMISS_KEY = "infospro.install-banner.dismissed-at";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export interface InstallBannerLabels {
  installTitle: string;
  installHint: string;
  notificationsHint: string;
  notificationsOn: string;
  enableNotifications: string;
  install: string;
  close: string;
}

export function InstallBanner({ labels }: { labels: InstallBannerLabels }) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [notificationsState, setNotificationsState] = useState<
    "idle" | "asking" | "on" | "error"
  >("idle");

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Déjà installée → jamais afficher
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    // Refus récent (< 7 jours) → masquer
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS) return;

    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      setNotificationsState("on");
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => setVisible(false);

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // Safari iOS ne déclenche pas beforeinstallprompt : afficher quand même
    // la bannière (limitée au cloche notifications) après un court délai.
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const timer = window.setTimeout(() => setVisible(true), 2500);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(timer);
      void isIOS; // lint satisfait — pas de logique spécifique iOS au-delà de l'affichage
    };
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }, []);

  const install = useCallback(async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") setVisible(false);
    setInstallEvent(null);
  }, [installEvent]);

  const enableNotifications = useCallback(async () => {
    try {
      if (!("serviceWorker" in navigator) || typeof Notification === "undefined") return;
      setNotificationsState("asking");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setNotificationsState("idle");
        return;
      }
      const registration = await navigator.serviceWorker.ready;

      // Clé publique VAPID exposée au client (sans danger).
      const { data } = (await fetch("/api/public/pwa/vapid").then((r) => r.json())) as {
        data?: { publicKey?: string };
      };
      const publicKey = data?.publicKey;
      if (!publicKey) throw new Error("VAPID public key indisponible");

      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

      const response = await fetch("/api/public/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) throw new Error("Échec enregistrement subscription");
      setNotificationsState("on");
    } catch (error) {
      console.warn("[PWA] Activation notifications impossible:", error);
      setNotificationsState("error");
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      role="complementary"
      aria-label={labels.installTitle}
      className="fixed inset-x-3 bottom-16 z-40 sm:inset-x-auto sm:end-4 sm:w-80"
    >
      <div className="flex items-center gap-3 rounded-lg border border-rule bg-ink/97 p-3 text-paper shadow-lg backdrop-blur supports-[backdrop-filter]:bg-ink/92">
        <div className="min-w-0 flex-1">
          {installEvent && (
            <>
              <p className="text-sm font-semibold">{labels.installTitle}</p>
              <p className="text-xs opacity-70">
                {labels.installHint}
              </p>
            </>
          )}
          {notificationsState !== "on" && (
            <p className="text-xs opacity-70">
              {labels.notificationsHint}
            </p>
          )}
          {notificationsState === "on" && !installEvent && (
            <p className="text-sm font-semibold">{labels.notificationsOn}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {notificationsState !== "on" && (
            <button
              type="button"
              onClick={enableNotifications}
              disabled={notificationsState === "asking"}
              aria-label={labels.enableNotifications}
              title={labels.enableNotifications}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rule text-paper transition hover:bg-paper/10 disabled:opacity-50"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
            </button>
          )}
          {installEvent && (
            <button
              type="button"
              onClick={install}
              className="rounded-md bg-paper px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-paper/90"
            >
              {labels.install}
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            aria-label={labels.close}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-paper/70 transition hover:text-paper"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
