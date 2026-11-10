import { z } from "zod";

/**
 * Partenaires (page publique « Nos partenaires », /admin/pages → onglet
 * Partenaires) — validation. Logo issu de la médiathèque, catégorie libre
 * (« Institutions », « Médias », « Entreprises »…), URL http(s) optionnelle.
 */

const httpUrl = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .regex(/^https?:\/\//i, "L'URL doit commencer par http:// ou https://.");

export const partnerFields = {
  name: z.string().trim().min(1, "Le nom est obligatoire.").max(200),
  category: z.string().trim().max(120).nullable().optional(),
  url: httpUrl.nullable().optional(),
  logo_media_id: z.string().uuid("Média introuvable dans la médiathèque.").nullable().optional(),
  position: z.number().int().min(0).max(9999).optional(),
  is_active: z.boolean().optional(),
};

export const partnerCreateSchema = z.object(partnerFields);

export const partnerUpdateSchema = z.object(partnerFields).partial();

export type PartnerCreateInput = z.infer<typeof partnerCreateSchema>;
export type PartnerUpdateInput = z.infer<typeof partnerUpdateSchema>;
