import { parse, type HTMLElement } from "node-html-parser";
import type { Block, RichText, RichTextMark } from "@/types/blocks";
import { newBlockId } from "@/lib/blocks";

/**
 * Import Word / Google Docs → blocs (§20 Phase 2, tâche 10 ; §11.2 :
 * « Collage intelligent depuis Word/Google Docs avec conversion propre en
 * blocs »).
 *
 * Le convertisseur est serveur et unique : l'import de fichier .docx
 * (mammoth → HTML) et le collage riche (text/html du presse-papiers)
 * convergent vers `htmlToBlocks`. Jamais de HTML brut en base (§06.4).
 *
 * Choix documentés :
 * - images en `data:` URL → téléversées vers la médiathèque via le callback
 *   fourni (variantes AVIF/WebP, EXIF retirés — cf. services/media) ;
 * - images avec URL externe → NON récupérées (risque SSRF, §17.1) : un
 *   avertissement est retourné et un paragraphe marqueur remplace l'image ;
 * - `H1` importé est rabattu en `H2` (le titre de l'article n'appartient pas
 *   au corps) ;
 * - les listes imbriquées sont aplaties avec un tiret cadratin d'invite.
 */

export interface HtmlToBlocksOptions {
  /**
   * Téléverse une image (data: URL) vers la médiathèque et renvoie l'id du
   * média créé, ou null en cas d'échec (un avertissement est alors émis).
   */
  uploadImage?: (dataUrl: string, suggestedName: string) => Promise<string | null>;
}

export interface HtmlToBlocksResult {
  blocks: Block[];
  warnings: string[];
}

const MARK_TAGS: Record<string, RichTextMark> = {
  b: "bold",
  strong: "bold",
  i: "italic",
  em: "italic",
  u: "underline",
  s: "strike",
  strike: "strike",
  del: "strike",
  code: "code",
  sup: "sup",
  sub: "sub",
};

const MAX_IMPORT_BYTES = 5 * 1024 * 1024; // HTML de collage plafonné

/** Nettoie le HTML Word/Docs avant analyse (balises propriétaires, styles). */
function sanitizeHtml(html: string): string {
  if (html.length > MAX_IMPORT_BYTES) {
    throw new Error("Contenu trop volumineux à importer (max 5 Mo).");
  }
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/?o(:p|l|u)[^>]*>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<xml[\s\S]*?<\/xml>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<meta[^>]*>/gi, "")
    .replace(/\sclass="[^"]*"/gi, "")
    .replace(/\sstyle="[^"]*"/gi, "")
    .replace(/\sdir="[^"]*"/gi, "");
}

function textOf(node: HTMLElement): string {
  return (node.textContent ?? "").replace(/\u00a0/g, " ").trim();
}

