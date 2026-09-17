import { db } from "@/lib/db";
import { CACHE_TAGS, invalidateTags } from "@/lib/cache";

/**
 * Noyau i18n (§03 lib/i18n/, §18.2).
 *
 * Toutes les chaînes d'interface vivent dans la table `translations`
 * (§06.2) — règle absolue §00.2-2 : aucun texte affiché en dur dans le
 * code. Langue principale : `fr` ; architecture prête pour `en` et `ar`
 * (RTL) sans refonte. Cache process invalidable (purge manuelle §16.3,
 * écran « Textes d'interface » PHASE 2).
 */

export const DEFAULT_LOCALE = "fr" as const;

export const ACTIVE_LOCALES = ["fr"] as const;
// Architecture multilingue native (§18.2) : ["fr", "en", "ar"] dès l'arrivée
// de la version anglaise — les clés sont déjà prévues dans le seed.

export type Locale = (typeof DEFAULT_LOCALE) | "en" | "ar";

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

  const rows = await db.translation.findMany({
    where: { locale },
    select: { key: true, value: true },
  });

  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.key, row.value);
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
 * Traduit une clé d'interface. Repli : `fallback` fourni → langue par
 * défaut (`fr`) → la clé elle-même (jamais de texte vide).
 */
export async function t(
  key: string,
  opts?: {
    locale?: string;
    vars?: Record<string, string | number>;
    fallback?: string;
  }
): Promise<string> {
  const locale = opts?.locale ?? DEFAULT_LOCALE;
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
 * puis traduit de manière synchrone.
 */
export async function getTranslations(locale: string = DEFAULT_LOCALE) {
  const map = await loadLocaleMap(locale);
  const fallbackMap =
    locale !== DEFAULT_LOCALE ? await loadLocaleMap(DEFAULT_LOCALE) : map;

  return {
    locale,
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
