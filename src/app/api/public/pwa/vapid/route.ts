import { NextResponse } from "next/server";

/**
 * GET /api/public/pwa/vapid — expose la clé publique VAPID au client
 * (nécessaire à pushManager.subscribe). La clé privée reste côté serveur.
 */
export function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
  return NextResponse.json(
    { data: publicKey ? { publicKey } : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
