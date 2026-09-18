import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Jetons de prévisualisation (§11.1 : « route /admin/preview/{id}?token= »).
 * HMAC-SHA256 sur (articleId, expiration 24 h) avec AUTH_SECRET — permet
 * de partager l'aperçu d'un brouillon sans session back-office.
 */

const PREVIEW_TTL_MS = 24 * 3600 * 1000;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET manquante (jeton de prévisualisation).");
  return s;
}

export function signPreviewToken(articleId: string): string {
  const exp = Date.now() + PREVIEW_TTL_MS;
  const sig = createHmac("sha256", secret()).update(`${articleId}.${exp}`).digest("hex");
  return `${Buffer.from(articleId).toString("base64url")}.${exp}.${sig}`;
}

export function verifyPreviewToken(token: string, articleId: string): boolean {
  try {
    const [b64, expRaw, sig] = token.split(".");
    if (!b64 || !expRaw || !sig) return false;
    const id = Buffer.from(b64, "base64url").toString("utf8");
    if (id !== articleId) return false;
    const exp = Number(expRaw);
    if (!Number.isFinite(exp) || exp < Date.now()) return false;
    const expected = createHmac("sha256", secret()).update(`${id}.${exp}`).digest("hex");
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
