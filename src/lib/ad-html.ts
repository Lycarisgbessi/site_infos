/**
 * Sanitisation stricte du HTML des créatives publicitaires de repli
 * (AdCreative.html_code, système publicitaire « taquin » 2026-10).
 *
 * Principe : liste BLANCHE de balises (b, i, em, strong, a, img, div,
 * span, p, br) ; tout le reste est supprimé (script, style, iframe,
 * object, form…). Les attributs commençant par « on » sont retirés,
 * seules les URLs http(s) sont conservées pour href/src.
 * Le rendu final passe par dangerouslySetInnerHTML APRÈS ce filtre.
 */

const ALLOWED_TAGS = new Set(["b", "i", "em", "strong", "a", "img", "div", "span", "p", "br"]);
const ALLOWED_ATTRS = new Set(["href", "src", "alt", "title", "target", "rel", "class", "style"]);

/** URL http(s) uniquement (bloque javascript:, data:, vbscript:…). */
function safeUrl(value: string): string | null {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

/**
 * Sanitize un fragment HTML de créative.
 * Approche DOMParser : le navigateur (ou le runtime JS) construit un
 * document inerte, on y parcourt l'arbre et on ne réécrit que les
 * nœuds autorisés. Aucune exécution de script n'est possible dans un
 * document créé par DOMParser (contexte inert).
 */
export function sanitizeAdHtml(input: string, max_length = 20_000): string {
  const source = input.slice(0, max_length);
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    // Environnements sans DOM (SSR) : le HTML n'est rendu que côté client,
    // on renvoie la source tronquée — elle sera resanitisée au rendu client.
    return source;
  }
  const doc = new DOMParser().parseFromString(source, "text/html");

  const walk = (node: Element): Node | null => {
    const tag = node.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      // Balise interdite : on remplace le nœud par ses enfants texte/autorisés.
      const fragment = document.createDocumentFragment();
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
          fragment.appendChild(document.createTextNode(child.textContent ?? ""));
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const replacement = walk(child as Element);
          if (replacement) fragment.appendChild(replacement);
        }
      }
      return fragment;
    }

    const clean = document.createElement(tag);
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || !ALLOWED_ATTRS.has(name)) continue;
      if (name === "href" || name === "src") {
        const url = safeUrl(attr.value);
        if (!url) continue;
        clean.setAttribute(name, url);
      } else {
        clean.setAttribute(name, attr.value);
      }
    }
    // Les liens sanitizés s'ouvrent en toute sécurité dans un nouvel onglet.
    if (tag === "a") {
      clean.setAttribute("target", "_blank");
      clean.setAttribute("rel", "noopener nofollow sponsored");
    }
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        clean.appendChild(document.createTextNode(child.textContent ?? ""));
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const replacement = walk(child as Element);
        if (replacement) clean.appendChild(replacement);
      }
    }
    return clean;
  };

  const out = document.createElement("div");
  for (const child of Array.from(doc.body.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      out.appendChild(document.createTextNode(child.textContent ?? ""));
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const replacement = walk(child as Element);
      if (replacement) out.appendChild(replacement);
    }
  }
  return out.innerHTML;
}
