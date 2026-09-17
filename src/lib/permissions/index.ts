import { db } from "@/lib/db";
import { parseJsonArray } from "@/lib/json";
import {
  expandPermissionToken,
  PERMISSIONS,
  SYSTEM_ROLES,
  type Permission,
} from "@/lib/permissions/permissions-list";
import type { SessionUser } from "@/lib/auth/types";

/**
 * RBAC (§03 lib/permissions.ts, §08.1–§08.2).
 *
 * - `requireSession()` : session valide obligatoire, sinon rejet 401.
 * - `requirePermission()` : permission obligatoire côté serveur (§00.2-6 :
 *   « Masquer un bouton n'est jamais une protection »), avec restriction
 *   éventuelle par rubriques (`user_roles.category_ids`).
 * - Matrice des 10 rôles système (§08.2), créés par le seed.
 *
 * Les fonctions lèvent `PermissionError` / `UnauthenticatedError`,
 * converties en 401/403 par les helpers API (`lib/api/respond`).
 */

export class UnauthenticatedError extends Error {
  readonly code = "UNAUTHENTICATED";
  constructor(message = "Session requise.") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

export class PermissionError extends Error {
  readonly code = "FORBIDDEN";
  constructor(message = "Permission refusée.") {
    super(message);
    this.name = "PermissionError";
  }
}

// ─── Matrice des rôles système (§08.2, contractuel) ───────────────────

// ─── Calcul des permissions effectives ────────────────────────────────

export function resolveRolePermissions(roleKey: string): Set<Permission> {
  const tokens = SYSTEM_ROLES[roleKey];
  const set = new Set<Permission>();
  if (!tokens) return set;
  for (const token of tokens) {
    if (token === "*") {
      // admin : toutes les permissions (§08.2)
      for (const p of PERMISSIONS) set.add(p);
      continue;
    }
    for (const p of expandPermissionToken(token)) set.add(p);
  }
  return set;
}

/**
 * Charge l'utilisateur de session avec ses rôles et restrictions par
 * rubrique, depuis la base (source de vérité §08.2).
 */
export async function loadSessionUser(userId: string): Promise<SessionUser | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      display_name: true,
      slug: true,
      locale: true,
      status: true,
      two_factor_enabled: true,
      deleted_at: true,
      userRoles: {
        select: {
          category_ids: true,
          role: {
            select: { key: true, permissions: true },
          },
        },
      },
    },
  });

  if (!user || user.deleted_at) return null;

  const roles = user.userRoles.map((ur) => ({
    key: ur.role.key,
    categoryIds: parseJsonArray(ur.category_ids),
    explicitPermissions: parseJsonArray(ur.role.permissions),
  }));

  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    slug: user.slug,
    locale: user.locale,
    status: user.status,
    twoFactorEnabled: user.two_factor_enabled,
    roles,
  };
}

/** Permissions effectives : union des rôles + permissions explicites de rôles personnalisés. */
export async function getEffectivePermissions(
  user: SessionUser
): Promise<Set<Permission>> {
  const set = new Set<Permission>();
  for (const role of user.roles) {
    for (const p of resolveRolePermissions(role.key)) set.add(p);
    // Rôles personnalisés : permissions stockées en base (§08.2 « l'administrateur
    // peut créer des rôles personnalisés en combinant librement »).
    for (const token of role.explicitPermissions) {
      for (const p of expandPermissionToken(token)) set.add(p);
    }
  }
  return set;
}

function isAdmin(user: SessionUser): boolean {
  return user.roles.some((r) => r.key === "admin");
}

/**
 * Restriction par rubrique (§08.2 section_editor) : le rôle est accordé
 * globalement (category_ids = null) ou limité aux rubriques listées.
 */
function categoryAllowed(
  user: SessionUser,
  permission: Permission,
  categoryIds: string[] | undefined
): boolean {
  if (isAdmin(user)) return true;
  if (categoryIds === undefined) {
    // Pas de contexte de rubrique : un utilisateur dont TOUS les rôles
    // porteurs de la permission sont restreints ne peut pas agir globalement.
    const relevantRoles = user.roles.filter((role) =>
      roleHasPermission(role, permission)
    );
    if (relevantRoles.length === 0) return false;
    return relevantRoles.some((r) => r.categoryIds === null);
  }
  return user.roles.some((role) => {
    if (!roleHasPermission(role, permission)) return false;
    const ids = role.categoryIds;
    if (ids === null) return true;
    return categoryIds.length > 0 && categoryIds.some((c) => ids.includes(c));
  });
}

function roleHasPermission(
  role: SessionUser["roles"][number],
  permission: Permission
): boolean {
  if (role.key === "admin") return true;
  for (const p of resolveRolePermissions(role.key)) {
    if (p === permission) return true;
  }
  for (const token of role.explicitPermissions) {
    for (const p of expandPermissionToken(token)) {
      if (p === permission) return true;
    }
  }
  return false;
}

// ─── Gardes (§20 Phase 1, tâche 7) ────────────────────────────────────

/**
 * Vérifie la permission côté serveur (§07.2 modèle obligatoire).
 * - `categoryId` : restreint la vérification aux rôles autorisés sur la
 *   rubrique (restriction section_editor, user_roles.category_ids).
 * - Règle dynamique §08.2 journaliste : `article.publish` autorisé si
 *   settings.editorial.journalist_can_publish = true.
 */
export async function hasPermission(
  user: SessionUser,
  permission: Permission,
  opts?: { categoryId?: string }
): Promise<boolean> {
  const effective = await getEffectivePermissions(user);
  if (!effective.has(permission)) return false;

  // Règle paramétrable du journaliste (§08.2)
  if (permission === "article.publish" && user.roles.some((r) => r.key === "journalist")) {
    const setting = await db.setting.findUnique({
      where: { key: "editorial.journalist_can_publish" },
      select: { value: true },
    });
    if (!setting || setting.value !== "true") {
      // La permission ne vient que de la matrice journaliste → refus
      const onlyJournalist = user.roles.every(
        (r) => r.key === "journalist" || !roleHasPermission(r, "article.publish")
      );
      if (onlyJournalist) return false;
    }
  }

  if (opts?.categoryId !== undefined) {
    return categoryAllowed(user, permission, [opts.categoryId]);
  }
  return categoryAllowed(user, permission, undefined);
}

export interface RequirePermissionOptions {
  categoryId?: string;
}

/** Garde dure : lève PermissionError (403) si la permission manque. */
export async function requirePermission(
  user: SessionUser,
  permission: Permission,
  opts?: RequirePermissionOptions
): Promise<void> {
  const allowed = await hasPermission(user, permission, opts);
  if (!allowed) {
    throw new PermissionError(
      `Permission requise : ${permission}${opts?.categoryId ? ` (rubrique ${opts.categoryId})` : ""}.`
    );
  }
}
