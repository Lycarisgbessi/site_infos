import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiOk, apiError } from "@/lib/api/respond";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/public/push/subscribe — enregistre une subscription Push (Web Push).
 * Valide le format standard PushSubscriptionJSON, upsert par endpoint unique.
 * Le modèle `PushSubscription` existant stocke les clés en JSON (`keys`).
 */

const bodySchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z
    .object({
      p256dh: z.string().min(1).max(512),
      auth: z.string().min(1).max(512),
    })
    .passthrough()
    .optional(),
  expirationTime: z.number().int().nullable().optional(),
  locale: z.string().trim().max(10).optional(),
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
    const rl = await rateLimit("form", `push-subscribe:${ip}`);
    if (!rl.allowed) {
      return apiError(429, "rate_limited", "Trop de tentatives. Réessayez dans une minute.", {
        "Retry-After": String(rl.retryAfterSec ?? 60),
      });
    }

    const json: unknown = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return apiError(400, "invalid_subscription", "Subscription push invalide.");
    }
    const { endpoint, keys, locale } = parsed.data;

    await db.pushSubscription.upsert({
      where: { endpoint },
      create: {
        endpoint,
        keys: JSON.stringify(keys ?? {}),
        locale: locale ?? "fr",
      },
      update: {
        keys: JSON.stringify(keys ?? {}),
        locale: locale ?? "fr",
      },
    });

    return apiOk({ ok: true });
  } catch (error) {
    console.error("[push/subscribe]", error);
    return apiError(500, "server_error", "Erreur serveur.");
  }
}
