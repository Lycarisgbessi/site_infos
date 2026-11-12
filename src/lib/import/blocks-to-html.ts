import type { Block, RichText, RichTextFragment } from "@/types/blocks";

/**
 * Conversion Blocs §06.4 → HTML pour le « Mode simple » de rédaction
 * (éditeur riche type Word). La conversion retour (HTML → blocs) est
 * assurée par htmlToBlocks, étendu pour reconnaître :
 *  - <img data-media-id="…"> → bloc image (médiathèque)
 *  - <figure data-video="url"> → bloc embed (YouTube/Drive/iframe)
 *  - <figure data-audio="url"> → bloc audio
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fragmentHtml(f: RichTextFragment): string {
  let inner = escapeHtml(f.text);
  if (f.marks?.includes("bold")) inner = `<strong>${inner}</strong>`;
  if (f.marks?.includes("italic")) inner = `<em>${inner}</em>`;
  if (f.marks?.includes("underline")) inner = `<u>${inner}</u>`;
  if (f.marks?.includes("strike")) inner = `<s>${inner}</s>`;
  if (f.marks?.includes("highlight")) inner = `<mark>${inner}</mark>`;
  if (f.marks?.includes("code")) inner = `<code>${inner}</code>`;
  if (f.link) {
    const href = escapeHtml(f.link.href);
    inner = `<a href="${href}">${inner}</a>`;
  }
  return inner;
}

function richHtml(rich: RichText): string {
  return rich.map(fragmentHtml).join("");
}

/** Convertit les blocs éditables en HTML ; les blocs non représentables
 *  en mode simple sont rendus en paragraphes signalés (⚠). */
export function blocksToHtml(blocks: Block[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "heading":
        out.push(`<h${b.level}>${escapeHtml(b.text)}</h${b.level}>`);
        break;
      case "paragraph":
        out.push(`<p>${richHtml(b.text)}</p>`);
        break;
      case "quote":
        out.push(`<blockquote>${escapeHtml(b.text ?? "")}</blockquote>`);
        break;
      case "image":
        // mediaId conservé pour la reconversion ; l'URL d'aperçu est
        // re-résolue par l'éditeur simple via la médiathèque.
        out.push(
          `<img data-media-id="${b.mediaId}" src="#media-${b.mediaId}" alt="${escapeHtml(b.caption ?? "")}" />`
        );
        break;
      case "video":
        if (b.provider === "youtube" && b.playbackId) {
          out.push(`<figure data-video="https://www.youtube.com/watch?v=${b.playbackId}">🎬 Vidéo YouTube</figure>`);
        } else if (b.mediaId) {
          out.push(`<figure data-video="media:${b.mediaId}">🎬 Vidéo</figure>`);
        }
        break;
      case "audio":
        if (b.url) {
          out.push(`<figure data-audio="${escapeHtml(b.url)}" ${b.driveUrl ? `data-drive="${escapeHtml(b.driveUrl)}"` : ""}>🎧 Audio</figure>`);
        } else if (b.mediaId) {
          out.push(`<figure data-audio="media:${b.mediaId}">🎧 Audio</figure>`);
        }
        break;
      case "embed":
        out.push(`<figure data-video="${escapeHtml(b.url)}">🔗 Intégration ${b.provider}</figure>`);
        break;
      case "readmore":
        out.push(`<p>⚠ Bloc « À lire aussi » (${b.articleIds.length} article(s)) — conservé en mode blocs.</p>`);
        break;
      default:
        out.push(`<p>⚠ Bloc « ${b.type} » conservé en mode blocs.</p>`);
    }
  }
  return out.join("\n");
}
