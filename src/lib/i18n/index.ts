import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { CACHE_TAGS, invalidateTags } from "@/lib/cache";
import { frDictionary, type Dictionary } from "./fr";
import { enDictionary } from "./en";
import { esDictionary } from "./es";
import { arDictionary } from "./ar";
import { zhDictionary } from "./zh";

/**
 * Noyau i18n (§03 lib/i18n/, §18.2).
 *
 * Dictionnaires STATIQUES de qualité (fr, en, es, ar, zh) — aucune
 * traduction automatique. La table `translations` (§06.2) reste un
 * calque optionnel : ses lignes SURCHARGENT le dictionnaire statique
 * de la locale (écran « Textes d'interface » PHASE 2). Ordre de
 * résolution d'une valeur : table DB de la locale → dictionnaire
 * statique de la locale → dictionnaire statique FR → clé brute
 * (jamais de texte vide).
 *
 * Détection de locale : cookie NEXT_LOCALE (1 an) → en-tête
 * Accept-Language → `fr` (défaut).
 */

export const DEFAULT_LOCALE = "fr" as const;

export const ACTIVE_LOCALES = ["fr", "en", "es", "ar", "zh"] as const;

export type Locale = (typeof ACTIVE_LOCALES)[number];

/** Cookie de locale posé par le sélecteur de langue (durée : 1 an). */
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type { Dictionary };

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

const STATIC_DICTIONARIES: Record<Locale, Dictionary> = {
  fr: frDictionary,
  en: enDictionary,
  es: esDictionary,
  ar: arDictionary,
  zh: zhDictionary,
};

const FR_FALLBACK = frDictionary as unknown as Record<string, string>;

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

/** Sens de lecture de la locale — à brancher sur `<html dir>` dans layout.tsx. */
export function localeDir(locale: string): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** Parse Accept-Language et renvoie la première locale active supportée. */
function localeFromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  const candidates = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { tag: tag.trim().toLowerCase(), q: q ? Number.parseFloat(q.split("=")[1]) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of candidates) {
    const primary = tag.split("-")[0];
    if (isLocale(primary)) return primary;
  }
  return null;
}

/**
 * Locale effective de la requête : cookie NEXT_LOCALE → Accept-Language
 * → `fr`. À utiliser dans les composants serveur (pages dynamiques).
 */
export async function resolveLocale(): Promise<Locale> {
  try {
    const jar = await cookies();
    const cookieLocale = jar.get(LOCALE_COOKIE)?.value;
    if (isLocale(cookieLocale)) return cookieLocale;
  } catch {
    // hors contexte requête (script, seed…) : continuer
  }
  try {
    const h = await headers();
    const fromHeader = localeFromAcceptLanguage(h.get("accept-language"));
    if (fromHeader) return fromHeader;
  } catch {
    // hors contexte requête
  }
  return DEFAULT_LOCALE;
}

interface CacheEntry {
  map: Map<string, string>;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60_000;

const globalForI18n = globalThis as unknown as {
  translationsCache: Map<string, CacheEntry> | undefined;
};

const cache: Map<string, CacheEntry> =
  globalForI18n.translationsCache ?? new Map();

if (process.env.NODE_ENV !== "production") {
  globalForI18n.translationsCache = cache;
}

export function invalidateTranslationCache(): void {
  cache.clear();
  invalidateTags([CACHE_TAGS.translations]);
}

async function loadLocaleMap(locale: string): Promise<Map<string, string>> {
  const entry = cache.get(locale);
  if (entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS) {
    return entry.map;
  }

  // Base : dictionnaire statique de la locale (repli FR pour les clés
  // manquantes, p.ex. clés admin non traduites).
  const base = STATIC_DICTIONARIES[isLocale(locale) ? locale : DEFAULT_LOCALE];
  const map = new Map<string, string>(Object.entries(base));
  for (const [key, value] of Object.entries(FR_FALLBACK)) {
    if (!map.has(key)) map.set(key, value);
  }

  // Calque optionnel : surcharges depuis la table `translations`.
  try {
    const rows = await db.translation.findMany({
      where: { locale },
      select: { key: true, value: true },
    });
    for (const row of rows) {
      if (row.value) map.set(row.key, row.value);
    }
  } catch {
    // base de données indisponible : le dictionnaire statique suffit
  }

  cache.set(locale, { map, fetchedAt: Date.now() });
  return map;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Traduit une clé d'interface. Repli : dictionnaire statique FR → la
 * clé elle-même (jamais de texte vide).
 */
export async function t(
  key: string,
  opts?: {
    locale?: string;
    vars?: Record<string, string | number>;
    fallback?: string;
  }
): Promise<string> {
  const locale = opts?.locale ?? (await resolveLocale());
  const map = await loadLocaleMap(locale);
  let value = map.get(key);

  if (value == null && locale !== DEFAULT_LOCALE) {
    const fallbackMap = await loadLocaleMap(DEFAULT_LOCALE);
    value = fallbackMap.get(key);
  }
  if (value == null && opts?.fallback != null) return opts.fallback;
  if (value == null) return key;

  return interpolate(value, opts?.vars);
}

/**
 * Version liée pour composants serveur : charge la map une fois,
 * puis traduit de manière synchrone. Sans argument, la locale est
 * détectée (cookie NEXT_LOCALE → Accept-Language → fr).
 */
export async function getTranslations(locale?: string) {
  const resolved = locale ?? (await resolveLocale());
  const map = await loadLocaleMap(resolved);
  const fallbackMap =
    resolved !== DEFAULT_LOCALE ? await loadLocaleMap(DEFAULT_LOCALE) : map;

  return {
    locale: resolved,
    translate: (key: string, vars?: Record<string, string | number>): string => {
      const value = map.get(key) ?? fallbackMap.get(key);
      if (value == null) return key;
      return interpolate(value, vars);
    },
  };
}

export type Translator = Awaited<ReturnType<typeof getTranslations>>["translate"];

/** Récupère toutes les traductions d'une locale (écran Textes d'interface). */
export async function getTranslationMap(
  locale: string = DEFAULT_LOCALE
): Promise<Record<string, string>> {
  const map = await loadLocaleMap(locale);
  return Object.fromEntries(map);
}
