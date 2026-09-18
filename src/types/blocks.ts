/**
 * Format des blocs de contenu (§06.4, contractuel).
 * Le corps d'un article est un tableau JSON de blocs — jamais de HTML brut.
 * Chaque bloc porte un `id` stable (nanoid 10) servant d'ancre aux
 * commentaires de relecture et au sommaire d'article.
 */

export type RichTextMark =
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "code"
  | "sup"
  | "sub";

export interface RichTextFragment {
  text: string;
  marks?: RichTextMark[];
  link?: { href: string; external?: boolean };
}

export type RichText = RichTextFragment[];

export type Block =
  | { id: string; type: "paragraph"; text: RichText }
  | { id: string; type: "heading"; level: 2 | 3 | 4; text: string; anchor?: string }
  | { id: string; type: "list"; style: "bullet" | "number"; items: RichText[] }
  | { id: string; type: "quote"; text: string; author?: string; role?: string }
  | { id: string; type: "pullquote"; text: string; author?: string }
  | { id: string; type: "keypoints"; title?: string; items: string[] } // "À retenir"
  | {
      id: string;
      type: "image";
      mediaId: string;
      size: "inline" | "wide" | "full";
      caption?: string;
    }
  | { id: string; type: "gallery"; mediaIds: string[]; layout: "grid" | "carousel" | "mosaic" }
  | {
      id: string;
      type: "video";
      mediaId?: string;
      provider?: "mux" | "youtube";
      playbackId?: string;
      caption?: string;
      autoplayMuted?: boolean;
    }
  | { id: string; type: "audio"; mediaId: string; title?: string }
  | {
      id: string;
      type: "table";
      headers: string[];
      rows: string[][];
      caption?: string;
      source?: string;
    }
  | {
      id: string;
      type: "embed";
      provider: "x" | "facebook" | "instagram" | "youtube" | "tiktok" | "iframe";
      url: string;
      html?: string;
    }
  | {
      id: string;
      type: "chart";
      chartType: "line" | "bar" | "pie" | "area";
      data: unknown;
      source: string;
      updatedAt: string;
    }
  | { id: string; type: "map"; lat: number; lng: number; zoom: number; markers?: unknown[] }
  | { id: string; type: "timeline"; events: { date: string; title: string; text?: string }[] }
  | {
      id: string;
      type: "beforeafter";
      beforeMediaId: string;
      afterMediaId: string;
      labels?: [string, string];
    }
  | { id: string; type: "definition"; term: string; definition: string }
  | { id: string; type: "readmore"; articleIds: string[] }
  | { id: string; type: "qa"; question: string; answer: RichText } // interviews
  | {
      id: string;
      type: "factcheck";
      claim: string;
      verdict: "true" | "misleading" | "false" | "unverifiable";
      explanation: string;
      sources: { label: string; url: string }[];
    }
  | { id: string; type: "divider" }
  | { id: string; type: "code"; language: string; code: string }
  | { id: string; type: "newsletter"; listKey: string }
  | { id: string; type: "ad"; slotCode: string };

/** Types de blocs autorisés — liste contractuelle §05.4/§06.4. */
export const BLOCK_TYPES = [
  "paragraph",
  "heading",
  "list",
  "quote",
  "pullquote",
  "keypoints",
  "image",
  "gallery",
  "video",
  "audio",
  "table",
  "embed",
  "chart",
  "map",
  "timeline",
  "beforeafter",
  "definition",
  "readmore",
  "qa",
  "factcheck",
  "divider",
  "code",
  "newsletter",
  "ad",
] as const;

export function isBlock(value: unknown): value is Block {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "type" in value &&
    typeof (value as Block).type === "string" &&
    (BLOCK_TYPES as readonly string[]).includes((value as Block).type)
  );
}

/** Source of truth runtime : blocs sérialisés dans articles.body (D-01). */
export function parseBlocks(body: string | null | undefined): Block[] {
  if (!body) return [];
  try {
    const parsed = JSON.parse(body) as unknown;
    if (Array.isArray(parsed)) return parsed.filter(isBlock);
    return [];
  } catch {
    return [];
  }
}
