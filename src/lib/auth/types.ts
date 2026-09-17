/**
 * Types partagés de la couche d'authentification (§08.3).
 */

export type UserStatusType = "active" | "invited" | "suspended" | "disabled";

/** Rôle porté par un utilisateur de session (§08.2). */
export interface SessionRole {
  /** Clé du rôle : admin, publisher, chief_editor… */
  key: string;
  /** Restriction par rubriques — null = non restreint (user_roles.category_ids). */
  categoryIds: string[] | null;
  /** Permissions explicites d'un rôle personnalisé (roles.permissions). */
  explicitPermissions: string[];
}

/** Utilisateur résolu pour les vérifications de permission côté serveur. */
export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  slug: string;
  locale: string;
  status: UserStatusType;
  twoFactorEnabled: boolean;
  roles: SessionRole[];
}

/** Session authentifiée validée (table sessions, §06.2). */
export interface AuthenticatedSession {
  sessionId: string;
  expiresAt: Date;
  rememberMe: boolean;
  user: SessionUser;
}

/** Contexte de requête pour l'audit et les sessions. */
export interface RequestContext {
  ip: string | null;
  userAgent: string | null;
}
