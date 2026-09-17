import { z } from "zod";

/**
 * Schémas Zod partagés — authentification (§02.1 Validation, §08.3).
 * Réutilisables client/serveur (§03 schemas/).
 */

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide."),
  password: z.string().min(1, "Mot de passe requis."),
  rememberMe: z.boolean().optional().default(false),
});

export const mfaSchema = z.object({
  challengeToken: z.string().min(10),
  code: z.string().trim().min(6).max(12),
  rememberMe: z.boolean().optional().default(false),
});

export const totpActivateSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Code à 6 chiffres attendu."),
});

export const changePasswordSchema = z.object({
  newPassword: z.string().min(12, "12 caractères minimum (§08.3)."),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type MfaInput = z.infer<typeof mfaSchema>;
