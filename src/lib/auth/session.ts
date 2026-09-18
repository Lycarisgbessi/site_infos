import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { loadSessionUser } from "@/lib/permissions";
import { secureToken } from "@/lib/auth/password";
import type {
  AuthenticatedSession,
  RequestContext,
  SessionUser,
} from "@/lib/auth/types";

/**
 * Sessions serveur opaques (§06.2 table `sessions`, §08.3) :
 * - token aléatoire 32 octets, seul le SHA-256 est stocké (token_hash) ;
 * - cookie httpOnly, secure, sameSite=lax ;
 * - 8 h d'inactivité (glissant), 30 jours maximum avec « se souvenir de moi » ;
 * - révocation individuelle et globale (liste des sessions §08.3).
 *
 * Le mode « se souvenir » est encodé dans le suffixe du cookie (`token.r`),
 * jamais en base : le schéma contractuel de `sessions` n'est pas étendu.
 * Décision D-03 : couche custom, NextAuth non utilisé pour ce flux.
 */

export const SESSION_COOKIE = "infospro_session";

export const IDLE_TTL_SEC = 8 * 60 * 60; // 8 h d'inactivité
export const ABSOLUTE_TTL_SEC_REMEMBER = 30 * 24 * 60 * 60; // 30 jours
const RENEW_THRESHOLD_SEC = 10 * 60; // ne réécrire qu'au-delà de 10 min gagnées

const REMEMBER_SUFFIX = ".r";

function rawTokenFromCookie(cookieValue: string): string | null {
  const token = cookieValue.endsWith(REMEMBER_SUFFIX)
    ? cookieValue.slice(0, -REMEMBER_SUFFIX.length)
    : cookieValue;
  return token.length > 0 ? token : null;
}

function rememberModeFromCookie(cookieValue: string): boolean {
  return cookieValue.endsWith(REMEMBER_SUFFIX);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Hachage d'IP avec sel (§17.3 : « IP jamais stockée en clair »). */
export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const pepper = process.env.AUTH_SECRET ?? "";
  return createHash("sha256").update(`${ip}:${pepper}`).digest("hex");
}

/** IP client depuis les en-têtes du proxy/CDN. */
export function getClientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip");
}

export function getRequestContext(headers: Headers): RequestContext {
  return {
    ip: getClientIp(headers),
    userAgent: headers.get("user-agent"),
  };
}

interface CreateSessionOptions {
  rememberMe?: boolean;
  request: RequestContext;
}

function cookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

/** Crée une session en base et pose le cookie (§08.3). */
export async function createSession(
  userId: string,
  opts: CreateSessionOptions
): Promise<void> {
  const token = secureToken(32);
  const rememberMe = opts.rememberMe ?? false;
  const now = Date.now();
  const idleExpiry = now + IDLE_TTL_SEC * 1000;
  const absoluteExpiry =
    now + (rememberMe ? ABSOLUTE_TTL_SEC_REMEMBER : IDLE_TTL_SEC) * 1000;
  const expiresAt = new Date(Math.min(idleExpiry, absoluteExpiry));

  await db.session.create({
    data: {
      user_id: userId,
      token_hash: hashToken(token),
      ip_hash: hashIp(opts.request.ip),
      user_agent: opts.request.userAgent?.slice(0, 500) ?? null,
      expires_at: expiresAt,
    },
  });

  const store = await cookies();
  store.set(
    SESSION_COOKIE,
    rememberMe ? `${token}${REMEMBER_SUFFIX}` : token,
    cookieOptions(expiresAt)
  );
}

/**
 * Valide le cookie de session, applique l'expiration glissante (8 h
 * d'inactivité, plafonnée à la durée absolue du mode) et renvoie la session.
 */
export async function getSession(): Promise<AuthenticatedSession | null> {
  const store = await cookies();
  const cookieValue = store.get(SESSION_COOKIE)?.value;
  if (!cookieValue) return null;

  const token = rawTokenFromCookie(cookieValue);
  if (!token) return null;
  const rememberMe = rememberModeFromCookie(cookieValue);
  const absoluteTtlSec = rememberMe ? ABSOLUTE_TTL_SEC_REMEMBER : IDLE_TTL_SEC;

  const session = await db.session.findUnique({
    where: { token_hash: hashToken(token) },
    include: { user: { select: { id: true, status: true, deleted_at: true } } },
  });
  if (!session) return null;
  if (session.user.deleted_at) return null;
  if (session.user.status === "disabled" || session.user.status === "suspended") {
    return null;
  }
  if (session.expires_at.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  const user: SessionUser | null = await loadSessionUser(session.user.id);
  if (!user) return null;

  // Expiration glissante : prolonge de 8 h sans dépasser le plafond absolu
  const absoluteDeadline =
    session.created_at.getTime() + absoluteTtlSec * 1000;
  const renewedExpiry = Math.min(Date.now() + IDLE_TTL_SEC * 1000, absoluteDeadline);
  const gainMs = renewedExpiry - session.expires_at.getTime();
  let effectiveExpiry = session.expires_at;
  if (gainMs > RENEW_THRESHOLD_SEC * 1000) {
    effectiveExpiry = new Date(renewedExpiry);
    await db.session
      .update({ where: { id: session.id }, data: { expires_at: effectiveExpiry } })
      .catch(() => undefined);
    store.set(
      SESSION_COOKIE,
      rememberMe ? `${token}${REMEMBER_SUFFIX}` : token,
      cookieOptions(effectiveExpiry)
    );
  }

  return {
    sessionId: session.id,
    expiresAt: effectiveExpiry,
    rememberMe,
    user,
  };
}

/** Révoque la session courante (déconnexion) et efface le cookie. */
export async function revokeCurrentSession(): Promise<void> {
  const store = await cookies();
  const cookieValue = store.get(SESSION_COOKIE)?.value;
  if (cookieValue) {
    const token = rawTokenFromCookie(cookieValue);
    if (token) {
      await db.session
        .deleteMany({ where: { token_hash: hashToken(token) } })
        .catch(() => undefined);
    }
  }
  store.delete(SESSION_COOKIE);
}

/** Révoque une session précise de l'utilisateur (liste des sessions §08.3). */
export async function revokeSessionById(
  sessionId: string,
  userId: string
): Promise<boolean> {
  const result = await db.session.deleteMany({
    where: { id: sessionId, user_id: userId },
  });
  return result.count > 0;
}

/** Révoque toutes les sessions d'un utilisateur (changement de mot de passe…). */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { user_id: userId } });
}

/** Liste des sessions actives de l'utilisateur (§08.3). */
export async function listUserSessions(userId: string) {
  return db.session.findMany({
    where: { user_id: userId, expires_at: { gt: new Date() } },
    select: {
      id: true,
      ip_hash: true,
      user_agent: true,
      created_at: true,
      expires_at: true,
    },
    orderBy: { created_at: "desc" },
  });
}
