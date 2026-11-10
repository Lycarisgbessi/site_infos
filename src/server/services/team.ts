import { db } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ValidationError } from "@/lib/api/respond";
import type { TeamMemberCreateInput, TeamMemberUpdateInput } from "@/schemas/team";

/**
 * Équipe de la rédaction (page publique /pages/notre-equipe) :
 * membres gérés depuis /admin/pages → onglet Équipe. Ordre d'affichage
 * public = `position` croissante ; seuls les membres actifs sont servis.
 */

export interface AdminTeamMemberView {
  id: string;
  name: string;
  role: string;
  bio: string | null;
  email: string | null;
  photo_media_id: string | null;
  photo_url: string | null;
  photo_alt: string | null;
  position: number;
  is_active: boolean;
  created_at: string;
}

/** Membre public servi à la page « Notre équipe » » (URLs prêtes au rendu). */
export interface PublicTeamMemberView {
  id: string;
  name: string;
  role: string;
  bio: string | null;
  email: string | null;
  photoUrl: string | null;
  photoAlt: string | null;
}

const memberInclude = {
  photo: { select: { url: true, alt_text: true } },
} as const;

function toView(member: {
  id: string;
  name: string;
  role: string;
  bio: string | null;
  email: string | null;
  photo_media_id: string | null;
  position: number;
  is_active: boolean;
  created_at: Date;
  photo: { url: string; alt_text: string | null } | null;
}): AdminTeamMemberView {
  return {
    id: member.id,
    name: member.name,
    role: member.role,
    bio: member.bio,
    email: member.email,
    photo_media_id: member.photo_media_id,
    photo_url: member.photo?.url ?? null,
    photo_alt: member.photo?.alt_text ?? null,
    position: member.position,
    is_active: member.is_active,
    created_at: member.created_at.toISOString(),
  };
}

/** Liste admin : tous les membres (actifs et inactifs), position croissante. */
export async function listTeam(): Promise<AdminTeamMemberView[]> {
  const members = await db.teamMember.findMany({
    orderBy: [{ position: "asc" }, { created_at: "asc" }],
    include: memberInclude,
  });
  return members.map((m) => toView(m));
}

/** Liste publique : membres actifs uniquement, position croissante. */
export async function listActiveTeam(): Promise<PublicTeamMemberView[]> {
  const members = await db.teamMember.findMany({
    where: { is_active: true },
    orderBy: [{ position: "asc" }, { created_at: "asc" }],
    include: memberInclude,
  });
  return members.map((m) => ({
    id: m.id,
    name: m.name,
    role: m.role,
    bio: m.bio,
    email: m.email,
    photoUrl: m.photo?.url ?? null,
    photoAlt: m.photo?.alt_text ?? m.name,
  }));
}

/** Vérifie l'existence du média photo (médiathèque) si fourni. */
async function assertPhotoExists(mediaId: string | null | undefined): Promise<void> {
  if (!mediaId) return;
  const media = await db.media.findUnique({ where: { id: mediaId }, select: { id: true } });
  if (!media) throw new ValidationError("Média introuvable dans la médiathèque.");
}

export async function upsertTeamMember(
  userId: string,
  input: TeamMemberCreateInput | TeamMemberUpdateInput,
  id?: string,
): Promise<AdminTeamMemberView> {
  await assertPhotoExists(input.photo_media_id);

  if (id) {
    const existing = await db.teamMember.findFirst({
      where: { id },
      include: memberInclude,
    });
    if (!existing) throw new ValidationError("Membre introuvable.");

    const updated = await db.teamMember.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.bio !== undefined ? { bio: input.bio } : {}),
        ...(input.photo_media_id !== undefined ? { photo_media_id: input.photo_media_id } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
        ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
      },
      include: memberInclude,
    });
    await auditLog({
      userId,
      action: "team.member_update",
      resourceType: "team_member",
      resourceId: id,
      before: toView(existing),
      after: toView(updated),
    });
    return toView(updated);
  }

  const created = await db.teamMember.create({
    data: {
      name: (input as TeamMemberCreateInput).name,
      role: (input as TeamMemberCreateInput).role,
      bio: input.bio ?? null,
      photo_media_id: input.photo_media_id ?? null,
      email: input.email ?? null,
      position: input.position ?? 0,
      is_active: input.is_active ?? true,
    },
    include: memberInclude,
  });
  await auditLog({
    userId,
    action: "team.member_create",
    resourceType: "team_member",
    resourceId: created.id,
    after: { name: created.name, role: created.role },
  });
  return toView(created);
}

/** Suppression définitive (pas de soft-delete : liste courte, écran dédié). */
export async function deleteTeamMember(userId: string, id: string): Promise<{ id: string }> {
  const existing = await db.teamMember.findFirst({ where: { id }, select: { id: true, name: true } });
  if (!existing) throw new ValidationError("Membre introuvable.");
  await db.teamMember.delete({ where: { id } });
  await auditLog({
    userId,
    action: "team.member_delete",
    resourceType: "team_member",
    resourceId: id,
    before: { name: existing.name },
  });
  return { id };
}
