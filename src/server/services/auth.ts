import { db } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import {
  createSession,
  getRequestContext,
  revokeCurrentSession,
  revokeSessionById,
  revokeAllUserSessions,
} from "@/lib/auth/session";
import {
  hashPassword,
  validatePasswordPolicy,
  verifyPassword,
} from "@/lib/auth/password";
import { generateBackupCodes, storeBackupCodes, verifyTwoFactor } from "@/lib/auth/totp";
import {
  isLocked,
  lockRemainingSec,
  registerFailedAttempt,
  resetFailedAttempts,
} from "@/lib/auth/lockout";
import { PermissionError, UnauthenticatedError } from "@/lib/permissions";
import { ValidationError } from "@/lib/api/respond";
import type { AuthenticatedSession, RequestContext } from "@/lib/auth/types";
import { getSession } from "@/lib/auth/session";

/**
 * Service d'authentification (§08.3) — logique métier pure, appelée par
 * les Route Handlers /api/auth/* (D-07).
 */

export interface LoginOutcome {
  kind: "session";
  session: AuthenticatedSession;
}
export interface MfaOutcome {
  kind: "mfa_required";
  challengeToken: string;
}
export type AuthenticationOutcome = LoginOutcome | MfaOutcome;

export class LockedAccountError extends Error {
  readonly retryAfterSec: number;
  constructor(retryAfterSec: number) {
    super(
      `Compte temporairement verrouillé après trop d'échecs. Réessayez dans ${Math.ceil(retryAfterSec / 60)} minute(s).`
    );
    this.name = "LockedAccountError";
    this.retryAfterSec = retryAfterSec;
  }
}

export class InvalidCredentialsError extends Error {
  constructor(message = "Identifiants invalides.") {
    super(message);
    this.name = "InvalidCredentialsError";
  }
}

/**
 * Étape 1 — mot de passe (§08.3). Verrouillage 5 échecs / 15 min,
 * journalisation connexion/échec (§08.3 « Journalisation »).
 */
export async function authenticateWithPassword(
  email: string,
  password: string,
  request: RequestContext
): Promise<AuthenticationOutcome> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      password_hash: true,
      status: true,
      deleted_at: true,
      locked_until: true,
      two_factor_secret: true,
      two_factor_enabled: true,
    },
  });

  // Comparaison systématique pour éviter les canaux temporels
  const dummyHash =
    "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const valid = user
    ? await verifyPassword(user.password_hash ?? dummyHash, password)
    : await verifyPassword(dummyHash, password);

  if (!user || user.deleted_at || user.status === "disabled" || !valid) {
    if (user && !user.deleted_at) {
      const { locked } = await registerFailedAttempt(user.id);
      if (locked) {
        const fresh = await db.user.findUnique({
          where: { id: user.id },
          select: { locked_until: true },
        });
        await auditLog({
          userId: user.id,
          action: "auth.locked",
          resourceType: "user",
          resourceId: user.id,
          request,
        });
        throw new LockedAccountError(lockRemainingSec(fresh?.locked_until ?? null));
      }
      await auditLog({
        userId: user.id,
        action: "auth.login_failed",
        resourceType: "user",
        resourceId: user.id,
        request,
      });
    }
    throw new InvalidCredentialsError();
  }

  if (user.status === "suspended") {
    throw new PermissionError("Compte suspendu. Contactez un administrateur.");
  }

  if (isLocked(user.locked_until)) {
    throw new LockedAccountError(lockRemainingSec(user.locked_until));
  }

  // 2FA obligatoire pour certains rôles (§08.3) — si activée, second facteur
  if (user.two_factor_enabled && user.two_factor_secret) {
    const { createMfaChallenge } = await import("@/lib/auth/challenge");
    return { kind: "mfa_required", challengeToken: createMfaChallenge(user.id) };
  }

  return finalizeLogin(user.id, false, request);
}

/** Étape 2 — second facteur TOTP ou code de secours. */
export async function authenticateWithMfa(
  userId: string,
  token: string,
  rememberMe: boolean,
  request: RequestContext
): Promise<LoginOutcome> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      two_factor_secret: true,
      two_factor_enabled: true,
      deleted_at: true,
      locked_until: true,
      status: true,
    },
  });

  if (!user || user.deleted_at || !user.two_factor_enabled || !user.two_factor_secret) {
    throw new UnauthenticatedError("Défi MFA invalide.");
  }
  if (isLocked(user.locked_until)) {
    throw new LockedAccountError(lockRemainingSec(user.locked_until));
  }

  const valid = await verifyTwoFactor(user.two_factor_secret, user.id, token);
  if (!valid) {
    await auditLog({
      userId: user.id,
      action: "auth.mfa_failed",
      resourceType: "user",
      resourceId: user.id,
      request,
    });
    throw new InvalidCredentialsError("Code de vérification invalide.");
  }

  return finalizeLogin(user.id, rememberMe, request);
}

