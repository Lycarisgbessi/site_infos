import { NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiOk, apiError } from "@/lib/api/respond";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/public/subscribe — inscription newsletter depuis le front-office
 * public (Z-09). Valide l'e-mail, upsert le Subscriber et l'attache à la
 * liste demandée (key). Public, rate-limité (3 req/min par IP).
 * Task ID: 9-API
 */

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  listKey: z.string().trim().min(1).max(50),
  source: z.string().trim().max(40).optional(),
});

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const rl = await rateLimit("form", `subscribe:${ip}`);
    if (!rl.allowed) {
      return apiError(429, "rate_limited", "Trop de tentatives. Réessayez dans une minute.", {
        "Retry-After": String(rl.retryAfterSec ?? 60),
      });
    }

    const json: unknown = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return apiError(400, "invalid_email", "Merci de saisir une adresse e-mail valide.");
    }
    const { email, listKey, source } = parsed.data;

    const list = await db.newsletterList.findUnique({ where: { key: listKey }, select: { id: true, is_active: true } });
    if (!list || !list.is_active) {
      return apiError(404, "list_not_found", "Liste de diffusion introuvable.");
    }

    const existing = await db.subscriber.findUnique({ where: { email }, select: { id: true } });
    const subscriber = existing
      ? await db.subscriber.update({
          where: { email },
          data: { status: "pending", unsubscribed_at: null },
          select: { id: true },
        })
      : await db.subscriber.create({
          data: {
            email,
            status: "pending",
            confirm_token: randomBytes(24).toString("base64url"),
            unsubscribe_token: randomBytes(24).toString("base64url"),
            consent_at: new Date(),
            consent_ip_hash: createHash("sha256").update(ip).digest("hex").slice(0, 32),
            source: source ?? "home_inline",
          },
          select: { id: true },
        });

    await db.subscriberList.upsert({
      where: { subscriber_id_list_id: { subscriber_id: subscriber.id, list_id: list.id } },
      create: { subscriber_id: subscriber.id, list_id: list.id },
      update: {},
    });

    return apiOk({ ok: true });
  } catch (error) {
    console.error("[api/public/subscribe]", error);
    return apiError(500, "server_error", "Une erreur est survenue. Merci de réessayer.");
  }
}
