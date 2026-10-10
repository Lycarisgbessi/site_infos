import { z } from "zod";
import { db } from "@/lib/db";
import { apiOk, apiError } from "@/lib/api/respond";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/public/push/unsubscribe — supprime une subscription par endpoint.
 */

const bodySchema = z.object({
  endpoint: z.string().url().max(2048),
});

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const rl = await rateLimit("form", `push-unsubscribe:${ip}`);
    if (!rl.allowed) {
      return apiError(429, "rate_limited", "Trop de tentatives. Réessayez dans une minute.");
    }

    const json: unknown = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return apiError(400, "invalid_endpoint", "Endpoint invalide.");
    }

    await db.pushSubscription.deleteMany({ where: { endpoint: parsed.data.endpoint } });
    return apiOk({ ok: true });
  } catch (error) {
    console.error("[push/unsubscribe]", error);
    return apiError(500, "server_error", "Erreur serveur.");
  }
}
