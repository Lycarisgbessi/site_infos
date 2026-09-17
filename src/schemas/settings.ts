import { z } from "zod";

/** Réglages (§06.2 settings, §11.2 groupes) — valeurs JSON sérialisées. */
export const settingUpdateSchema = z.object({
  key: z.string().min(1).max(200),
  value: z.string().min(1).max(100_000),
  group_key: z
    .enum(["identity", "contact", "social", "editorial", "seo", "ads", "email", "features", "legal"])
    .optional(),
  label: z.string().max(200).optional(),
});

export const settingsBulkSchema = z.object({
  settings: z.array(settingUpdateSchema).min(1).max(100),
});

export type SettingUpdateInput = z.infer<typeof settingUpdateSchema>;
