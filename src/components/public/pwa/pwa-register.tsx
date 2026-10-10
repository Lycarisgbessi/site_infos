"use client";

import { useEffect } from "react";

/**
 * Enregistrement du service worker PWA (mount dans le layout racine).
 * Uniquement en contexte sécurisé (HTTPS ou localhost).
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (!window.isSecureContext) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((error) => console.warn("[PWA] Échec enregistrement service worker:", error));
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