/** Connexion réussie : session, compteurs, audit. */
async function finalizeLogin(
  userId: string,
  rememberMe: boolean,
  request: RequestContext
): Promise<LoginOutcome> {
  await resetFailedAttempts(userId);
  await db.user.update({
    where: { id: userId },
    data: { last_login_at: new Date() },
  });
  await createSession(userId, { rememberMe, request });
  await auditLog({
    userId,
    action: "auth.login",
    resourceType: "user",
    resourceId: userId,
    request,
  });
  const { getSession: getFreshSession } = await import("@/lib/auth/session");
  const session = await getFreshSession();
  if (!session) {
    throw new UnauthenticatedError("Impossible d'établir la session.");
  }
  return { kind: "session", session };
}

// ─── 2FA : activation (§08.3) ──────────────────────────────────────────

export interface TwoFactorSetup {
  secret: string;
  otpauthUri: string;
  qrDataUrl: string;
  backupCodes: string[];
}

/**
 * Génère le secret TOTP et les codes de secours. Le secret est stocké
 * mais la 2FA n'est activée qu'après vérification d'un premier code.
 * Les codes de secours ne sont renvoyés qu'une fois.
 */
export async function setupTwoFactor(
  userId: string,
  email: string
): Promise<TwoFactorSetup> {
  const { generateTotpSecret, getOtpauthUri, toQrDataUrl, generateBackupCodes } =
    await import("@/lib/auth/totp");

  const secret = generateTotpSecret();
  const otpauthUri = getOtpauthUri(email, secret);
  const qrDataUrl = await toQrDataUrl(otpauthUri);
  const backupCodes = generateBackupCodes();
  await storeBackupCodes(userId, backupCodes);

  await db.user.update({
    where: { id: userId },
    data: { two_factor_secret: secret, two_factor_enabled: false },
  });

  await auditLog({
    userId,
    action: "auth.2fa_setup",
    resourceType: "user",
    resourceId: userId,
  });

  return { secret, otpauthUri, qrDataUrl, backupCodes };
}

/** Active la 2FA après vérification d'un code valide. */
export async function activateTwoFactor(token: string): Promise<void> {
  const session = await getSession();
  if (!session) throw new UnauthenticatedError();

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { two_factor_secret: true },
  });
  if (!user?.two_factor_secret) {
    throw new ValidationError("Aucun secret TOTP généré. Reprenez la configuration.");
  }

  const { verifyTotpToken } = await import("@/lib/auth/totp");
  if (!verifyTotpToken(user.two_factor_secret, token)) {
    throw new ValidationError("Code invalide. La 2FA n'a pas été activée.");
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { two_factor_enabled: true },
  });
  await auditLog({
    userId: session.user.id,
    action: "auth.2fa_activated",
    resourceType: "user",
    resourceId: session.user.id,
    request: { ip: null, userAgent: null },
  });
}

// ─── Déconnexion et sessions (§08.3 liste + révocation) ────────────────

export async function logout(request: RequestContext): Promise<void> {
  const session = await getSession();
  if (session) {
    await auditLog({
      userId: session.user.id,
      action: "auth.logout",
      resourceType: "user",
      resourceId: session.user.id,
      request,
    });
  }
  await revokeCurrentSession();
}

export async function revokeOwnSession(sessionId: string): Promise<boolean> {
  const session = await getSession();
  if (!session) throw new UnauthenticatedError();
  const revoked = await revokeSessionById(sessionId, session.user.id);
  if (revoked) {
    await auditLog({
      userId: session.user.id,
      action: "auth.session_revoked",
      resourceType: "session",
      resourceId: sessionId,
    });
  }
  return revoked;
}

// ─── Utilitaires comptes (§08.3) ────────────────────────────────────────

/** Change le mot de passe : politique, HIBP, révocation des sessions. */
export async function changePassword(
  userId: string,
  newPassword: string,
  request: RequestContext
): Promise<void> {
  const policy = validatePasswordPolicy(newPassword);
  if (!policy.ok) {
    throw new ValidationError(policy.reason ?? "Mot de passe refusé.");
  }
  const { isPasswordCompromised } = await import("@/lib/auth/password");
  if (await isPasswordCompromised(newPassword)) {
    throw new ValidationError(
      "Ce mot de passe figure dans une base de mots de passe compromis. Choisissez-en un autre."
    );
  }
  const password_hash = await hashPassword(newPassword);
  await db.user.update({ where: { id: userId }, data: { password_hash } });
  await revokeAllUserSessions(userId);
  await auditLog({
    userId,
    action: "auth.password_changed",
    resourceType: "user",
    resourceId: userId,
    request,
  });
}
