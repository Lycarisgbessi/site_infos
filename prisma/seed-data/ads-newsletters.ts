/**
 * Catalogue des 19 emplacements publicitaires (§13.1, contractuel).
 * `sizes` et `pages` sont sérialisés (adaptation D-01).
 */

export interface AdSlotSeed {
  code: string;
  name: string;
  description: string;
  placement: string;
  sizes: { w: number; h: number; label: string }[];
  pages: string[];
  maxCreativeKb?: number;
  allowsThirdParty?: boolean;
  refreshSec?: number | null;
  maxRefresh?: number;
  position: number;
  attention?: string;
}

export const AD_SLOTS: AdSlotSeed[] = [
  {
    code: "AD-01", name: "Habillage de page (skin)",
    description: "Fond latéral habillant la page, exclusivité à la journée.",
    placement: "skin",
    sizes: [{ w: 1800, h: 1000, label: "Habillage" }],
    pages: ["home", "category"], allowsThirdParty: false, refreshSec: null,
    position: 1, attention: "Très forte — exclusivité journée",
  },
  {
    code: "AD-02", name: "Leaderboard d'en-tête",
    description: "Bannière haute multi-formats, toutes pages.",
    placement: "header",
    sizes: [
      { w: 970, h: 250, label: "Billboard" },
      { w: 970, h: 90, label: "Super leaderboard" },
      { w: 728, h: 90, label: "Leaderboard" },
      { w: 320, h: 100, label: "Mobile" },
    ],
    pages: ["all"], allowsThirdParty: true, refreshSec: null,
    position: 2, attention: "Forte",
  },
  {
    code: "AD-03", name: "Billboard sous la une",
    description: "Grand format sous le bloc à la une de l'accueil.",
    placement: "hero",
    sizes: [{ w: 970, h: 250, label: "Billboard" }],
    pages: ["home"], allowsThirdParty: true, refreshSec: null,
    position: 3, attention: "Très forte",
  },
  {
    code: "AD-04", name: "Pavé latéral haut",
    description: "Pavé en colonne latérale des pages article et rubrique.",
    placement: "sidebar",
    sizes: [
      { w: 300, h: 250, label: "Pavé" },
      { w: 300, h: 600, label: "Demi-page" },
    ],
    pages: ["article", "category"], allowsThirdParty: true, refreshSec: null,
    position: 4, attention: "Forte",
  },
  {
    code: "AD-05", name: "Pavé latéral collant",
    description: "Demi-page collante le long de la lecture d'article.",
    placement: "sidebar_sticky",
    sizes: [{ w: 300, h: 600, label: "Demi-page" }],
    pages: ["article"], allowsThirdParty: true, refreshSec: 30, maxRefresh: 5,
    position: 5, attention: "Très forte — durée d'exposition",
  },
  {
    code: "AD-06", name: "In-read (dans le texte)",
    description: "Pavé natif responsive inséré dans le corps d'article (3ᵉ et 7ᵉ paragraphes).",
    placement: "in_read",
    sizes: [{ w: 300, h: 250, label: "Pavé" }, { w: 0, h: 0, label: "Natif responsive" }],
    pages: ["article"], allowsThirdParty: false, refreshSec: null,
    position: 6, attention: "Très forte",
  },
  {
    code: "AD-07", name: "Inter-bloc accueil",
    description: "Bannière ou natif entre deux blocs de l'accueil.",
    placement: "inter_block",
    sizes: [{ w: 728, h: 90, label: "Leaderboard" }, { w: 0, h: 0, label: "Natif" }],
    pages: ["home"], allowsThirdParty: false, refreshSec: null,
    position: 7, attention: "Moyenne à forte",
  },
  {
    code: "AD-08", name: "Natif dans le fil",
    description: "Carte publicitaire au gabarit éditorial, mention « Publicité » obligatoire.",
    placement: "in_feed_native",
    sizes: [{ w: 0, h: 0, label: "Natif fil" }],
    pages: ["home", "category", "search"], allowsThirdParty: false, refreshSec: null,
    position: 8, attention: "Forte",
  },
  {
    code: "AD-09", name: "Sponsoring de rubrique",
    description: "Logo « en partenariat avec » + bandeau sur une rubrique entière, vente au mois.",
    placement: "category_sponsorship",
    sizes: [{ w: 0, h: 0, label: "Logo + bandeau" }],
    pages: ["category"], allowsThirdParty: false, refreshSec: null,
    position: 9, attention: "Forte — vente au mois",
  },
  {
    code: "AD-10", name: "Sponsoring de newsletter",
    description: "Bannière 600×150 + encart texte dans les e-mails.",
    placement: "newsletter",
    sizes: [{ w: 600, h: 150, label: "E-mail" }],
    pages: ["all"], allowsThirdParty: false, refreshSec: null,
    position: 10, attention: "Très forte",
  },
  {
    code: "AD-11", name: "Pré-roll vidéo",
    description: "Publicité vidéo 6–15 s skippable après 5 s devant les reportages.",
    placement: "video_preroll",
    sizes: [{ w: 0, h: 0, label: "Vidéo 16:9" }],
    pages: ["all"], allowsThirdParty: true, refreshSec: null,
    position: 11, attention: "Très forte",
  },
  {
    code: "AD-12", name: "Bandeau collant mobile",
    description: "Bandeau bas d'écran mobile, fermable.",
    placement: "mobile_sticky",
    sizes: [
      { w: 320, h: 50, label: "Mobile" },
      { w: 320, h: 100, label: "Mobile large" },
    ],
    pages: ["all"], allowsThirdParty: true, refreshSec: 30, maxRefresh: 5,
    position: 12, attention: "Forte",
  },
  {
    code: "AD-13", name: "Interstitiel de transition",
    description: "Plein écran fermable entre deux articles, 1×/session maximum.",
    placement: "interstitial",
    sizes: [{ w: 0, h: 0, label: "Plein écran" }],
    pages: ["article"], allowsThirdParty: true, refreshSec: null,
    position: 13, attention: "Très forte — usage limité",
  },
  {
    code: "AD-14", name: "Bas d'article",
    description: "Bannière en fin d'article.",
    placement: "article_footer",
    sizes: [
      { w: 728, h: 90, label: "Leaderboard" },
      { w: 970, h: 250, label: "Billboard" },
    ],
    pages: ["article"], allowsThirdParty: true, refreshSec: null,
    position: 14, attention: "Moyenne",
  },
  {
    code: "AD-15", name: "Pied de page",
    description: "Bannière basse de page, remplissage.",
    placement: "footer",
    sizes: [{ w: 728, h: 90, label: "Leaderboard" }],
    pages: ["all"], allowsThirdParty: true, refreshSec: null,
    position: 15, attention: "Faible — remplissage",
  },
  {
    code: "AD-16", name: "Widget météo sponsorisé",
    description: "Logo « Météo présentée par » à côté du widget météo.",
    placement: "weather_sponsor",
    sizes: [{ w: 0, h: 0, label: "Logo" }],
    pages: ["home"], allowsThirdParty: false, refreshSec: null,
    position: 16, attention: "Forte",
  },
  {
    code: "AD-17", name: "Bandeau de direct",
    description: "Bandeau fin sous le titre d'un live blog.",
    placement: "live_banner",
    sizes: [{ w: 0, h: 0, label: "Bandeau fin" }],
    pages: ["all"], allowsThirdParty: false, refreshSec: null,
    position: 17, attention: "Très forte en événement",
  },
  {
    code: "AD-18", name: "Contenu de marque",
    description: "Article complet au gabarit distinct, hors flux classé, rubrique dédiée.",
    placement: "brand_content",
    sizes: [{ w: 0, h: 0, label: "Article" }],
    pages: ["all"], allowsThirdParty: false, refreshSec: null,
    position: 18, attention: "Forte",
  },
  {
    code: "AD-19", name: "Auto-promotion",
    description: "Invendu : newsletters, dossiers, appels à témoignages INFOSPRO.",
    placement: "self_promo",
    sizes: [{ w: 0, h: 0, label: "Natif" }],
    pages: ["all"], allowsThirdParty: false, refreshSec: null,
    position: 19, attention: "Remplissage",
  },
];

