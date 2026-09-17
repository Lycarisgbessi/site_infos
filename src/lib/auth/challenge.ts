import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Jeton de défi MFA : transporte l'identifiant d'utilisateur entre
 * l'étape « mot de passe » et l'étape « TOTP » de la connexion, sans
 * créer de session. Signé HMAC-SHA256 avec AUTH_SECRET, expirant 5 min.
 */

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

interface ChallengePayload {
  sub: string;
  purpose: "mfa";
  exp: number;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function secret(): string {
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) {
    throw new Error("AUTH_SECRET manquante — impossible de signer le défi MFA.");
  }
  return authSecret;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function createMfaChallenge(userId: string): string {
  const payload: ChallengePayload = {
    sub: userId,
    purpose: "mfa",
    exp: Date.now() + CHALLENGE_TTL_MS,
  };
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifyMfaChallenge(token: string): string | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as ChallengePayload;
    if (payload.purpose !== "mfa") return null;
    if (payload.exp <= Date.now()) return null;
    return payload.sub;
  } catch {
    return null;
  }
}
