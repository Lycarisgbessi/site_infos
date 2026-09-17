/**
 * Menus (§21.4) et zoning de la page d'accueil (§09.1) — contractuels.
 */

export interface MenuItemSeed {
  label: string;
  targetType: "category" | "page" | "dossier" | "tag" | "url" | "home" | "section";
  categorySlug?: string;
  pageSlug?: string;
  url?: string;
  highlight?: boolean;
  position: number;
  children?: MenuItemSeed[];
}

export interface MenuSeed {
  key: string;
  label: string;
  items: MenuItemSeed[];
}

export const MENUS: MenuSeed[] = [
  {
    key: "main",
    label: "Menu principal",
    items: [
      { label: "Accueil", targetType: "home", position: 1 },
      { label: "Politique", targetType: "category", categorySlug: "politique", position: 2 },
      { label: "Économie", targetType: "category", categorySlug: "economie", position: 3 },
      { label: "Société", targetType: "category", categorySlug: "societe", position: 4 },
      { label: "International", targetType: "category", categorySlug: "international", position: 5 },
      { label: "Sport", targetType: "category", categorySlug: "sport", position: 6 },
      { label: "Culture", targetType: "category", categorySlug: "culture", position: 7 },
      { label: "Reportages", targetType: "category", categorySlug: "reportages", position: 8 },
    ],
  },
  {
    key: "utility",
    label: "Barre utilitaire",
    items: [
      { label: "Newsletter", targetType: "page", pageSlug: "newsletters", highlight: true, position: 1 },
      { label: "Contact", targetType: "page", pageSlug: "contact", position: 2 },
      { label: "Publicité", targetType: "page", pageSlug: "publicite", position: 3 },
    ],
  },
  {
    key: "footer_1",
    label: "Pied de page — Rubriques",
    items: [
      { label: "Politique", targetType: "category", categorySlug: "politique", position: 1 },
      { label: "Économie", targetType: "category", categorySlug: "economie", position: 2 },
      { label: "Société", targetType: "category", categorySlug: "societe", position: 3 },
      { label: "International", targetType: "category", categorySlug: "international", position: 4 },
      { label: "Sport", targetType: "category", categorySlug: "sport", position: 5 },
      { label: "Environnement", targetType: "category", categorySlug: "environnement", position: 6 },
      { label: "Toutes les rubriques", targetType: "url", url: "/rubriques", position: 7 },
    ],
  },
  {
    key: "footer_2",
    label: "Pied de page — Le média",
    items: [
      { label: "À propos", targetType: "page", pageSlug: "a-propos", position: 1 },
      { label: "Charte éditoriale", targetType: "page", pageSlug: "charte-editoriale", position: 2 },
      { label: "Recrutement", targetType: "page", pageSlug: "recrutement", position: 3 },
      { label: "Contact", targetType: "page", pageSlug: "contact", position: 4 },
    ],
  },
  {
    key: "footer_3",
    label: "Pied de page — Services",
    items: [
      { label: "Newsletters", targetType: "page", pageSlug: "newsletters", position: 1 },
      { label: "Flux RSS", targetType: "url", url: "/rss.xml", position: 2 },
      { label: "Météo", targetType: "url", url: "/meteo", position: 3 },
      { label: "Archives", targetType: "url", url: "/archives", position: 4 },
      { label: "Plan du site", targetType: "page", pageSlug: "plan-du-site", position: 5 },
    ],
  },
  {
    key: "footer_4",
    label: "Pied de page — Légal",
    items: [
      { label: "Mentions légales", targetType: "page", pageSlug: "mentions-legales", position: 1 },
      { label: "Confidentialité", targetType: "page", pageSlug: "confidentialite", position: 2 },
      { label: "Cookies", targetType: "page", pageSlug: "cookies", position: 3 },
      { label: "CGU", targetType: "page", pageSlug: "cgu", position: 4 },
      { label: "Droit de réponse", targetType: "page", pageSlug: "droit-de-reponse", position: 5 },
    ],
  },
];

// ─── Zoning de la page d'accueil (§09.1) ───────────────────────────────

export interface HomepageBlockSeed {
  code: string;
  type:
    | "alert" | "flash" | "lead" | "live" | "latest" | "section" | "video"
    | "newsletter" | "weather" | "dossier" | "world" | "opinion" | "ad"
    | "most_read" | "custom_html";
  variant?: string;
  title?: string;
  subtitle?: string;
  sourceType?: "category" | "dossier" | "tag" | "manual" | "auto" | "format";
  itemCount?: number;
  settings?: Record<string, unknown>;
  position: number;
  isActive: boolean;
}

export const HOMEPAGE_BLOCKS: HomepageBlockSeed[] = [
  { code: "Z-00", type: "alert", title: "Alerte", position: 0, isActive: false,
    settings: { note: "Bandeau d'alerte majeure, fermable — masqué par défaut (§09.1)" } },
  { code: "Z-02", type: "ad", title: "Leaderboard d'en-tête", position: 2, isActive: true,
    settings: { slotCode: "AD-02" } },
  { code: "Z-03", type: "flash", variant: "ticker", title: "Flash info", position: 3, isActive: true,
    itemCount: 5, settings: { refreshSec: 60 } },
  { code: "Z-04", type: "lead", variant: "lead-1x4", title: "À la une", position: 4, isActive: true,
    itemCount: 5 },
  { code: "Z-05", type: "live", variant: "banner", title: "Direct", position: 5, isActive: true },
  { code: "Z-06", type: "latest", variant: "list-sidebar", title: "En continu", position: 6, isActive: true,
    itemCount: 12, settings: { sidebarMostRead: true, sidebarAd: "AD-04" } },
  { code: "Z-07a", type: "section", variant: "featured-list", title: "Politique", position: 7, isActive: true,
    sourceType: "category", itemCount: 5, settings: { categorySlug: "politique" } },
  { code: "Z-07b", type: "section", variant: "featured-list", title: "Économie", position: 8, isActive: true,
    sourceType: "category", itemCount: 5, settings: { categorySlug: "economie" } },
  { code: "Z-07c", type: "section", variant: "featured-list", title: "Société", position: 9, isActive: true,
    sourceType: "category", itemCount: 5, settings: { categorySlug: "societe" } },
  { code: "Z-07d", type: "section", variant: "featured-list", title: "Sport", position: 10, isActive: true,
    sourceType: "category", itemCount: 5, settings: { categorySlug: "sport" } },
  { code: "Z-08", type: "video", variant: "carousel-dark", title: "Reportages vidéo", position: 11, isActive: true,
    itemCount: 8 },
  { code: "Z-09", type: "newsletter", variant: "inline-wide", title: "L'Essentiel du matin", position: 12, isActive: true,
    settings: { listKey: "morning" } },
  { code: "Z-10", type: "weather", variant: "strip", title: "Météo", position: 13, isActive: true,
    itemCount: 5 },
  { code: "Z-11", type: "dossier", variant: "immersive", title: "Dossier", position: 14, isActive: true },
  { code: "Z-12", type: "world", variant: "tabs", title: "Monde", position: 15, isActive: true },
  { code: "Z-13", type: "opinion", variant: "authors", title: "Opinions", position: 16, isActive: true,
    itemCount: 4 },
  { code: "Z-14", type: "ad", title: "Inter-bloc accueil", position: 17, isActive: true,
    settings: { slotCode: "AD-07" } },
];
