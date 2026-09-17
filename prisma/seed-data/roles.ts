import { SYSTEM_ROLES } from "../../src/lib/permissions/permissions-list";

/**
 * Rôles système (§08.2, contractuel) — les matrices de permissions sont
 * importées de lib/permissions (source unique de vérité).
 */

export interface RoleSeed {
  key: string;
  label: string;
  description: string;
  isSystem: boolean;
}

const ROLE_LABELS: RoleSeed[] = [
  { key: "admin", label: "Administrateur", description: "Toutes les permissions (§08.2).", isSystem: true },
  { key: "publisher", label: "Directeur de publication", description: "Tout sauf gestion des utilisateurs, rôles, réglages et intégrations.", isSystem: true },
  { key: "chief_editor", label: "Rédacteur en chef", description: "Articles, direct, flash, une, taxonomies, SEO, newsletter, modération.", isSystem: true },
  { key: "section_editor", label: "Chef de rubrique", description: "Comme le rédacteur en chef, restreint aux rubriques attribuées.", isSystem: true },
  { key: "journalist", label: "Journaliste", description: "Création et édition de ses articles, médias, SEO lecture. Publication selon réglage.", isSystem: true },
  { key: "copy_editor", label: "Correcteur", description: "Lecture et correction des textes, sans publication.", isSystem: true },
  { key: "contributor", label: "Contributeur externe", description: "Ses propres articles, aux états brouillon et en relecture.", isSystem: true },
  { key: "ad_manager", label: "Régie publicitaire", description: "Campagnes, créations, rapports publicitaires.", isSystem: true },
  { key: "newsletter_manager", label: "Gestionnaire newsletter", description: "Campagnes e-mail et gestion des abonnés.", isSystem: true },
  { key: "moderator", label: "Modérateur", description: "Modération des commentaires et boîte de réception.", isSystem: true },
  { key: "analyst", label: "Analyste", description: "Lecture des statistiques, export, SEO lecture.", isSystem: true },
];

export function rolePermissionMatrix(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const role of ROLE_LABELS) {
    map.set(role.key, [...(SYSTEM_ROLES[role.key] ?? [])]);
  }
  return map;
}

export const ROLE_SEEDS = ROLE_LABELS;
