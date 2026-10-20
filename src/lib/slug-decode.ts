/**
 * Décode un segment d'URL dynamique.
 *
 * Dans Next.js App Router, les segments peuvent arriver percent-encodés
 * (« lev%C3%A9e ») alors que les slugs en base contiennent les caractères
 * décodés (« levée »). Sans décodage, les slugs accentués ne retrouvent
 * pas leur contenu (404).
 */
export function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    // Séquence d'échappement invalide : utiliser la valeur brute
    return raw;
  }
}