// ─── Catalogue newsletter (§14.1, contractuel) ─────────────────────────

export interface NewsletterListSeed {
  key: string;
  name: string;
  description: string;
  cadence: "daily" | "weekly" | "biweekly" | "event";
  sendTime?: string; // "HH:MM" GMT
  autoCompose?: boolean;
  templateKey?: string;
  position: number;
}

export const NEWSLETTER_LISTS: NewsletterListSeed[] = [
  {
    key: "morning", name: "L'Essentiel du matin",
    description: "5 à 7 informations clés, la météo et l'agenda, chaque matin à 06:00 GMT.",
    cadence: "daily", sendTime: "06:00", autoCompose: true, templateKey: "morning", position: 1,
  },
  {
    key: "breaking", name: "Flash — Alerte",
    description: "Alerte e-mail lors d'une information majeure, déclenchée depuis l'article.",
    cadence: "event", autoCompose: false, templateKey: "breaking", position: 2,
  },
  {
    key: "weekly", name: "Le Récap de la semaine",
    description: "Chaque samedi : analyses, formats longs et vidéos de la semaine.",
    cadence: "weekly", sendTime: "10:00", autoCompose: false, templateKey: "weekly", position: 3,
  },
  {
    key: "economy", name: "Économie & Mines",
    description: "Hebdomadaire : indicateurs, appels d'offres, décryptages du secteur minier.",
    cadence: "weekly", sendTime: "08:00", autoCompose: false, templateKey: "economy", position: 4,
  },
  {
    key: "diaspora", name: "Diaspora",
    description: "Bimensuel : la sélection pour les Guinéens de l'étranger.",
    cadence: "biweekly", sendTime: "09:00", autoCompose: false, templateKey: "diaspora", position: 5,
  },
];
