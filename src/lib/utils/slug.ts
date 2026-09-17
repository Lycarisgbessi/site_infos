/**
 * Slugification (§06.1 conventions) — insensible aux accents, minuscules,
 * tirets. Utilisée par articles, rubriques, tags, dossiers, pages, entités.
 */

const ACCENTED: Record<string, string> = {
  à: "a", á: "a", â: "a", ä: "a", ã: "a", å: "a",
  è: "e", é: "e", ê: "e", ë: "e",
  ì: "i", í: "i", î: "i", ï: "i",
  ò: "o", ó: "o", ô: "o", ö: "o", õ: "o",
  ù: "u", ú: "u", û: "u", ü: "u",
  ý: "y", ÿ: "y",
  ç: "c", ñ: "n", œ: "oe", æ: "ae",
  "'": "-", "’": "-", "“": "", "”": "", "«": "", "»": "",
};

export function slugify(input: string): string {
  const replaced = input
    .toLowerCase()
    .split("")
    .map((ch) => ACCENTED[ch] ?? ch)
    .join("");
  return (
    replaced
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-")
      .slice(0, 180) || "sans-titre"
  );
}

/** Garantit l'unicité d'un slug dans une table donnée (suffixe -2, -3…). */
export async function ensureUniqueSlug(
  base: string,
  findExisting: (slug: string) => Promise<boolean>
): Promise<string> {
  let candidate = base;
  let i = 2;
  while (await findExisting(candidate)) {
    candidate = `${base}-${i}`;
    i += 1;
    if (i > 100) {
      candidate = `${base}-${Date.now().toString(36)}`;
      break;
    }
  }
  return candidate;
}
