import sharp from "sharp";
import { db } from "@/lib/db";
import { putObject, deleteObject, checksumOf } from "@/lib/storage";
import { stringifyJsonArray, stringifyJsonObject, parseJsonObject } from "@/lib/json";
import { auditLog } from "@/lib/audit";
import { ValidationError } from "@/lib/api/respond";
import type { mediaMetaUpdateSchema, mediaListQuerySchema } from "@/schemas/media-structure";
import type { z } from "zod";

/**
 * Médiathèque (§11.2 /admin/medias, §06.2 media) :
 * - téléversement multiple, métadonnées obligatoires (titre, alt, crédit, licence) ;
 * - conversion AVIF/WebP ×6 largeurs (320, 640, 960, 1280, 1600, 2000) ;
 * - suppression des EXIF sensibles (GPS) — sharp réencode sans métadonnées ;
 * - détection de doublons par checksum SHA-256 ;
 * - point focal par défaut au centre ;
 * - affichage des contenus utilisant le média avant suppression ;
 * - corbeille 30 j + purge des orphelins.
 */

const VARIANT_WIDTHS = [320, 640, 960, 1280, 1600, 2000] as const;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 Mo
const TRASH_RETENTION_DAYS = 30;

const ALLOWED_MIME: Record<string, "image" | "video" | "audio" | "document"> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/avif": "image",
  "image/gif": "image",
  "video/mp4": "video",
  "video/quicktime": "video",
  "audio/mpeg": "audio",
  "audio/mp4": "audio",
  "audio/wav": "audio",
  "application/pdf": "document",
};

interface MediaVariant {
  w: number;
  format: string;
  url: string;
  size: number;
}

export interface UploadMediaInput {
  name: string;
  mimeType: string;
  buffer: Buffer;
  title?: string;
  alt_text?: string;
  caption?: string;
  credit?: string;
  license?: string;
}

export async function uploadMedia(
  input: UploadMediaInput,
  userId: string,
  opts: { skipDuplicate?: boolean } = {}
): Promise<{ media: { id: string; url: string; duplicate: boolean }; warning?: string }> {
  const kind = ALLOWED_MIME[input.mimeType];
  if (!kind) {
    throw new ValidationError(`Type de fichier non pris en charge : ${input.mimeType}`);
  }
  if (input.buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new ValidationError("Fichier trop volumineux (max 25 Mo).");
  }

  const checksum = checksumOf(input.buffer);

  // Doublons (§11.2) : même checksum, non supprimé
  if (!opts.skipDuplicate) {
    const dupe = await db.media.findFirst({
      where: { checksum, deleted_at: null },
      select: { id: true, title: true, url: true },
    });
    if (dupe) {
      return {
        media: { id: dupe.id, url: dupe.url, duplicate: true },
        warning: `Doublon détecté : identique à « ${dupe.title ?? dupe.id} » (médiathèque).`,
      };
    }
  }

  const isImage = kind === "image";
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const baseName = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  let width: number | null = null;
  let height: number | null = null;
  const variants: MediaVariant[] = [];
  let originalKey: string;
  let originalUrl: string;

  if (isImage) {
    // EXIF sensibles supprimés : sharp réencode sans métadonnées ;
    // rotate() applique l'orientation EXIF puis la retire.
    const pipeline = sharp(input.buffer, { failOn: "none" }).rotate();
    const meta = await pipeline.metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;

    // Original (WebP de qualité 90, sans EXIF)
    const originalBuffer = await pipeline.clone().webp({ quality: 90 }).toBuffer();
    originalKey = `${yyyy}/${mm}/${baseName}.webp`;
    const putOrig = await putObject(originalKey, originalBuffer, "image/webp");
    originalUrl = putOrig.url;
    variants.push({ w: meta.width ?? 0, format: "webp", url: putOrig.url, size: originalBuffer.byteLength });

    // Variantes AVIF/WebP ×6 largeurs (§11.2)
    for (const w of VARIANT_WIDTHS) {
      if (width && w >= width * 1.25) continue; // pas d'agrandissement inutile
      const resized = pipeline.clone().resize({ width: w, withoutEnlargement: true });
      const webp = await resized.clone().webp({ quality: 82 }).toBuffer();
      const webpPut = await putObject(`${yyyy}/${mm}/${baseName}-${w}.webp`, webp, "image/webp");
      variants.push({ w, format: "webp", url: webpPut.url, size: webp.byteLength });
      try {
        const avif = await resized.clone().avif({ quality: 60 }).toBuffer();
        const avifPut = await putObject(`${yyyy}/${mm}/${baseName}-${w}.avif`, avif, "image/avif");
        variants.push({ w, format: "avif", url: avifPut.url, size: avif.byteLength });
      } catch {
        // AVIF indisponible sur cette plateforme sharp : WebP seul, journalisé au seed
      }
    }
  } else {
    originalKey = `${yyyy}/${mm}/${baseName}-${input.name.replace(/[^\w.\-]/g, "_")}`;
    const put = await putObject(originalKey, input.buffer, input.mimeType);
    originalUrl = put.url;
  }

  const media = await db.media.create({
    data: {
      type: kind,
      storage_key: originalKey,
      url: originalUrl,
      mime_type: isImage ? "image/webp" : input.mimeType,
      file_size: BigInt(input.buffer.byteLength),
      width,
      height,
      checksum,
      title: input.title ?? input.name.replace(/\.[a-z0-9]+$/i, ""),
      alt_text: input.alt_text ?? null,
      caption: input.caption ?? null,
      credit: input.credit ?? "Crédit à préciser",
      license: input.license ?? null,
      variants: stringifyJsonArray(variants),
      uploaded_by: userId,
    },
  });

  await auditLog({
    userId,
    action: "media.upload",
    resourceType: "media",
    resourceId: media.id,
    after: { title: media.title, type: kind, size: input.buffer.byteLength, variants: variants.length },
  });

  return { media: { id: media.id, url: media.url, duplicate: false } };
}

