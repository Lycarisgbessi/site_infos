import { unstable_cache, revalidateTag } from "next/cache";

/**
 * Helpers de cache (§03 lib/cache.ts) — stratégie §16.3.
 *
 * Tags normatifs utilisés par les Server Actions / Route Handlers admin
 * pour l'invalidation ciblée (`revalidateTag`) conformément au §07.2 :
 *   - `article:{slug}`        → invalidation immédiate à la publication
 *   - `category:{id}`         → pages rubrique
 *   - `homepage`              → accueil piloté par homepage_blocks
 *   - `featured`              → composition de la une
 *   - `flash`, `live`, `weather` → modules courts
 *   - `menu:{key}`            → menus
 *   - `settings`, `translations` → réglages et libellés
 *   - `public-settings`       → réglages publics exposés par l'API
 */

export const CACHE_TAGS = {
  homepage: "homepage",
  featured: "featured",
  flash: "flash",
  live: "live",
  weather: "weather",
  settings: "settings",
  publicSettings: "public-settings",
  translations: "translations",
  menus: "menus",
  mostRead: "most-read",
} as const;

/** Tag d'article : `article:{slug}` (§07.2). */
export function articleTag(slug: string): string {
  return `article:${slug}`;
}

/** Tag de rubrique : `category:{id}` (§07.2). */
export function categoryTag(categoryId: string): string {
  return `category:${categoryId}`;
}

/** Tag d'auteur : `author:{slug}`. */
export function authorTag(slug: string): string {
  return `author:${slug}`;
}

/** Tag de mot-clé éditorial : `tag:{slug}`. */
export function editorialTag(slug: string): string {
  return `tag:${slug}`;
}

/** Tag de dossier : `dossier:{slug}`. */
export function dossierTag(slug: string): string {
  return `dossier:${slug}`;
}

/**
 * Enveloppe de cache avec tags — ISR applicative (§16.3).
 * `revalidate` exprime la durée en secondes par ressource :
 *   article 300 · accueil/rubrique 60 · flash 30 · live 15 · météo 900…
 */
export function cached<T>(
  fn: () => Promise<T>,
  opts: { keyParts: string[]; tags: string[]; revalidate: number }
): () => Promise<T> {
  return unstable_cache(fn, opts.keyParts, {
    tags: opts.tags,
    revalidate: opts.revalidate,
  });
}

/** Invalidation ciblée (§07.2) — profil « max » : purge quelle que
 *  soit la fenêtre de cache utilisée (API Next 16, second argument requis). */
export function invalidateTags(tags: string[]): void {
  for (const tag of tags) {
    revalidateTag(tag, "max");
  }
}

/** Invalidation complète après publication d'un article (§07.2). */
export function invalidateOnArticlePublish(article: {
  slug: string;
  categoryId: string;
}): void {
  invalidateTags([
    articleTag(article.slug),
    categoryTag(article.categoryId),
    CACHE_TAGS.homepage,
    CACHE_TAGS.featured,
    CACHE_TAGS.flash,
    CACHE_TAGS.mostRead,
  ]);
}