function slugifyAnchor(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Conversion en ligne : HTML → fragments RichText avec marques cumulées. */
function inlineToRichText(
  node: HTMLElement,
  marks: RichTextMark[] = [],
  link?: { href: string; external?: boolean }
): RichText {
  const out: RichText = [];
  for (const child of node.childNodes) {
    if (child.nodeType === 3) {
      const raw = (child.text ?? child.rawText ?? "").replace(/\u00a0/g, " ");
      if (raw.length === 0) continue;
      const fragment: RichText[number] = { text: raw };
      if (marks.length > 0) fragment.marks = [...marks];
      if (link) fragment.link = link;
      out.push(fragment);
      continue;
    }
    if (child.nodeType !== 1) continue;
    const el = child as HTMLElement;
    const tag = el.rawTagName?.toLowerCase() ?? "";
    if (tag === "br") {
      out.push({ text: " " });
      continue;
    }
    if (tag === "a") {
      const href = (el.getAttribute("href") ?? "").trim();
      if (!href) {
        out.push(...inlineToRichText(el, marks));
        continue;
      }
      const external = !href.startsWith("/") && !href.startsWith("#");
      out.push(...inlineToRichText(el, marks, { href, external }));
      continue;
    }
    const mark = MARK_TAGS[tag];
    if (mark) {
      const next = marks.includes(mark) ? marks : [...marks, mark];
      out.push(...inlineToRichText(el, next, link));
      continue;
    }
    // Span / small / autres conteneurs en ligne : on descend.
    out.push(...inlineToRichText(el, marks, link));
  }
  return out;
}

function richTextOfItem(li: HTMLElement): RichText {
  // Les puces Word contiennent parfois des <p> : on concatène leurs lignes.
  const paragraphs = li.querySelectorAll(":scope > p");
  if (paragraphs.length > 1) {
    const merged: RichText = [];
    paragraphs.forEach((p, i) => {
      if (i > 0) merged.push({ text: " — " });
      merged.push(...inlineToRichText(p));
    });
    return merged.length > 0 ? merged : [{ text: textOf(li) }];
  }
  const rich = inlineToRichText(li);
  return rich.length > 0 ? rich : [{ text: textOf(li) }];
}

type ImageUploader = NonNullable<HtmlToBlocksOptions["uploadImage"]>;

async function imageBlock(
  src: string,
  caption: string | null,
  index: number,
  warnings: string[],
  uploadImage?: ImageUploader
): Promise<Block | null> {
  if (src.startsWith("data:")) {
    if (!uploadImage) {
      warnings.push(`Image n°${index + 1} ignorée (téléversement indisponible).`);
      return null;
    }
    const mime = /^data:([^;,]+)/.exec(src)?.[1] ?? "image/png";
    const ext = mime.includes("jpeg")
      ? "jpg"
      : mime.includes("png")
        ? "png"
        : mime.includes("gif")
          ? "gif"
          : "img";
    try {
      const mediaId = await uploadImage(src, `import-image-${Date.now()}-${index + 1}.${ext}`);
      if (mediaId) {
        const block: Block = { id: newBlockId(), type: "image", mediaId, size: "inline" };
        if (caption) block.caption = caption;
        return block;
      }
      warnings.push(`Image n°${index + 1} non téléversée (échec du service de médias).`);
      return null;
    } catch {
      warnings.push(`Image n°${index + 1} non téléversée (échec du service de médias).`);
      return null;
    }
  }
  // URL externe : jamais récupérée côté serveur (SSRF, §17.1).
  warnings.push(`Image externe non importée (n°${index + 1}) — à téléverser depuis la médiathèque.`);
  const marker: Block = {
    id: newBlockId(),
    type: "paragraph",
    text: [{ text: `[Image à insérer : ${src.slice(0, 200)}]`, marks: ["italic"] }],
  };
  if (caption) marker.text.push({ text: ` — ${caption}`, marks: ["italic"] });
  return marker;
}

function tableBlock(table: HTMLElement): Extract<Block, { type: "table" }> {
  const rows = table.querySelectorAll("tr");
  const headers: string[] = [];
  const bodyRows: string[][] = [];
  rows.forEach((tr, rowIndex) => {
    const cells = tr.querySelectorAll("th, td");
    const values = cells.map((c) => textOf(c));
    if (rowIndex === 0 && tr.querySelectorAll("th").length > 0) {
      headers.push(...values);
    } else {
      bodyRows.push(values);
    }
  });
  return { id: newBlockId(), type: "table", headers, rows: bodyRows };
}

/** Parse du HTML Word/Google Docs en blocs contractuels (§06.4). */
export async function htmlToBlocks(
  html: string,
  options?: HtmlToBlocksOptions
): Promise<HtmlToBlocksResult> {
  const warnings: string[] = [];
  const blocks: Block[] = [];
  let imageIndex = 0;

  const root = parse(sanitizeHtml(html));
  const container = root.querySelector("body") ?? root;

  const KNOWN_CHILDREN = new Set([
    "p", "h1", "h2", "h3", "h4", "ul", "ol", "table",
    "blockquote", "figure", "img", "div", "pre", "hr",
  ]);

  const walk = async (nodes: HTMLElement[]): Promise<void> => {
    for (const node of nodes) {
      const tag = node.rawTagName?.toLowerCase() ?? "";
      switch (tag) {
        case "h1":
        case "h2":
        case "h3":
        case "h4": {
          const text = textOf(node);
          if (!text) break;
          if (tag === "h1") warnings.push("Un titre de niveau 1 a été rabattu en niveau 2.");
          const level = tag === "h1" ? 2 : (Number(tag.slice(1)) as 2 | 3 | 4);
          blocks.push({ id: newBlockId(), type: "heading", level, text, anchor: slugifyAnchor(text) });
          break;
        }
        case "p": {
          const innerImages = node.querySelectorAll("img, figure");
          if (innerImages.length > 0) {
            await walk(node.querySelectorAll("figure, img") as unknown as HTMLElement[]);
            const trailing = inlineToRichText(node).filter((f) => f.text.trim().length > 0);
            if (trailing.length > 0) {
              blocks.push({ id: newBlockId(), type: "paragraph", text: trailing });
            }
            break;
          }
          const rich = inlineToRichText(node);
          if (rich.some((f) => f.text.trim().length > 0)) {
            blocks.push({ id: newBlockId(), type: "paragraph", text: rich });
          }
          break;
        }
        case "ul":
        case "ol": {
          const items: RichText[] = [];
          const collectTop = (listNode: HTMLElement): void => {
            for (const li of listNode.querySelectorAll(":scope > li")) {
              const subLists = li.querySelectorAll(":scope > ul, :scope > ol");
              const ownRich = ((): RichText => {
                const clone = li;
                subLists.forEach((sub) => sub.remove());
                return richTextOfItem(clone);
              })();
              items.push(ownRich);
              subLists.forEach((sub) => {
                warnings.push("Liste imbriquée aplatie avec des tirets cadratins.");
                for (const subLi of sub.querySelectorAll(":scope > li")) {
                  items.push([{ text: "— " }, ...richTextOfItem(subLi)]);
                }
              });
            }
          };
          collectTop(node);
          if (items.length > 0) {
            blocks.push({
              id: newBlockId(),
              type: "list",
              style: tag === "ol" ? "number" : "bullet",
              items,
            });
          }
          break;
        }
        case "blockquote": {
          const text = textOf(node);
          if (!text) break;
          const cite = node.querySelector("cite");
          const block: Block = { id: newBlockId(), type: "quote", text };
          if (cite) block.author = textOf(cite);
          blocks.push(block);
          break;
        }
        case "figure": {
          const img = node.querySelector("img");
          const captionEl = node.querySelector("figcaption");
          if (img) {
            const src = (img.getAttribute("src") ?? "").trim();
            if (src) {
              const block = await imageBlock(
                src,
                captionEl ? textOf(captionEl) : null,
                imageIndex++,
                warnings,
                options?.uploadImage
              );
              if (block) blocks.push(block);
            }
          } else if (captionEl) {
            const text = textOf(captionEl);
            if (text) {
              blocks.push({ id: newBlockId(), type: "paragraph", text: [{ text, marks: ["italic"] }] });
            }
          }
          break;
        }
        case "img": {
          const src = (node.getAttribute("src") ?? "").trim();
          if (src) {
            const block = await imageBlock(src, null, imageIndex++, warnings, options?.uploadImage);
            if (block) blocks.push(block);
          }
          break;
        }
        case "table": {
          const block = tableBlock(node);
          if (block.rows.length > 0 || block.headers.length > 0) blocks.push(block);
          break;
        }
        case "pre": {
          const code = node.textContent ?? "";
          if (code.trim()) {
            blocks.push({ id: newBlockId(), type: "code", language: "text", code: code.replace(/\n$/, "") });
          }
          break;
        }
        case "hr": {
          blocks.push({ id: newBlockId(), type: "divider" });
          break;
        }
        default: {
          // Conteneurs Word/Docs (div, section, span, font…) : on recurse ;
          // s'ils ne portent aucun enfant connu, leur texte devient un
          // paragraphe.
          const elementChildren = node.childNodes.filter((c) => c.nodeType === 1) as HTMLElement[];
          const hasKnownChild = elementChildren.some((c) =>
            KNOWN_CHILDREN.has(c.rawTagName?.toLowerCase() ?? "")
          );
          if (!hasKnownChild && elementChildren.length === 0) {
            const text = textOf(node);
            if (text) blocks.push({ id: newBlockId(), type: "paragraph", text: [{ text }] });
          } else if (elementChildren.length > 0) {
            await walk(elementChildren);
          }
        }
      }
    }
  };

  await walk(container.querySelectorAll(":scope > *") as unknown as HTMLElement[]);

  // Cas dégénéré : collage de texte brut (aucune balise reconnue).
  if (blocks.length === 0) {
    const plain = (root.text ?? "").replace(/\u00a0/g, " ").trim();
    if (plain) {
      for (const para of plain.split(/\n{2,}/)) {
        const text = para.trim();
        if (text) {
          blocks.push({ id: newBlockId(), type: "paragraph", text: [{ text: text.replace(/\n/g, " ") }] });
        }
      }
    }
  }

  return { blocks, warnings };
}
