import { db } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ValidationError } from "@/lib/api/respond";
import type { AdCampaignCreateInput, AdCampaignUpdateInput } from "@/schemas/ads";

/**
 * Régie publicitaire (§06.3, interface simplifiée 2026-10) :
 * une campagne admin = AdCampaign (annonceur, période, priorité, compteurs)
 * + exactement une AdCreative (emplacement, média, URL de clic, URL vidéo).
 */

export interface AdminAdCampaignView {
  id: string;
  name: string;
  advertiser: string;
  slot_code: string;
  slot_name: string;
  media_kind: "image" | "gif" | "video";
  media_id: string | null;
  media_url: string | null;
  video_url: string | null;
  click_url: string;
  starts_at: string;
  ends_at: string | null;
  priority: number;
  is_active: boolean;
  impressions: number;
  clicks: number;
  created_at: string;
}

export interface AdSlotView {
  code: string;
  name: string;
  format: string;
  width: number | null;
  height: number | null;
}

// Date de fin par défaut : far future (la campagne reste active indéfiniment).
const FAR_FUTURE = new Date("2100-01-01T00:00:00.000Z");

function mediaKindOf(creative: {
  type: string;
  media_id: string | null;
  video_url: string | null;
  media?: { mime_type: string } | null;
}): "image" | "gif" | "video" {
  if (creative.type === "video" || creative.video_url) return "video";
  return creative.media && creative.media.mime_type === "image/gif" ? "gif" : "image";
}

function toView(
  campaign: {
    id: string;
    name: string;
    starts_at: Date;
    ends_at: Date;
    priority: number;
    status: string;
    impressions: number;
    clicks: number;
    created_at: Date;
    advertiser: { name: string };
    creatives: {
      slot_code: string;
      media_id: string | null;
      video_url: string | null;
      click_url: string;
      type: string;
      media: { url: string; mime_type: string } | null;
      slot: { name: string } | null;
    }[];
  },
): AdminAdCampaignView {
  const creative = campaign.creatives[0] ?? null;
  return {
    id: campaign.id,
    name: campaign.name,
    advertiser: campaign.advertiser.name,
    slot_code: creative?.slot_code ?? "—",
    slot_name: creative?.slot?.name ?? "Emplacement inconnu",
    media_kind: creative ? mediaKindOf(creative) : "image",
    media_id: creative?.media_id ?? null,
    media_url: creative?.media?.url ?? null,
    video_url: creative?.video_url ?? null,
    click_url: creative?.click_url ?? "",
    starts_at: campaign.starts_at.toISOString(),
    ends_at: campaign.ends_at.getTime() >= FAR_FUTURE.getTime() ? null : campaign.ends_at.toISOString(),
    priority: campaign.priority,
    is_active: campaign.status === "running",
    // BigInt en base — conversion pour la sérialisation JSON
    impressions: Number(campaign.impressions),
    clicks: Number(campaign.clicks),
    created_at: campaign.created_at.toISOString(),
  };
}

const campaignInclude = {
  advertiser: { select: { name: true } },
  creatives: {
    orderBy: { created_at: "asc" },
    take: 1,
    include: {
      media: { select: { url: true, mime_type: true } },
      slot: { select: { name: true } },
    },
  },
} as const;

export async function listAdCampaigns(): Promise<AdminAdCampaignView[]> {
  const campaigns = await db.adCampaign.findMany({
    where: { deleted_at: null },
    orderBy: { created_at: "desc" },
    include: campaignInclude,
  });
  return campaigns.map((c) => toView(c));
}

export async function listAdSlots(): Promise<AdSlotView[]> {
  const slots = await db.adSlot.findMany({
    orderBy: { position: "asc" },
    select: { code: true, name: true, format: true, width: true, height: true },
  });
  return slots;
}

async function findOrCreateAdvertiser(name: string): Promise<string> {
  const existing = await db.advertiser.findFirst({ where: { name, deleted_at: null }, select: { id: true } });
  if (existing) return existing.id;
  const created = await db.advertiser.create({ data: { name }, select: { id: true } });
  return created.id;
}

