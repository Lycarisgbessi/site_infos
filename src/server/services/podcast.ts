import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { auditLog } from "@/lib/audit";
import { ValidationError } from "@/lib/api/respond";
import { toDriveLink, isDriveLink } from "@/lib/drive";
import type {
  PodcastSeasonCreateInput,
  PodcastSeasonUpdateInput,
  PodcastEpisodeCreateInput,
  PodcastEpisodeUpdateInput,
} from "@/schemas/podcast";

/**
 * Podcast / FM — saisons et épisodes (§ /admin/podcast, /podcast).
 *
 * Conversion Google Drive : à l'enregistrement, un lien Drive (ou un ID
 * brut) est converti en flux lisible (`audio_url` = streamUrl) et l'ID
 * du fichier est conservé dans `drive_file_id`.
 */

// ─── Vues sérialisées (API JSON) ───────────────────────────────────────

export interface AdminEpisodeView {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  season_id: string;
  position: number;
  audio_url: string;
  drive_file_id: string | null;
  duration_sec: number | null;
  cover_media_id: string | null;
  cover_url: string | null;
  published_at: string;
  is_active: boolean;
  created_at: string;
}

export interface AdminSeasonView {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  position: number;
  is_active: boolean;
  created_at: string;
  episodes: AdminEpisodeView[];
}

function toEpisodeView(
  ep: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    season_id: string;
    position: number;
    audio_url: string;
    drive_file_id: string | null;
    duration_sec: number | null;
    cover_media_id: string | null;
    published_at: Date;
    is_active: boolean;
    created_at: Date;
    cover?: { url: string } | null;
  },
): AdminEpisodeView {
  return {
    id: ep.id,
    title: ep.title,
    slug: ep.slug,
    description: ep.description,
    season_id: ep.season_id,
    position: ep.position,
    audio_url: ep.audio_url,
    drive_file_id: ep.drive_file_id,
    duration_sec: ep.duration_sec,
    cover_media_id: ep.cover_media_id,
    cover_url: ep.cover?.url ?? null,
    published_at: ep.published_at.toISOString(),
    is_active: ep.is_active,
    created_at: ep.created_at.toISOString(),
  };
}

// ─── Saisons ───────────────────────────────────────────────────────────

const SEASON_INCLUDE: Prisma.PodcastSeasonInclude = {
  episodes: {
    orderBy: [{ position: "asc" }, { published_at: "asc" }],
    include: { cover: { select: { url: true } } },
  },
};

export async function listSeasonsWithEpisodes(): Promise<AdminSeasonView[]> {
  const seasons = await db.podcastSeason.findMany({
    orderBy: { position: "asc" },
    include: SEASON_INCLUDE,
  });
  return seasons.map((s) => ({
    id: s.id,
    title: s.title,
    slug: s.slug,
    description: s.description,
    position: s.position,
    is_active: s.is_active,
    created_at: s.created_at.toISOString(),
    episodes: s.episodes.map(toEpisodeView),
  }));
}

/** Saisons actives + épisodes actifs publiés (page publique /podcast). */
export async function listPublicSeasons(): Promise<AdminSeasonView[]> {
  const seasons = await db.podcastSeason.findMany({
    where: { is_active: true },
    orderBy: { position: "asc" },
    include: {
      episodes: {
        where: { is_active: true, published_at: { lte: new Date() } },
        orderBy: [{ position: "asc" as const }, { published_at: "asc" as const }],
        include: { cover: { select: { url: true } } },
      },
    },
  });
  return seasons.map((s) => ({
    id: s.id,
    title: s.title,
    slug: s.slug,
    description: s.description,
    position: s.position,
    is_active: s.is_active,
    created_at: s.created_at.toISOString(),
    episodes: s.episodes.map(toEpisodeView),
  }));
}

async function assertSlugFree(
  slug: string,
  kind: "season" | "episode",
  excludeId?: string,
): Promise<void> {
  const existing =
    kind === "season"
      ? await db.podcastSeason.findUnique({ where: { slug }, select: { id: true } })
      : await db.podcastEpisode.findUnique({ where: { slug }, select: { id: true } });
  if (existing && existing.id !== excludeId) {
    throw new ValidationError(`Ce slug est déjà utilisé par une autre ${kind === "season" ? "saison" : "épisode"}.`);
  }
}

export async function createSeason(userId: string, input: PodcastSeasonCreateInput) {
  await assertSlugFree(input.slug, "season");
  const max = await db.podcastSeason.aggregate({ _max: { position: true } });
  const season = await db.podcastSeason.create({
    data: {
      title: input.title,
      slug: input.slug,
      description: input.description ?? null,
      position: input.position ?? (max._max.position ?? -1) + 1,
      is_active: input.is_active ?? true,
    },
  });
  await auditLog({
    userId,
    action: "podcast.season.create",
    resourceType: "podcast_season",
    resourceId: season.id,
    after: { title: season.title, slug: season.slug },
  });
  return { id: season.id };
}

