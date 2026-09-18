import { z } from "zod";

/**
 * Schémas Zod des blocs de contenu (§06.4, contractuel).
 * Le corps d'un article est un tableau JSON de blocs — jamais de HTML brut.
 * Chaque bloc porte un `id` stable (nanoid 10).
 */

export const richTextFragmentSchema = z.object({
  text: z.string().max(10_000),
  marks: z
    .array(z.enum(["bold", "italic", "underline", "strike", "code", "sup", "sub"]))
    .max(7)
    .optional(),
  link: z
    .object({
      href: z.string().min(1).max(2000),
      external: z.boolean().optional(),
    })
    .optional(),
});

export const richTextSchema = z.array(richTextFragmentSchema).max(2000);

const blockBase = { id: z.string().min(6).max(32) };

export const blockSchema = z.discriminatedUnion("type", [
  z.object({ ...blockBase, type: z.literal("paragraph"), text: richTextSchema }),
  z.object({
    ...blockBase,
    type: z.literal("heading"),
    level: z.union([z.literal(2), z.literal(3), z.literal(4)]),
    text: z.string().max(500),
    anchor: z.string().max(120).optional(),
  }),
  z.object({
    ...blockBase,
    type: z.literal("list"),
    style: z.enum(["bullet", "number"]),
    items: z.array(richTextSchema).max(300),
  }),
  z.object({
    ...blockBase,
    type: z.literal("quote"),
    text: z.string().max(5000),
    author: z.string().max(200).optional(),
    role: z.string().max(200).optional(),
  }),
  z.object({
    ...blockBase,
    type: z.literal("pullquote"),
    text: z.string().max(1000),
    author: z.string().max(200).optional(),
  }),
  z.object({
    ...blockBase,
    type: z.literal("keypoints"),
    title: z.string().max(200).optional(),
    items: z.array(z.string().max(500)).max(20),
  }),
  z.object({
    ...blockBase,
    type: z.literal("image"),
    mediaId: z.string().min(1),
    size: z.enum(["inline", "wide", "full"]),
    caption: z.string().max(1000).optional(),
  }),
  z.object({
    ...blockBase,
    type: z.literal("gallery"),
    mediaIds: z.array(z.string().min(1)).min(1).max(100),
    layout: z.enum(["grid", "carousel", "mosaic"]),
  }),
  z.object({
    ...blockBase,
    type: z.literal("video"),
    mediaId: z.string().min(1).optional(),
    provider: z.enum(["mux", "youtube"]).optional(),
    playbackId: z.string().max(200).optional(),
    caption: z.string().max(1000).optional(),
    autoplayMuted: z.boolean().optional(),
  }),
  z.object({
    ...blockBase,
    type: z.literal("audio"),
    mediaId: z.string().min(1),
    title: z.string().max(300).optional(),
  }),
  z.object({
    ...blockBase,
    type: z.literal("table"),
    headers: z.array(z.string().max(300)).max(20),
    rows: z.array(z.array(z.string().max(2000)).max(20)).max(500),
    caption: z.string().max(500).optional(),
    source: z.string().max(300).optional(),
  }),
  z.object({
    ...blockBase,
    type: z.literal("embed"),
    provider: z.enum(["x", "facebook", "instagram", "youtube", "tiktok", "iframe"]),
    url: z.string().url().max(2000),
    html: z.string().max(20_000).optional(),
  }),
  z.object({
    ...blockBase,
    type: z.literal("chart"),
    chartType: z.enum(["line", "bar", "pie", "area"]),
    data: z.unknown(),
    source: z.string().min(1).max(300),
    updatedAt: z.string().min(4).max(40),
  }),
  z.object({
    ...blockBase,
    type: z.literal("map"),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    zoom: z.number().min(1).max(20),
    markers: z.array(z.unknown()).max(200).optional(),
  }),
  z.object({
    ...blockBase,
    type: z.literal("timeline"),
    events: z
      .array(
        z.object({
          date: z.string().min(1).max(40),
          title: z.string().min(1).max(300),
          text: z.string().max(2000).optional(),
        })
      )
      .min(1)
      .max(100),
  }),
  z.object({
    ...blockBase,
    type: z.literal("beforeafter"),
    beforeMediaId: z.string().min(1),
    afterMediaId: z.string().min(1),
    labels: z.tuple([z.string().max(100), z.string().max(100)]).optional(),
  }),
  z.object({
    ...blockBase,
    type: z.literal("definition"),
    term: z.string().min(1).max(300),
    definition: z.string().min(1).max(5000),
  }),
  z.object({
    ...blockBase,
    type: z.literal("readmore"),
    articleIds: z.array(z.string().min(1)).min(1).max(20),
  }),
  z.object({
    ...blockBase,
    type: z.literal("qa"),
    question: z.string().min(1).max(1000),
    answer: richTextSchema,
  }),
  z.object({
    ...blockBase,
    type: z.literal("factcheck"),
    claim: z.string().min(1).max(2000),
    verdict: z.enum(["true", "misleading", "false", "unverifiable"]),
    explanation: z.string().min(1).max(10_000),
    sources: z
      .array(z.object({ label: z.string().min(1).max(300), url: z.string().max(2000) }))
      .max(20),
  }),
  z.object({ ...blockBase, type: z.literal("divider") }),
  z.object({
    ...blockBase,
    type: z.literal("code"),
    language: z.string().min(1).max(40),
    code: z.string().max(50_000),
  }),
  z.object({
    ...blockBase,
    type: z.literal("newsletter"),
    listKey: z.string().min(1).max(100),
  }),
  z.object({
    ...blockBase,
    type: z.literal("ad"),
    slotCode: z.string().min(1).max(40),
  }),
]);

export type BlockInput = z.infer<typeof blockSchema>;

export const blocksSchema = z.array(blockSchema).max(1000);
export type BlocksInput = z.infer<typeof blocksSchema>;