export async function createAdCampaign(
  userId: string,
  input: AdCampaignCreateInput,
): Promise<AdminAdCampaignView> {
  const slot = await db.adSlot.findUnique({ where: { code: input.slot_code }, select: { code: true } });
  if (!slot) throw new ValidationError(`Emplacement inconnu : ${input.slot_code}.`);

  if (input.media_id) {
    const media = await db.media.findUnique({ where: { id: input.media_id }, select: { id: true } });
    if (!media) throw new ValidationError("Média introuvable dans la médiathèque.");
  }

  const advertiserId = await findOrCreateAdvertiser(input.advertiser);
  const startsAt = new Date(input.starts_at);
  const endsAt = input.ends_at ? new Date(input.ends_at) : FAR_FUTURE;

  // GARANTIE de diffusion immédiate : une campagne créée « active »
  // (is_active=true ou absent → actif par défaut dans l'UI) est créée en
  // statut « running » — JAMAIS le défaut Prisma « draft », invisible côté
  // public (getAdCampaigns ne sélectionne que status=running + créative
  // active + fenêtre de dates).
  const isActive = input.is_active !== false;

  const campaign = await db.adCampaign.create({
    data: {
      advertiser_id: advertiserId,
      name: input.name,
      status: isActive ? "running" : "paused",
      starts_at: startsAt,
      ends_at: endsAt,
      priority: input.priority ?? 5,
      created_by: userId,
      creatives: {
        create: {
          slot_code: input.slot_code,
          type: input.media_kind === "video" ? "video" : "image",
          media_id: input.media_kind === "video" ? null : (input.media_id ?? null),
          video_url: input.media_kind === "video" ? (input.video_url ?? null) : null,
          click_url: input.click_url,
          alt_text: input.name,
          is_active: isActive,
        },
      },
    },
    include: campaignInclude,
  });

  await auditLog({
    userId,
    action: "ads.campaign_create",
    resourceType: "ad_campaign",
    resourceId: campaign.id,
    after: { name: input.name, slot: input.slot_code, advertiser: input.advertiser },
  });
  return toView(campaign);
}

export async function updateAdCampaign(
  userId: string,
  id: string,
  input: AdCampaignUpdateInput,
): Promise<AdminAdCampaignView> {
  const existing = await db.adCampaign.findFirst({
    where: { id, deleted_at: null },
    include: campaignInclude,
  });
  if (!existing) throw new ValidationError("Campagne introuvable.");

  if (input.slot_code) {
    const slot = await db.adSlot.findUnique({ where: { code: input.slot_code }, select: { code: true } });
    if (!slot) throw new ValidationError(`Emplacement inconnu : ${input.slot_code}.`);
  }
  if (input.media_id) {
    const media = await db.media.findUnique({ where: { id: input.media_id }, select: { id: true } });
    if (!media) throw new ValidationError("Média introuvable dans la médiathèque.");
  }

  let advertiserId: string | undefined;
  if (input.advertiser && input.advertiser !== existing.advertiser.name) {
    advertiserId = await findOrCreateAdvertiser(input.advertiser);
  }

  const startsAt = input.starts_at ? new Date(input.starts_at) : existing.starts_at;
  const endsAt = input.ends_at === null ? FAR_FUTURE : input.ends_at ? new Date(input.ends_at) : existing.ends_at;
  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new ValidationError("La date de fin doit être postérieure à la date de début.");
  }

  const campaign = await db.adCampaign.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(advertiserId ? { advertiser_id: advertiserId } : {}),
      ...(input.is_active !== undefined ? { status: input.is_active ? "running" : "paused" } : {}),
      starts_at: startsAt,
      ends_at: endsAt,
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
    },
    include: campaignInclude,
  });

  // Créative unique : mise à jour ou création selon les champs fournis.
  const creativeInput =
    input.slot_code !== undefined ||
    input.media_kind !== undefined ||
    input.media_id !== undefined ||
    input.video_url !== undefined ||
    input.click_url !== undefined ||
    input.is_active !== undefined;
  if (creativeInput) {
    const current = campaign.creatives[0];
    const mediaKind = input.media_kind ?? (current ? mediaKindOf(current) : "image");
    const data = {
      slot_code: input.slot_code ?? current?.slot_code ?? "AD-02",
      type: mediaKind === "video" ? ("video" as const) : ("image" as const),
      media_id: mediaKind === "video" ? null : (input.media_id ?? (current?.media_id ?? null)),
      video_url: mediaKind === "video" ? (input.video_url ?? current?.video_url ?? null) : null,
      click_url: input.click_url ?? current?.click_url ?? input.click_url,
      ...(input.name !== undefined ? { alt_text: input.name } : {}),
      ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
    };
    if (current) {
      await db.adCreative.update({ where: { id: current.id }, data });
    } else {
      await db.adCreative.create({ data: { ...data, campaign_id: id, alt_text: input.name ?? campaign.name } });
    }
  }

  const refreshed = await db.adCampaign.findUnique({ where: { id }, include: campaignInclude });
  await auditLog({
    userId,
    action: "ads.campaign_update",
    resourceType: "ad_campaign",
    resourceId: id,
    before: toView(existing),
    after: refreshed ? toView(refreshed) : undefined,
  });
  return refreshed ? toView(refreshed) : toView(campaign);
}

export async function deleteAdCampaign(userId: string, id: string): Promise<{ id: string }> {
  const existing = await db.adCampaign.findFirst({ where: { id, deleted_at: null }, select: { id: true, name: true } });
  if (!existing) throw new ValidationError("Campagne introuvable.");
  const now = new Date();
  await db.adCampaign.update({ where: { id }, data: { deleted_at: now, status: "cancelled" } });
  await db.adCreative.updateMany({ where: { campaign_id: id }, data: { is_active: false } });
  await auditLog({
    userId,
    action: "ads.campaign_delete",
    resourceType: "ad_campaign",
    resourceId: id,
    before: { name: existing.name },
  });
  return { id };
}