export async function listMedia(session: { id: string }, query: z.infer<typeof mediaListQuerySchema>) {
  const where: Record<string, unknown> = {};
  if (query.trash) where.deleted_at = { not: null };
  else where.deleted_at = null;
  if (query.type) where.type = query.type;
  if (query.q) where.OR = [{ title: { contains: query.q } }, { alt_text: { contains: query.q } }, { credit: { contains: query.q } }];
  if (query.from || query.to) {
    where.created_at = {
      ...(query.from ? { gte: new Date(query.from) } : {}),
      ...(query.to ? { lte: new Date(query.to) } : {}),
    };
  }
  const page = query.page ?? 1;
  const perPage = query.per_page ?? 24;
  const [total, items] = await Promise.all([
    db.media.count({ where }),
    db.media.findMany({
      where,
      orderBy: { created_at: "desc" },
      select: {
        id: true, type: true, url: true, mime_type: true, width: true, height: true,
        title: true, alt_text: true, credit: true, license: true, checksum: true,
        created_at: true, file_size: true, variants: true,
      },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);
  return { items, meta: { total, page, per_page: perPage, pages: Math.max(1, Math.ceil(total / perPage)) } };
}

/** Contenus utilisant le média (§11.2 : affichage avant suppression). */
export async function getMediaUsage(mediaId: string) {
  const media = await db.media.findFirst({ where: { id: mediaId, deleted_at: null } });
  if (!media) throw new ValidationError("Média introuvable.");

  const [coverArticles, socialArticles, avatarUsers, categories, dossiers, entities, blocksRaw, featured] =
    await Promise.all([
      db.article.findMany({
        where: { cover_media_id: mediaId, deleted_at: null },
        select: { id: true, title: true, status: true },
        take: 20,
      }),
      db.article.findMany({
        where: { social_image_id: mediaId, deleted_at: null },
        select: { id: true, title: true },
        take: 10,
      }),
      db.user.findMany({ where: { avatar_media_id: mediaId, deleted_at: null }, select: { id: true, display_name: true }, take: 10 }),
      db.category.findMany({ where: { cover_media_id: mediaId, deleted_at: null }, select: { id: true, name: true } }),
      db.dossier.findMany({ where: { cover_media_id: mediaId, deleted_at: null }, select: { id: true, title: true } }),
      db.entity.findMany({ where: { image_media_id: mediaId }, select: { id: true, name: true } }),
      db.article.findMany({
        where: { deleted_at: null, body: { contains: mediaId } },
        select: { id: true, title: true, body: true },
        take: 50,
      }),
      db.featuredSlot.findMany({ where: { override_media_id: mediaId }, select: { id: true, article_id: true } }),
    ]);

  // Blocs image/gallery/audio/vidéo référençant ce média
  const blockUsages = blocksRaw
    .filter((a) => {
      const body = a.body;
      return body.includes(`"${mediaId}"`);
    })
    .map((a) => ({ id: a.id, title: a.title }));

  const total =
    coverArticles.length + socialArticles.length + avatarUsers.length + categories.length +
    dossiers.length + entities.length + blockUsages.length + featured.length;

  return {
    cover: coverArticles,
    social: socialArticles,
    avatars: avatarUsers,
    categories,
    dossiers,
    entities,
    blocks: blockUsages,
    featured,
    total,
  };
}

export async function updateMediaMeta(
  session: { id: string },
  mediaId: string,
  input: z.infer<typeof mediaMetaUpdateSchema>
) {
  const media = await db.media.findFirst({ where: { id: mediaId, deleted_at: null } });
  if (!media) throw new ValidationError("Média introuvable.");

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.alt_text !== undefined) data.alt_text = input.alt_text;
  if (input.caption !== undefined) data.caption = input.caption;
  if (input.credit !== undefined) data.credit = input.credit;
  if (input.license !== undefined) data.license = input.license;
  if (input.shot_at !== undefined) data.shot_at = input.shot_at ? new Date(input.shot_at) : null;
  if (input.location !== undefined) data.location = input.location;
  if (input.focal_point) data.focal_point = stringifyJsonObject(input.focal_point);
  if (input.crops) data.crops = stringifyJsonObject(input.crops);

  await db.media.update({ where: { id: mediaId }, data });
  await auditLog({
    userId: session.id,
    action: "media.update",
    resourceType: "media",
    resourceId: mediaId,
    before: { alt: media.alt_text, credit: media.credit, focal: media.focal_point },
    after: data,
  });
  return { ok: true };
}

/** Corbeille : soft delete (30 j). Le total d'usages est renvoyé pour confirmation. */
export async function trashMedia(
  session: { id: string },
  mediaId: string,
  opts: { force?: boolean } = {}
) {
  const usage = await getMediaUsage(mediaId);
  if (usage.total > 0 && !opts.force) {
    throw new ValidationError(
      `Ce média est utilisé par ${usage.total} contenu(s) — consultez les usages et confirmez la suppression.`
    );
  }
  const media = await db.media.findFirst({ where: { id: mediaId, deleted_at: null } });
  if (!media) throw new ValidationError("Média introuvable.");
  await db.media.update({ where: { id: mediaId }, data: { deleted_at: new Date() } });
  await auditLog({
    userId: session.id,
    action: "media.trash",
    resourceType: "media",
    resourceId: mediaId,
    after: { usages_at_delete: usage.total, forced: Boolean(opts.force) },
  });
  return { ok: true, usages: usage.total };
}

export async function restoreMedia(session: { id: string }, mediaId: string) {
  await db.media.update({ where: { id: mediaId }, data: { deleted_at: null } });
  await auditLog({ userId: session.id, action: "media.restore", resourceType: "media", resourceId: mediaId });
  return { ok: true };
}

/** Purge des orphelins : corbeille au-delà de 30 jours (§11.2). */
export async function purgeOrphanMedia(session: { id: string }) {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 3600 * 1000);
  const orphans = await db.media.findMany({
    where: { deleted_at: { lt: cutoff } },
    select: { id: true, storage_key: true, variants: true },
  });
  for (const media of orphans) {
    await deleteObject(media.storage_key);
    const variants = parseJsonArraySafe(media.variants) as { url: string }[];
    for (const v of variants) {
      const key = v.url.replace(/^\/uploads\//, "");
      await deleteObject(key).catch(() => undefined);
    }
    await db.media.delete({ where: { id: media.id } });
  }
  if (orphans.length > 0) {
    await auditLog({
      userId: session.id,
      action: "media.purge_orphans",
      resourceType: "media",
      after: { purged: orphans.length },
    });
  }
  return { purged: orphans.length };
}

function parseJsonArraySafe(raw: string): unknown[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
