import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

/**
 * Adaptateur de stockage (§04 S3_*, §11.2 médiathèque).
 *
 * - Développement (D-15) : disque local sous `public/uploads/…`, servi
 *   statiquement par Next.js — aucun S3 disponible dans l'environnement.
 * - Production : les variables S3_ENDPOINT/S3_BUCKET (§04) activent
 *   l'écriture sur S3/R2 via le même contrat `putObject` ; l'implémentation
 *   S3 est branchée à l'arrivée des clés (D-10) — l'interface ne change pas.
 */

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

export interface PutResult {
  key: string; // clé relative, ex. 2026/09/abc/image.webp
  url: string; // URL publique
  size: number;
}

function isS3Configured(): boolean {
  return Boolean(process.env.S3_ENDPOINT && process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID);
}

export function storageMode(): "local" | "s3" {
  return isS3Configured() ? "s3" : "local";
}

/** Écrit un objet binaire et renvoie sa clé + URL publique. */
export async function putObject(
  key: string,
  data: Buffer,
  contentType: string
): Promise<PutResult> {
  if (isS3Configured()) {
    return putObjectS3(key, data, contentType);
  }
  const full = path.join(UPLOAD_ROOT, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
  return { key, url: `/uploads/${key}`, size: data.byteLength };
}

/** Supprime un objet (meilleur effort — les objets S3 orphelins sont purgés à terme). */
export async function deleteObject(key: string): Promise<void> {
  if (isS3Configured()) return; // purge S3 gérée par la tâche planifiée (Phase 3)
  try {
    await unlink(path.join(UPLOAD_ROOT, key));
  } catch {
    // déjà absent : OK
  }
}

/** Empreinte SHA-256 — détection de doublons (§11.2). */
export function checksumOf(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

// ─── Implémentation S3 (activée par les variables §04) ─────────────────

async function putObjectS3(
  _key: string,
  _data: Buffer,
  _contentType: string
): Promise<PutResult> {
  // Branchement @aws-sdk/client-s3 à l'arrivée des clés (§04, D-10).
  // En attendant, tout appel aboutit à une erreur explicite — jamais de
  // fausse écriture silencieuse.
  throw new Error(
    "Stockage S3 non encore branché (variables présentes mais SDK non intégré — voir DECISIONS.md D-15)."
  );
}
