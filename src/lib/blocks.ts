import { nanoid } from "nanoid";
import type { Block, RichText } from "@/types/blocks";

/**
 * Helpers de traitement des blocs (§06.4) :
 * - id stable nanoid 10 ;
 * - `plain_text` régénéré à chaque enregistrement (recherche, comptage
 *   de mots, densité de mots-clés) ;
 * - temps de lecture = ceil(word_count / 220) (§09.2).
 */

export function newBlockId(): string {
  return nanoid(10);
}

function richTextToPlainText(rich: RichText): string {
  return rich.map((fragment) => fragment.text).join("");
}

/** Concatène les textes de tous les blocs en texte brut (§06.4). */
export function plainTextFromBlocks(blocks: Block[]): string {
  const parts: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "paragraph":
        parts.push(richTextToPlainText(block.text));
        break;
      case "heading":
        parts.push(block.text);
        break;
      case "list":
        for (const item of block.items) {
          parts.push(richTextToPlainText(item));
        }
        break;
      case "quote":
      case "pullquote":
        parts.push(block.text);
        if ("author" in block && block.author) parts.push(block.author);
        break;
      case "keypoints":
        if (block.title) parts.push(block.title);
        parts.push(...block.items);
        break;
      case "image":
        if (block.caption) parts.push(block.caption);
        break;
      case "video":
      case "audio":
        if ("caption" in block && block.caption) parts.push(block.caption);
        if ("title" in block && block.title) parts.push(block.title);
        break;
      case "table":
        if (block.caption) parts.push(block.caption);
        parts.push(...block.headers);
        for (const row of block.rows) parts.push(...row);
        break;
      case "timeline":
        for (const event of block.events) {
          parts.push(event.date, event.title, event.text ?? "");
        }
        break;
      case "definition":
        parts.push(block.term, block.definition);
        break;
      case "qa":
        parts.push(block.question, richTextToPlainText(block.answer));
        break;
      case "factcheck":
        parts.push(block.claim, block.explanation);
        for (const source of block.sources) parts.push(source.label);
        break;
      default:
        // image galleries, embeds, charts, maps, dividers… : pas de texte
        break;
    }
  }

  return parts.filter((part) => part.trim().length > 0).join("\n");
}

export function countWords(plainText: string): number {
  const trimmed = plainText.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/** Temps de lecture en minutes, arrondi supérieur (§09.2). */
export function readingTime(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 220));
}

/** Métadonnées dérivées d'un corps de blocs — à recalculer à chaque enregistrement. */
export function deriveBodyMetadata(blocks: Block[]): {
  plain_text: string;
  word_count: number;
  reading_time_min: number;
} {
  const plain_text = plainTextFromBlocks(blocks);
  const word_count = countWords(plain_text);
  return { plain_text, word_count, reading_time_min: readingTime(word_count) };
}
