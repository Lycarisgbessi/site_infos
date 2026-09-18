/**
 * Liste exhaustive des permissions (§08.1, contractuel).
 * Format : `<ressource>.<action>`.
 */
export const PERMISSIONS = [
  // Articles
  "article.create",
  "article.read.all",
  "article.read.own",
  "article.update.all",
  "article.update.own",
  "article.publish",
  "article.unpublish",
  "article.delete",
  "article.schedule",
  "article.feature",
  "article.lock.override",
  // Modules éditoriaux
  "live.manage",
  "flash.manage",
  "weather.manage",
  // Médias
  "media.upload",
  "media.update",
  "media.delete",
  // Taxonomies
  "taxonomy.manage",
  "dossier.manage",
  "entity.manage",
  // Pages, menus, composition
  "page.manage",
  "menu.manage",
  "homepage.compose",
  "banner.manage",
  "redirect.manage",
  // SEO
  "seo.read",
  "seo.manage",
  "seo.keywords.query",
  // Publicité
  "ads.read",
  "ads.manage",
  "ads.reports",
  // Newsletter
  "newsletter.read",
  "newsletter.compose",
  "newsletter.send",
  "subscriber.manage",
  "subscriber.export",
  // Modération
  "comment.moderate",
  "inbox.read",
  "inbox.assign",
  // Analytics
  "analytics.read",
  "analytics.export",
  // Administration
  "user.read",
  "user.manage",
  "role.manage",
  "settings.manage",
  "integrations.manage",
  "audit.read",
  // Système
  "system.purge_cache",
  "system.export",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Groupes de permissions (`article.*` dans les définitions de rôles). */
const GROUPS: Record<string, readonly Permission[]> = {
  "article.*": PERMISSIONS.filter((p) => p.startsWith("article.")),
  "media.*": PERMISSIONS.filter((p) => p.startsWith("media.")),
  "seo.*": PERMISSIONS.filter((p) => p.startsWith("seo.")),
  "ads.*": PERMISSIONS.filter((p) => p.startsWith("ads.")),
  "newsletter.*": PERMISSIONS.filter((p) => p.startsWith("newsletter.")),
};

export function expandPermissionToken(
  token: Permission | string
): readonly Permission[] {
  const group = GROUPS[token];
  if (group) return group;
  return [token as Permission];
}

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

// ─── Matrice des rôles système (§08.2, contractuel) ───────────────────

const ARTICLE_ALL = [
  "article.create",
  "article.read.all",
  "article.read.own",
  "article.update.all",
  "article.update.own",
  "article.publish",
  "article.unpublish",
  "article.delete",
  "article.schedule",
  "article.feature",
  "article.lock.override",
] as const;

export const SYSTEM_ROLES: Record<string, readonly string[]> = {
  // Administrateur : toutes les permissions.
  admin: ["*"],

  // Directeur de publication : tout sauf user.manage, role.manage,
  // settings.manage, integrations.manage ; audit.read complet (§08.2).
  publisher: [
    ...ARTICLE_ALL,
    "live.manage",
    "flash.manage",
    "weather.manage",
    "media.upload",
    "media.update",
    "media.delete",
    "taxonomy.manage",
    "dossier.manage",
    "entity.manage",
    "page.manage",
    "menu.manage",
    "homepage.compose",
    "banner.manage",
    "redirect.manage",
    "seo.read",
    "seo.manage",
    "seo.keywords.query",
    "ads.read",
    "ads.manage",
    "ads.reports",
    "newsletter.read",
    "newsletter.compose",
    "newsletter.send",
    "subscriber.manage",
    "subscriber.export",
    "comment.moderate",
    "inbox.read",
    "inbox.assign",
    "analytics.read",
    "analytics.export",
    "user.read",
    "audit.read",
    "system.purge_cache",
    "system.export",
  ],

  // Rédacteur en chef (§08.2, liste littérale).
  chief_editor: [
    ...ARTICLE_ALL,
    "live.manage",
    "flash.manage",
    "homepage.compose",
    "taxonomy.manage",
    "dossier.manage",
    "seo.read",
    "seo.manage",
    "seo.keywords.query",
    "newsletter.read",
    "newsletter.compose",
    "newsletter.send",
    "comment.moderate",
    "analytics.read",
    "media.upload",
    "media.update",
    "media.delete",
  ],

  // Chef de rubrique : idem chief_editor, restreint à category_ids (§08.2).
  section_editor: [
    ...ARTICLE_ALL,
    "live.manage",
    "flash.manage",
    "homepage.compose",
    "taxonomy.manage",
    "dossier.manage",
    "seo.read",
    "seo.manage",
    "seo.keywords.query",
    "newsletter.read",
    "newsletter.compose",
    "newsletter.send",
    "comment.moderate",
    "analytics.read",
    "media.upload",
    "media.update",
    "media.delete",
  ],

  // Journaliste (§08.2). `article.publish` paramétrable via
  // settings.editorial.journalist_can_publish — traité dans requirePermission.
  journalist: [
    "article.create",
    "article.read.own",
    "article.update.own",
    "media.upload",
    "seo.read",
    "seo.keywords.query",
  ],

  // Correcteur : lecture et mise à jour du texte, pas de publication (§08.2).
  copy_editor: ["article.read.all", "article.update.all"],

  // Contributeur externe (§08.2) — portée d'états draft/in_review appliquée
  // par la couche service à la PHASE 2.
  contributor: ["article.create", "article.read.own", "article.update.own"],

  // Régie publicitaire (§08.2).
  ad_manager: ["ads.read", "ads.manage", "ads.reports", "analytics.read"],

  // Gestionnaire newsletter (§08.2).
  newsletter_manager: [
    "newsletter.read",
    "newsletter.compose",
    "newsletter.send",
    "subscriber.manage",
    "analytics.read",
  ],

  // Modérateur (§08.2).
  moderator: ["comment.moderate", "inbox.read"],

  // Analyste (§08.2).
  analyst: ["analytics.read", "analytics.export", "seo.read"],
};