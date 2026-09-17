import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";

/**
 * Mots de passe (§08.3) : 12 caractères minimum, vérifiés contre la base
 * de mots de passe compromis HIBP (k-anonymat), hachés en Argon2id.
 */

// Paramètres OWASP Argon2id (m=19 MiB, t=2, p=1) — l'algorithme par défaut
// de @node-rs/argon2 est Argon2id.
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const MIN_PASSWORD_LENGTH = 12;

export interface PasswordPolicyResult {
  ok: boolean;
  reason?: string;
}

export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      reason: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`,
    };
  }
  return { ok: true };
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(
  passwordHash: string,
  password: string
): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/**
 * Vérification HIBP par k-anonymat (§08.3) : seuls les 5 premiers
 * caractères du SHA-1 quittent le serveur. Politique fail-open avec
 * avertissement journalisé si l'API est injoignable (D-10).
 */
export async function isPasswordCompromised(password: string): Promise<boolean> {
  const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  try {
    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      {
        signal: AbortSignal.timeout(3000),
        headers: { "Add-Padding": "true" },
        cache: "no-store",
      }
    );
    if (!response.ok) {
      console.warn(`[hibp] réponse HTTP ${response.status} — vérification ignorée (fail-open).`);
      return false;
    }
    const body = await response.text();
    for (const line of body.split("\n")) {
      const [hashSuffix, count] = line.trim().split(":");
      if (hashSuffix === suffix && Number(count) > 0) return true;
    }
    return false;
  } catch (error) {
    console.warn(
      "[hibp] API injoignable — vérification ignorée (fail-open, D-10) :",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/** Jeton cryptographiquement sûr, encodé base64url. */
export function secureToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
