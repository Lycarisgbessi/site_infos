import { db } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ValidationError } from "@/lib/api/respond";
import type { PartnerCreateInput, PartnerUpdateInput } from "@/schemas/partners";

/**
 * Partenaires (page publique /pages/nos-partenaires) : gérés depuis
 * /admin/pages → onglet Partenaires. La page publique regroupe les
 * partenaires actifs par `category`, ordonnés par `position` croissante.
 */

export interface AdminPartnerView {
  id: string;
  name: string;
  category: string | null;
  url: string | null;
  logo_media_id: string | null;
  logo_url: string | null;
  logo_alt: string | null;
  position: number;
  is_active: boolean;
  created_at: string;
}

/** Partenaire public servi à la page « Nos partenaires ». */
export interface PublicPartnerView {
  id: string;
  name: string;
  category: string | null;
  url: string | null;
  logoUrl: string | null;
  logoAlt: string | null;
}

const partnerInclude = {
  logo: { select: { url: true, alt_text: true } },
} as const;

function toView(partner: {
  id: string;
  name: string;
  category: string | null;
  url: string | null;
  logo_media_id: string | null;
  position: number;
  is_active: boolean;
  created_at: Date;
  logo: { url: string; alt_text: string | null } | null;
}): AdminPartnerView {
  return {
    id: partner.id,
    name: partner.name,
    category: partner.category,
    url: partner.url,
    logo_media_id: partner.logo_media_id,
    logo_url: partner.logo?.url ?? null,
    logo_alt: partner.logo?.alt_text ?? null,
    position: partner.position,
    is_active: partner.is_active,
    created_at: partner.created_at.toISOString(),
  };
}

/** Liste admin : tous les partenaires (actifs et inactifs), position croissante. */
export async function listPartners(): Promise<AdminPartnerView[]> {
  const partners = await db.partner.findMany({
    orderBy: [{ position: "asc" }, { created_at: "asc" }],
    include: partnerInclude,
  });
  return partners.map((p) => toView(p));
}

/** Liste publique : partenaires actifs uniquement, position croissante. */
export async function listActivePartners(): Promise<PublicPartnerView[]> {
  const partners = await db.partner.findMany({
    where: { is_active: true },
    orderBy: [{ position: "asc" }, { created_at: "asc" }],
    include: partnerInclude,
  });
  return partners.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    url: p.url,
    logoUrl: p.logo?.url ?? null,
    logoAlt: p.logo?.alt_text ?? p.name,
  }));
}

/** Vérifie l'existence du média logo (médiathèque) si fourni. */
async function assertLogoExists(mediaId: string | null | undefined): Promise<void> {
  if (!mediaId) return;
  const media = await db.media.findUnique({ where: { id: mediaId }, select: { id: true } });
  if (!media) throw new ValidationError("Média introuvable dans la médiathèque.");
}

export async function upsertPartner(
  userId: string,
  input: PartnerCreateInput | PartnerUpdateInput,
  id?: string,
): Promise<AdminPartnerView> {
  await assertLogoExists(input.logo_media_id);

  if (id) {
    const existing = await db.partner.findFirst({
      where: { id },
      include: partnerInclude,
    });
    if (!existing) throw new ValidationError("Partenaire introuvable.");

    const updated = await db.partner.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.url !== undefined ? { url: input.url } : {}),
        ...(input.logo_media_id !== undefined ? { logo_media_id: input.logo_media_id } : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
        ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
      },
      include: partnerInclude,
    });
    await auditLog({
      userId,
      action: "partners.partner_update",
      resourceType: "partner",
      resourceId: id,
      before: toView(existing),
      after: toView(updated),
    });
    return toView(updated);
  }

  const created = await db.partner.create({
    data: {
      name: (input as PartnerCreateInput).name,
      category: input.category ?? null,
      url: input.url ?? null,
      logo_media_id: input.logo_media_id ?? null,
      position: input.position ?? 0,
      is_active: input.is_active ?? true,
    },
    include: partnerInclude,
  });
  await auditLog({
    userId,
    action: "partners.partner_create",
    resourceType: "partner",
    resourceId: created.id,
    after: { name: created.name, category: created.category },
  });
  return toView(created);
}

/** Suppression définitive (pas de soft-delete : liste courte, écran dédié). */
export async function deletePartner(userId: string, id: string): Promise<{ id: string }> {
  const existing = await db.partner.findFirst({ where: { id }, select: { id: true, name: true } });
  if (!existing) throw new ValidationError("Partenaire introuvable.");
  await db.partner.delete({ where: { id } });
  await auditLog({
    userId,
    action: "partners.partner_delete",
    resourceType: "partner",
    resourceId: id,
    before: { name: existing.name },
  });
  return { id };
}