export async function updateSeason(userId: string, id: string, input: PodcastSeasonUpdateInput) {
  const before = await db.podcastSeason.findUnique({ where: { id } });
  if (!before) throw new ValidationError("Saison introuvable.");
  if (input.slug && input.slug !== before.slug) await assertSlugFree(input.slug, "season", id);
  const season = await db.podcastSeason.update({ where: { id }, data: input });
  await auditLog({
    userId,
    action: "podcast.season.update",
    resourceType: "podcast_season",
    resourceId: id,
    before: { title: before.title, slug: before.slug, is_active: before.is_active },
    after: { title: season.title, slug: season.slug, is_active: season.is_active },
  });
  return { id: season.id };
}

export async function deleteSeason(userId: string, id: string) {
  const season = await db.podcastSeason.findUnique({
    where: { id },
    include: { _count: { select: { episodes: true } } },
  });
  if (!season) throw new ValidationError("Saison introuvable.");
  if (season._count.episodes > 0) {
    throw new ValidationError(
      `Suppression impossible : ${season._count.episodes} épisode(s) rattaché(s) à cette saison. Supprimez ou déplacez-les d'abord.`,
    );
  }
  await db.podcastSeason.delete({ where: { id } });
  await auditLog({
    userId,
    action: "podcast.season.delete",
    resourceType: "podcast_season",
    resourceId: id,
    before: { title: season.title, slug: season.slug },
  });
  return { ok: true };
}

export async function reorderSeasons(userId: string, items: { id: string; position: number }[]) {
  await db.$transaction(
    items.map((item) =>
      db.podcastSeason.update({ where: { id: item.id }, data: { position: item.position } }),
    ),
  );
  await auditLog({
    userId,
    action: "podcast.season.reorder",
    resourceType: "podcast_season",
    after: items,
  });
  return { ok: true };
}

// ─── Épisodes ──────────────────────────────────────────────────────────

/** URL audio normalisée : lien Drive → { streamUrl, fileId }, sinon direct. */
function resolveAudio(
  raw: string,
): { audio_url: string; drive_file_id: string | null } {
  if (isDriveLink(raw)) {
    const link = toDriveLink(raw);
    if (link) return { audio_url: link.streamUrl, drive_file_id: link.id };
  }
  return { audio_url: raw, drive_file_id: null };
}

async function assertSeasonExists(seasonId: string): Promise<void> {
  const season = await db.podcastSeason.findUnique({ where: { id: seasonId }, select: { id: true } });
  if (!season) throw new ValidationError("Saison introuvable pour cet épisode.");
}

export async function createEpisode(userId: string, input: PodcastEpisodeCreateInput) {
  await assertSlugFree(input.slug, "episode");
  await assertSeasonExists(input.season_id);
  const audio = resolveAudio(input.audio_url);
  const max = await db.podcastEpisode.aggregate({
    where: { season_id: input.season_id },
    _max: { position: true },
  });
  const episode = await db.podcastEpisode.create({
    data: {
      title: input.title,
      slug: input.slug,
      description: input.description ?? null,
      season_id: input.season_id,
      position: input.position ?? (max._max.position ?? -1) + 1,
      ...audio,
      duration_sec: input.duration_sec ?? null,
      cover_media_id: input.cover_media_id ?? null,
      published_at: input.published_at ? new Date(input.published_at) : new Date(),
      is_active: input.is_active ?? true,
    },
  });
  await auditLog({
    userId,
    action: "podcast.episode.create",
    resourceType: "podcast_episode",
    resourceId: episode.id,
    after: { title: episode.title, slug: episode.slug, audio_url: episode.audio_url },
  });
  return { id: episode.id };
}

export async function updateEpisode(userId: string, id: string, input: PodcastEpisodeUpdateInput) {
  const before = await db.podcastEpisode.findUnique({ where: { id } });
  if (!before) throw new ValidationError("Épisode introuvable.");
  if (input.slug && input.slug !== before.slug) await assertSlugFree(input.slug, "episode", id);
  if (input.season_id && input.season_id !== before.season_id) {
    await assertSeasonExists(input.season_id);
  }
  const { audio_url, published_at, season_id, cover_media_id, ...rest } = input;
  const episode = await db.podcastEpisode.update({
    where: { id },
    data: {
      ...rest,
      ...(audio_url !== undefined ? resolveAudio(audio_url) : {}),
      ...(season_id !== undefined ? { season: { connect: { id: season_id } } } : {}),
      ...(cover_media_id !== undefined
        ? { cover: cover_media_id ? { connect: { id: cover_media_id } } : { disconnect: true } }
        : {}),
      ...(published_at !== undefined ? { published_at: new Date(published_at) } : {}),
    },
  });
  await auditLog({
    userId,
    action: "podcast.episode.update",
    resourceType: "podcast_episode",
    resourceId: id,
    before: { title: before.title, slug: before.slug, is_active: before.is_active },
    after: { title: episode.title, slug: episode.slug, is_active: episode.is_active },
  });
  return { id: episode.id };
}

export async function deleteEpisode(userId: string, id: string) {
  const episode = await db.podcastEpisode.findUnique({ where: { id } });
  if (!episode) throw new ValidationError("Épisode introuvable.");
  await db.podcastEpisode.delete({ where: { id } });
  await auditLog({
    userId,
    action: "podcast.episode.delete",
    resourceType: "podcast_episode",
    resourceId: id,
    before: { title: episode.title, slug: episode.slug },
  });
  return { ok: true };
}
