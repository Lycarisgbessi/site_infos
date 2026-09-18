/**
 * Score SEO local (§11.2 panneau SEO « score SEO en direct »).
 *
 * Calcul déterministe côté serveur, sans service externe — le socle
 * mots-clés §12 (GSC, DataForSEO, LLM) arrive en Phase 6 et enrichira les
 * « mots-clés suggérés » ; le score en direct reste calculé localement
 * pour ne jamais dépendre d'une clé d'API pendant la frappe.
 */

export interface SeoCheck {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail?: string;
}

export interface SeoScoreResult {
  score: number; // 0–100
  checks: SeoCheck[];
}

interface SeoScoreInput {
  title: string;
  lede: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  plainText: string;
  wordCount: number;
  internalLinkCount: number;
  hasCoverImage: boolean;
  coverAlt: string;
  coverCredit: string;
  tagsCount: number;
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase().trim();
  if (!n) return 0;
  let count = 0;
  let pos = h.indexOf(n);
  while (pos !== -1) {
    count += 1;
    pos = h.indexOf(n, pos + n.length);
  }
  return count;
}

export function computeSeoScore(input: SeoScoreInput): SeoScoreResult {
  const checks: SeoCheck[] = [];
  let score = 0;
  const kw = input.focusKeyword?.trim() ?? "";

  // Titre (15 pts)
  const titleLen = input.title.length;
  if (titleLen >= 20 && titleLen <= 120) {
    score += 15;
    checks.push({ id: "title", label: "Titre — longueur adaptée", status: "pass" });
  } else if (titleLen > 0) {
    score += 7;
    checks.push({
      id: "title",
      label: "Titre — longueur",
      status: "warn",
      detail: "20 à 120 caractères recommandés.",
    });
  } else {
    checks.push({ id: "title", label: "Titre absent", status: "fail" });
  }

  // Mot-clé cible présent dans le titre (15 pts)
  if (kw && countOccurrences(input.title, kw) > 0) {
    score += 15;
    checks.push({ id: "kw_title", label: "Mot-clé cible présent dans le titre", status: "pass" });
  } else {
    checks.push({
      id: "kw_title",
      label: "Mot-clé cible absent du titre",
      status: kw ? "fail" : "warn",
    });
  }

  // Mot-clé dans le chapô (10 pts) et dans le slug (10 pts)
  if (kw && countOccurrences(input.lede, kw) > 0) {
    score += 10;
    checks.push({ id: "kw_lede", label: "Mot-clé présent dans le chapô", status: "pass" });
  } else {
    checks.push({ id: "kw_lede", label: "Mot-clé absent du chapô", status: kw ? "fail" : "warn" });
  }

  if (kw && input.slug.includes(kw.toLowerCase().replace(/\s+/g, "-"))) {
    score += 10;
    checks.push({ id: "kw_slug", label: "Mot-clé présent dans le slug", status: "pass" });
  } else {
    checks.push({ id: "kw_slug", label: "Mot-clé absent du slug", status: kw ? "fail" : "warn" });
  }

  // Densité du mot-clé dans le corps (15 pts) — 0,4 % à 2,5 %
  if (kw && input.wordCount > 0) {
    const occurrences = countOccurrences(input.plainText, kw);
    const density = (occurrences * kw.split(/\s+/).length * 100) / input.wordCount;
    if (occurrences > 0 && density >= 0.4 && density <= 2.5) {
      score += 15;
      checks.push({
        id: "density",
        label: "Densité du mot-clé",
        status: "pass",
        detail: `${density.toFixed(1)} %`,
      });
    } else if (occurrences > 0) {
      score += 6;
      checks.push({
        id: "density",
        label: "Densité du mot-clé hors plage (0,4–2,5 %)",
        status: "warn",
        detail: `${density.toFixed(1)} %`,
      });
    } else {
      checks.push({ id: "density", label: "Mot-clé absent du corps", status: "fail" });
    }
  } else {
    checks.push({ id: "density", label: "Densité — mot-clé manquant", status: "warn" });
  }

  // Méta-description (10 pts) — 80 à 160 caractères idéalement
  const metaLen = input.metaDescription.length;
  if (metaLen >= 80 && metaLen <= 160) {
    score += 10;
    checks.push({ id: "meta", label: "Méta-description — longueur adaptée", status: "pass" });
  } else if (metaLen > 0) {
    score += 4;
    checks.push({
      id: "meta",
      label: "Méta-description — longueur",
      status: "warn",
      detail: "80 à 160 caractères recommandés.",
    });
  } else {
    checks.push({ id: "meta", label: "Méta-description absente", status: "fail" });
  }

  // Liens internes (10 pts)
  if (input.internalLinkCount >= 1) {
    score += 10;
    checks.push({
      id: "links",
      label: "Liens internes",
      status: "pass",
      detail: `${input.internalLinkCount} lien(s)`,
    });
  } else {
    checks.push({ id: "links", label: "Aucun lien interne", status: "warn" });
  }

  // Image principale + alt (10 pts)
  if (input.hasCoverImage && input.coverAlt.length >= 10) {
    score += 10;
    checks.push({ id: "cover", label: "Image principale avec texte alternatif", status: "pass" });
  } else if (input.hasCoverImage) {
    score += 4;
    checks.push({ id: "cover", label: "Texte alternatif trop court", status: "warn" });
  } else {
    checks.push({ id: "cover", label: "Aucune image principale", status: "fail" });
  }

  // Mots-clés éditoriaux (5 pts)
  if (input.tagsCount >= 1) {
    score += 5;
    checks.push({ id: "tags", label: "Mots-clés éditoriaux", status: "pass" });
  } else {
    checks.push({ id: "tags", label: "Aucun mot-clé éditorial", status: "fail" });
  }

  return { score: Math.max(0, Math.min(100, score)), checks };
}
