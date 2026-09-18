import { db } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ValidationError } from "@/lib/api/respond";
import { invalidateTags, CACHE_TAGS } from "@/lib/cache";
import { translationsBulkSchema, translationUpdateSchema } from "@/schemas/media-structure";
import type { z } from "zod";

/**
 * Réglages « Autonomie totale » (§11.2 /admin/parametres) et écran
 * « Textes d'interface » (table `translations` éditable).
 * Préférences par utilisateur (vues enregistrées, widgets) — table
 * additive `user_preferences` (D-13).
 */

// ─── Registre des groupes et clés (§11.2, tableau « Autonomie totale ») ─

export interface SettingFieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "boolean" | "number" | "json" | "color" | "list";
  help?: string;
}

export const SETTING_GROUPS: { group: string; label: string; fields: SettingFieldDef[] }[] = [
  {
    group: "identity",
    label: "Identité",
    fields: [
      { key: "identity.site_name", label: "Nom du site", type: "text" },
      { key: "identity.baseline", label: "Baseline", type: "text" },
      { key: "identity.logo_light", label: "Logo (thème clair)", type: "text" },
      { key: "identity.logo_dark", label: "Logo (thème sombre)", type: "text" },
      { key: "identity.logo_icon", label: "Icône", type: "text" },
      { key: "identity.favicon", label: "Favicon", type: "text" },
      { key: "identity.default_social_image", label: "Image sociale par défaut", type: "text" },
      { key: "identity.accent_color", label: "Couleur d'accent", type: "color" },
      { key: "identity.timezone", label: "Fuseau horaire", type: "text" },
      { key: "identity.active_locales", label: "Langues actives", type: "list" },
    ],
  },
  {
    group: "contact",
    label: "Contact",
    fields: [
      { key: "contact.address", label: "Adresse", type: "textarea" },
      { key: "contact.phones", label: "Téléphones", type: "list" },
      { key: "contact.whatsapp", label: "WhatsApp", type: "text" },
      { key: "contact.emails", label: "E-mails par service", type: "json" },
      { key: "contact.hours", label: "Horaires", type: "textarea" },
      { key: "contact.gps", label: "Coordonnées GPS", type: "text" },
      { key: "contact.form_recipients", label: "Destinataires des formulaires", type: "list" },
    ],
  },
  {
    group: "social",
    label: "Réseaux sociaux",
    fields: [
      {
        key: "social.links",
        label: "Liste ordonnée [{platform, url, label, showInHeader, showInFooter}]",
        type: "json",
      },
    ],
  },
  {
    group: "editorial",
    label: "Éditorial",
    fields: [
      { key: "editorial.journalist_can_publish", label: "Les journalistes peuvent publier", type: "boolean" },
      { key: "editorial.comments_enabled", label: "Commentaires activés", type: "boolean" },
      { key: "editorial.comments_moderation", label: "Modération", type: "json" },
      { key: "editorial.flash_expiration_hours", label: "Expiration des flashs (heures)", type: "number" },
      { key: "editorial.blocked_words", label: "Mots bloqués", type: "list" },
    ],
  },
  {
    group: "seo",
    label: "SEO",
    fields: [
      { key: "seo.default_title", label: "Titre par défaut", type: "text" },
      { key: "seo.separator", label: "Séparateur", type: "text" },
      { key: "seo.suffix", label: "Suffixe", type: "text" },
      { key: "seo.search_console_verification", label: "Vérification Search Console", type: "text" },
      { key: "seo.default_robots", label: "Robots par défaut", type: "text" },
    ],
  },
  {
    group: "ads",
    label: "Publicité",
    fields: [
      { key: "ads.enabled", label: "Activation globale", type: "boolean" },
      { key: "ads.max_density", label: "Densité maximale", type: "number" },
      { key: "ads.sensitive_keywords", label: "Mots-clés sensibles excluant la publicité", type: "list" },
    ],
  },
  {
    group: "email",
    label: "E-mail",
    fields: [
      { key: "email.from", label: "Expéditeur", type: "text" },
      { key: "email.from_name", label: "Nom d'expéditeur", type: "text" },
      { key: "email.footer_legal", label: "Pied de page légal", type: "textarea" },
      { key: "email.postal_address", label: "Adresse postale (CAN-SPAM)", type: "text" },
    ],
  },
  {
    group: "features",
    label: "Modules",
    fields: [
      { key: "features.weather", label: "Météo", type: "boolean" },
      { key: "features.live", label: "Direct", type: "boolean" },
      { key: "features.comments", label: "Commentaires", type: "boolean" },
      { key: "features.push", label: "Notifications push", type: "boolean" },
      { key: "features.donations", label: "Dons", type: "boolean" },
    ],
  },
  {
    group: "legal",
    label: "Mentions légales",
    fields: [
      { key: "legal.publisher", label: "Éditeur", type: "text" },
      { key: "legal.publication_director", label: "Directeur de publication", type: "text" },
      { key: "legal.host", label: "Hébergeur", type: "text" },
      { key: "legal.registration_number", label: "Numéro d'enregistrement", type: "text" },
    ],
  },
];

