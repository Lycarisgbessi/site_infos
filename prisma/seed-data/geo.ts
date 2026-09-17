/**
 * Zones géographiques (§21.2) et villes météo (§21.3) — coordonnées réelles.
 */

export interface GeoZoneSeed {
  slug: string;
  name: string;
  type: "continent" | "country" | "region" | "city";
  isoCode?: string;
  latitude?: number;
  longitude?: number;
  position: number;
  children?: GeoZoneSeed[];
}

export const GEO_ZONES: GeoZoneSeed[] = [
  {
    slug: "afrique", name: "Afrique", type: "continent", position: 1,
    children: [
      { slug: "guinee", name: "Guinée", type: "country", isoCode: "GN", position: 1,
        children: [
          { slug: "basse-guinee", name: "Basse-Guinée", type: "region", position: 1 },
          { slug: "moyenne-guinee", name: "Moyenne-Guinée", type: "region", position: 2 },
          { slug: "haute-guinee", name: "Haute-Guinée", type: "region", position: 3 },
          { slug: "guinee-forestiere", name: "Guinée forestière", type: "region", position: 4 },
          { slug: "conakry", name: "Conakry", type: "city", latitude: 9.6411, longitude: -13.5784, position: 5 },
          { slug: "kankan-ville", name: "Kankan", type: "city", latitude: 10.3869, longitude: -9.3061, position: 6 },
          { slug: "nzerekore", name: "Nzérékoré", type: "city", latitude: 7.7561, longitude: -8.8141, position: 7 },
          { slug: "labe", name: "Labé", type: "city", latitude: 11.3167, longitude: -12.2833, position: 8 },
          { slug: "kindia", name: "Kindia", type: "city", latitude: 10.0554, longitude: -12.8652, position: 9 },
          { slug: "boke", name: "Boké", type: "city", latitude: 10.9333, longitude: -14.3, position: 10 },
          { slug: "siguiri", name: "Siguiri", type: "city", latitude: 11.4228, longitude: -9.1897, position: 11 },
          { slug: "mamou", name: "Mamou", type: "city", latitude: 10.3751, longitude: -12.0959, position: 12 },
          { slug: "faranah", name: "Faranah", type: "city", latitude: 10.0404, longitude: -10.7404, position: 13 },
          { slug: "kissidougou", name: "Kissidougou", type: "city", latitude: 9.1842, longitude: -9.1836, position: 14 },
        ],
      },
      { slug: "senegal", name: "Sénégal", type: "country", isoCode: "SN", position: 2 },
      { slug: "mali", name: "Mali", type: "country", isoCode: "ML", position: 3 },
      { slug: "cote-divoire", name: "Côte d'Ivoire", type: "country", isoCode: "CI", position: 4 },
      { slug: "sierra-leone", name: "Sierra Leone", type: "country", isoCode: "SL", position: 5 },
      { slug: "liberia", name: "Liberia", type: "country", isoCode: "LR", position: 6 },
      { slug: "guinee-bissau", name: "Guinée-Bissau", type: "country", isoCode: "GW", position: 7 },
    ],
  },
  { slug: "europe-zone", name: "Europe", type: "continent", position: 2,
    children: [
      { slug: "france", name: "France", type: "country", isoCode: "FR", position: 1 },
    ],
  },
  { slug: "ameriques", name: "Amériques", type: "continent", position: 3,
    children: [
      { slug: "etats-unis", name: "États-Unis", type: "country", isoCode: "US", position: 1 },
    ],
  },
  { slug: "asie", name: "Asie", type: "continent", position: 4,
    children: [
      { slug: "chine", name: "Chine", type: "country", isoCode: "CN", position: 1 },
    ],
  },
  { slug: "moyen-orient", name: "Moyen-Orient", type: "continent", position: 5 },
  { slug: "oceanie", name: "Océanie", type: "continent", position: 6 },
];

// ─── Villes météo (§21.3) — Conakry par défaut + 4 villes ──────────────

export interface WeatherCitySeed {
  name: string;
  latitude: number;
  longitude: number;
  position: number;
  isDefault: boolean;
}

export const WEATHER_CITIES: WeatherCitySeed[] = [
  { name: "Conakry", latitude: 9.6411, longitude: -13.5784, position: 1, isDefault: true },
  { name: "Kankan", latitude: 10.3869, longitude: -9.3061, position: 2, isDefault: false },
  { name: "Labé", latitude: 11.3167, longitude: -12.2833, position: 3, isDefault: false },
  { name: "Nzérékoré", latitude: 7.7561, longitude: -8.8141, position: 4, isDefault: false },
  { name: "Boké", latitude: 10.9333, longitude: -14.3, position: 5, isDefault: false },
];
