import { db } from "@/lib/db";

/**
 * GET /api/files/{key} — sert un fichier du stockage de secours en base
 * (serverless : FS lecture seule). Cache immutable : les clés contiennent
 * un identifiant unique, le contenu ne change jamais.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key: segments } = await params;
  const key = segments.map(decodeURIComponent).join("/");
  if (!key || key.includes("..")) {
    return new Response("Clé invalide", { status: 400 });
  }

  const file = await db.storedFile.findUnique({ where: { key } });
  if (!file) return new Response("Fichier introuvable", { status: 404 });

  const bytes = new Uint8Array(file.data);
  return new Response(bytes, {
    headers: {
      "Content-Type": file.content_type,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