export async function getSettingsByGroup(group?: string) {
  const where = group ? { group_key: group } : {};
  return db.setting.findMany({ where, orderBy: [{ group_key: "asc" }, { key: "asc" }] });
}

export async function updateSettingsGroup(
  userId: string,
  updates: { key: string; value: string }[]
) {
  // Chaque clé doit appartenir au registre (aucune clé arbitraire via l'UI)
  const known = new Set(SETTING_GROUPS.flatMap((g) => g.fields.map((f) => f.key)));
  for (const u of updates) {
    if (!known.has(u.key)) {
      throw new ValidationError(`Clé de réglage inconnue : ${u.key}`);
    }
  }
  const before = await db.setting.findMany({ where: { key: { in: updates.map((u) => u.key) } } });
  for (const u of updates) {
    const groupKey = u.key.split(".")[0];
    await db.setting.upsert({
      where: { key: u.key },
      create: { key: u.key, value: u.value, group_key: groupKey, updated_by: userId },
      update: { value: u.value, updated_by: userId },
    });
  }
  await auditLog({
    userId,
    action: "settings.update",
    resourceType: "settings",
    before: before.map((s) => ({ key: s.key, value: s.value })),
    after: updates,
  });
  invalidateTags([CACHE_TAGS.settings, CACHE_TAGS.publicSettings]);
  return { ok: true, updated: updates.length };
}

// ─── Textes d'interface (§11.2 « table translations éditable ») ────────

export async function listTranslations(locale: string) {
  return db.translation.findMany({ where: { locale }, orderBy: { key: "asc" } });
}

export async function updateTranslations(userId: string, input: z.infer<typeof translationsBulkSchema>) {
  const before = await db.translation.findMany({
    where: { key: { in: input.translations.map((t) => t.key) }, locale: input.translations[0]?.locale },
  });
  for (const t of input.translations) {
    translationUpdateSchema.parse(t);
    await db.translation.upsert({
      where: { key_locale: { key: t.key, locale: t.locale } },
      create: { key: t.key, locale: t.locale, value: t.value },
      update: { value: t.value },
    });
  }
  await auditLog({
    userId,
    action: "translations.update",
    resourceType: "translations",
    before: before.map((t) => ({ key: t.key, value: t.value })),
    after: input.translations,
  });
  invalidateTags([CACHE_TAGS.translations]);
  return { ok: true, updated: input.translations.length };
}

// ─── Préférences utilisateur (vues enregistrées, widgets — D-13) ───────

export async function getUserPreference(userId: string, key: string): Promise<unknown> {
  const row = await db.userPreference.findUnique({
    where: { user_id_key: { user_id: userId, key } },
  });
  if (!row) return null;
  try {
    return JSON.parse(row.value) as unknown;
  } catch {
    return null;
  }
}

export async function setUserPreference(userId: string, key: string, value: unknown): Promise<void> {
  const serialized = JSON.stringify(value ?? null);
  if (serialized.length > 100_000) throw new ValidationError("Préférence trop volumineuse.");
  await db.userPreference.upsert({
    where: { user_id_key: { user_id: userId, key } },
    create: { user_id: userId, key, value: serialized },
    update: { value: serialized },
  });
}
