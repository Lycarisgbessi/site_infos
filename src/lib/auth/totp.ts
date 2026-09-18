import { TOTP } from "otplib";
import { NobleCryptoPlugin } from "@otplib/plugin-crypto-noble";
import { ScureBase32Plugin } from "@otplib/plugin-base32-scure";
import { db } from "@/lib/db";
import { hashPassword, secureToken, verifyPassword } from "@/lib/auth/password";

/**
 * 2FA TOTP (§08.3) — obligatoire pour admin, publisher, chief_editor,
 * ad_manager (contrôle à la connexion, server/services/auth.ts). Codes de
 * secours à usage unique, hachés Argon2id en `user_backup_codes` (D-04).
 *
 * otplib v13 : classe TOTP avec plugins crypto (noble) et base32 (scure),
 * tolérance ±30 s à la vérification (équivalent window=1 d'otplib v12).
 */

const totp = new TOTP({
  issuer: "INFOSPRO",
  crypto: new NobleCryptoPlugin(),
  base32: new ScureBase32Plugin(),
});

export const TWO_FACTOR_REQUIRED_ROLES = new Set([
  "admin",
  "publisher",
  "chief_editor",
  "ad_manager",
]);

export const BACKUP_CODES_COUNT = 10;

export function generateTotpSecret(): string {
  return totp.generateSecret();
}

export function getOtpauthUri(email: string, secret: string): string {
  return totp.toURI({ label: email, issuer: "INFOSPRO", secret });
}

export async function toQrDataUrl(uri: string): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(uri, {
    margin: 1,
    width: 240,
    color: { dark: "#14110F", light: "#FFFFFF" },
  });
}

export async function verifyTotpToken(secret: string, token: string): Promise<boolean> {
  try {
    const result = await totp.verify(token, {
      secret,
      epochTolerance: 30, // ±30 s — codes validés sur la période courante et voisine
    });
    return result.valid;
  } catch {
    return false;
  }
}

/** Génère les codes de secours (format XXXX-XXXX) — renvoyés une seule fois. */
export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  while (codes.length < BACKUP_CODES_COUNT) {
    const raw = secureToken(8).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const chunk = raw.slice(0, 8);
    if (chunk.length === 8) {
      codes.push(`${chunk.slice(0, 4)}-${chunk.slice(4, 8)}`);
    }
  }
  return codes;
}

/** Stocke les codes hachés (Argon2id) en base, remplace les anciens. */
export async function storeBackupCodes(
  userId: string,
  codes: string[]
): Promise<void> {
  const hashes = await Promise.all(codes.map((code) => hashPassword(code)));
  await db.$transaction([
    db.userBackupCode.deleteMany({ where: { user_id: userId } }),
    db.userBackupCode.createMany({
      data: hashes.map((code_hash) => ({ user_id: userId, code_hash })),
    }),
  ]);
}

/**
 * Consomme un code de secours : renvoie true si valide et non utilisé.
 * Vérification bornée (10 codes max) : comparaisons Argon2id séquentielles.
 */
export async function consumeBackupCode(
  userId: string,
  code: string
): Promise<boolean> {
  const normalized = code.trim().toUpperCase();
  const rows = await db.userBackupCode.findMany({
    where: { user_id: userId, used_at: null },
    select: { id: true, code_hash: true },
  });
  for (const row of rows) {
    if (await verifyPassword(row.code_hash, normalized)) {
      await db.userBackupCode.update({
        where: { id: row.id },
        data: { used_at: new Date() },
      });
      return true;
    }
  }
  return false;
}

/** Vérifie un jeton TOTP saisi (ou code de secours) pour l'utilisateur. */
export async function verifyTwoFactor(
  secret: string,
  userId: string,
  token: string
): Promise<boolean> {
  const normalized = token.replace(/\s+/g, "");
  // Format code de secours ?
  if (/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalized)) {
    return consumeBackupCode(userId, normalized);
  }
  if (!/^\d{6}$/.test(normalized)) return false;
  return verifyTotpToken(secret, normalized);
}
