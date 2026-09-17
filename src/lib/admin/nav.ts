import type { Permission } from "@/lib/permissions/permissions-list";

/**
 * Structure de navigation du back-office (§11.2 écrans).
 * Chaque entrée porte la permission requise — le filtrage est fait côté
 * serveur (layout /admin), la présentation n'est jamais une protection
 * (§00.2-6). Les modules des PHASES 2+ apparaissent désactivés.
 */

export interface AdminNavItem {
  href: string;
  labelKey: string;
  permission: Permission | null; // null = tout utilisateur authentifié
  phase: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  icon: string; // nom d'icône Lucide
}

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", labelKey: "admin.nav.dashboard", permission: null, phase: 1, icon: "LayoutDashboard" },
  { href: "/admin/articles", labelKey: "admin.nav.articles", permission: "article.read.own", phase: 2, icon: "Newspaper" },
  { href: "/admin/une", labelKey: "admin.nav.featured", permission: "article.feature", phase: 2, icon: "Star" },
  { href: "/admin/flash", labelKey: "admin.nav.flash", permission: "flash.manage", phase: 5, icon: "Zap" },
  { href: "/admin/direct", labelKey: "admin.nav.live", permission: "live.manage", phase: 5, icon: "Radio" },
  { href: "/admin/medias", labelKey: "admin.nav.media", permission: "media.upload", phase: 2, icon: "Image" },
  { href: "/admin/taxonomies", labelKey: "admin.nav.taxonomies", permission: "taxonomy.manage", phase: 2, icon: "FolderTree" },
  { href: "/admin/pages", labelKey: "admin.nav.pages", permission: "page.manage", phase: 2, icon: "FileText" },
  { href: "/admin/menus", labelKey: "admin.nav.menus", permission: "menu.manage", phase: 2, icon: "ListTree" },
  { href: "/admin/homepage", labelKey: "admin.nav.homepage", permission: "homepage.compose", phase: 2, icon: "LayoutTemplate" },
  { href: "/admin/seo", labelKey: "admin.nav.seo", permission: "seo.read", phase: 6, icon: "Search" },
  { href: "/admin/publicite", labelKey: "admin.nav.ads", permission: "ads.read", phase: 7, icon: "Megaphone" },
  { href: "/admin/newsletter", labelKey: "admin.nav.newsletter", permission: "newsletter.read", phase: 7, icon: "Mail" },
  { href: "/admin/moderation", labelKey: "admin.nav.moderation", permission: "comment.moderate", phase: 2, icon: "MessageSquare" },
  { href: "/admin/analytics", labelKey: "admin.nav.analytics", permission: "analytics.read", phase: 3, icon: "BarChart3" },
  { href: "/admin/utilisateurs", labelKey: "admin.nav.users", permission: "user.read", phase: 2, icon: "Users" },
  { href: "/admin/parametres", labelKey: "admin.nav.settings", permission: "settings.manage", phase: 2, icon: "Settings" },
  { href: "/admin/audit", labelKey: "admin.nav.audit", permission: "audit.read", phase: 2, icon: "ScrollText" },
  { href: "/admin/securite", labelKey: "admin.nav.security", permission: null, phase: 1, icon: "ShieldCheck" },
];
