import { z } from "zod";

/**
 * Équipe de la rédaction (page publique « Notre équipe », /admin/pages →
 * onglet Équipe) — validation des membres. Photo issue de la médiathèque.
 */

const email = z
  .string()
  .trim()
  .min(3)
  .max(320)
  .email("Adresse e-mail invalide.");

export const teamMemberFields = {
  name: z.string().trim().min(1, "Le nom est obligatoire.").max(200),
  role: z.string().trim().min(1, "La fonction est obligatoire.").max(200),
  bio: z.string().trim().max(2000).nullable().optional(),
  photo_media_id: z.string().uuid("Média introuvable dans la médiathèque.").nullable().optional(),
  email: email.nullable().optional(),
  position: z.number().int().min(0).max(9999).optional(),
  is_active: z.boolean().optional(),
};

export const teamMemberCreateSchema = z.object(teamMemberFields);

export const teamMemberUpdateSchema = z.object(teamMemberFields).partial();

export type TeamMemberCreateInput = z.infer<typeof teamMemberCreateSchema>;
export type TeamMemberUpdateInput = z.infer<typeof teamMemberUpdateSchema>;
