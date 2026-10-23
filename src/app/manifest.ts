import type { MetadataRoute } from "next";

/**
 * Manifeste PWA (§ — installable sur écran d'accueil).
 * Couleurs conformes au viewport du layout racine : blanc clair / #0E0D0C sombre.
 * Limites connues : iOS exige une icône PNG (apple-touch-icon) et ne lit pas
 * les SVG du manifest pour l'install — prévoir des PNG plus tard si cible iOS.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "INFOSPRO",
    short_name: "INFOSPRO",
    description:
      "Plateforme média numérique INFOSPRO — l'information de Guinée et du monde.",
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    categories: ["news", "magazines"],
    background_color: "#FFFFFF",
    theme_color: "#0E0D0C",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
