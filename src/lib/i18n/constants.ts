/**
 * Constantes de locales — module sans dépendance serveur (next/headers, prisma),
 * importable depuis les composants client (sélecteur de langue).
 * Source de vérité : ces constantes sont ré-exportées par ./index (côté serveur).
 */

export const DEFAULT_LOCALE = "fr" as const;

export const ACTIVE_LOCALES = ["fr", "en", "es", "ar", "zh"] as const;

export type Locale = (typeof ACTIVE_LOCALES)[number];

/** Cookie de locale posé par le sélecteur de langue (durée : 1 an). */
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export interface LocaleMeta {
  code: Locale;
  /** Nom natif de la langue (auto-désignation). */
  nativeName: string;
  /** Étiquette courte affichée dans le bouton (FR, EN, ES, AR, ZH). */
  short: string;
  dir: "ltr" | "rtl";
}

/** Métadonnées des locales actives (utilisées par le sélecteur et le layout). */
export const LOCALES_META: readonly LocaleMeta[] = [
  { code: "fr", nativeName: "Français", short: "FR", dir: "ltr" },
  { code: "en", nativeName: "English", short: "EN", dir: "ltr" },
  { code: "es", nativeName: "Español", short: "ES", dir: "ltr" },
  { code: "ar", nativeName: "العربية", short: "AR", dir: "rtl" },
  { code: "zh", nativeName: "中文", short: "ZH", dir: "ltr" },
];

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (ACTIVE_LOCALES as readonly string[]).includes(value);
}

/** Étiquette BCP-47 pour Intl (dates, nombres). */
export function localeTag(locale: string): string {
  switch (locale) {
    case "en":
      return "en-GB";
    case "es":
      return "es-ES";
    case "ar":
      return "ar";
    case "zh":
      return "zh-CN";
    default:
      return "fr-FR";
  }
}

/** Direction d'écriture de la locale ("rtl" pour l'arabe). */
export function localeDir(locale: string): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}
