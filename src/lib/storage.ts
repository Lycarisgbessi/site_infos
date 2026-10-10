import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

/**
 * Adaptateur de stockage (§04 S3_*, §11.2 médiathèque).
 *
 * - Développement (D-15) : disque local sous `public/uploads/…`, servi
 *   statiquement par Next.js — aucun S3 disponible dans l'environnement.
 * - Cloudinary : si CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY /
 *   CLOUDINARY_API_SECRET sont renseignées, les fichiers sont envoyés via
 *   l'API REST signée (SHA-1, node crypto — pas de SDK, pas de dépendance)
 *   et servis depuis `res.cloudinary.com`.
 * - Production S3 : les variables S3_ENDPOINT/S3_BUCKET (§04) activent
 *   l'écriture sur S3/R2 via le même contrat `putObject` ; l'implémentation
 *   S3 est branchée à l'arrivée des clés (D-10) — l'interface ne change pas.
 *
 * Priorité : Cloudinary > S3 > disque local (repli).
 */

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

export interface PutResult {
  key: string; // clé relative (local/S3) ou public_id (Cloudinary)
  url: string; // URL publique
  size: number;
}

function isS3Configured(): boolean {
  return Boolean(process.env.S3_ENDPOINT && process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID);
}

interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

function getCloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

export function storageMode(): "local" | "s3" | "cloudinary" {
  if (getCloudinaryConfig()) return "cloudinary";
  return isS3Configured() ? "s3" : "local";
}

export function isCloudinaryActive(): boolean {
  return getCloudinaryConfig() !== null;
}

/** Écrit un objet binaire et renvoie sa clé + URL publique. */
export async function putObject(
  key: string,
  data: Buffer,
  contentType: string
): Promise<PutResult> {
  const cloud = getCloudinaryConfig();
  if (cloud) return putObjectCloudinary(cloud, key, data, contentType);
  if (isS3Configured()) {
    return putObjectS3(key, data, contentType);
  }
  const full = path.join(UPLOAD_ROOT, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
  return { key, url: `/uploads/${key}`, size: data.byteLength };
}

/** Supprime un objet (meilleur effort — les objets S3/Cloudinary orphelins sont purgés à terme). */
export async function deleteObject(key: string): Promise<void> {
  const cloud = getCloudinaryConfig();
  if (cloud) {
    if (key.startsWith("cloudinary:")) {
      const publicId = key.slice("cloudinary:".length);
      await destroyCloudinary(cloud, publicId).catch(() => undefined);
    }
    return; // clés locales historiques : rien à faire côté disque en mode Cloudinary
  }
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

/**
 * Insère des transformations Cloudinary dans une URL /upload/ :
 * f_auto,q_auto,w_{width} (remplace /upload/ par /upload/f_auto,q_auto,w_{width}/).
 * Les URLs non-Cloudinary (locales) sont retournées inchangées.
 */
export function transformUrl(url: string, opts: { width: number }): string {
  if (!url.includes("/upload/")) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${Math.round(opts.width)}/`);
}

// ─── Implémentation Cloudinary (API REST signée, sans SDK) ─────────────

type CloudinaryResourceType = "image" | "video" | "raw";

function resourceTypeFor(contentType: string): CloudinaryResourceType {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  return "raw";
}

/** Signature SHA-1 des paramètres triés + api_secret (auth signée Cloudinary). */
function signParams(params: Record<string, string>, apiSecret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(toSign + apiSecret).digest("hex");
}

interface CloudinaryUploadResponse {
  secure_url?: string;
  url?: string;
  public_id?: string;
  bytes?: number;
}

async function putObjectCloudinary(
  cloud: CloudinaryConfig,
  key: string,
  data: Buffer,
  contentType: string
): Promise<PutResult> {
  const resourceType = resourceTypeFor(contentType);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params: Record<string, string> = { timestamp };
  const signature = signParams(params, cloud.apiSecret);

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(data)], { type: contentType }), key);
  form.append("api_key", cloud.apiKey);
  form.append("timestamp", timestamp);
  form.append("signature", signature);
  // Aucun paramètre de transformation : les GIF conservent leur animation,
  // l'original est servi tel quel.

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloud.cloudName}/${resourceType}/upload`,
    { method: "POST", body: form }
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Upload Cloudinary échoué (${res.status}) : ${detail.slice(0, 300)}`);
  }
  const json = (await res.json()) as CloudinaryUploadResponse;
  const url = json.secure_url ?? json.url;
  const publicIdOut = json.public_id;
  if (!url || !publicIdOut) throw new Error("Réponse Cloudinary invalide (secure_url/public_id absents).");
  // Les GIF sont uploadés sans transformation (resource_type=image, aucun
  // paramètre de transformation) : l'animation est préservée.
  return { key: `cloudinary:${publicIdOut}`, url, size: json.bytes ?? data.byteLength };
}

/** Destroy signé (meilleur effort). */
async function destroyCloudinary(cloud: CloudinaryConfig, publicId: string): Promise<void> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params: Record<string, string> = { timestamp };
  const signature = signParams(params, cloud.apiSecret);
  const form = new FormData();
  form.append("api_key", cloud.apiKey);
  form.append("timestamp", timestamp);
  form.append("signature", signature);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloud.cloudName}/image/destroy?public_id=${encodeURIComponent(publicId)}`,
    { method: "POST", body: form }
  );
  if (!res.ok) throw new Error(`Destroy Cloudinary échoué (${res.status}).`);
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
