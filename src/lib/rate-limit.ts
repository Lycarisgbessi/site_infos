import { redis } from "@/lib/redis";

/**
 * Rate limiting (§17.1) — fenêtre fixe, stockage Redis (repli mémoire D-10).
 *
| Usage                  | Limite            |
|------------------------|-------------------|
| authentification       | 5 / 15 min        |
| formulaires publics    | 3 / min           |
| recherche              | 30 / min          |
| API publique           | 120 / min         |
 */

export const RATE_LIMITS = {
  auth: { limit: 5, windowSec: 15 * 60 },
  form: { limit: 3, windowSec: 60 },
  search: { limit: 30, windowSec: 60 },
  api: { limit: 120, windowSec: 60 },
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export async function rateLimit(
  name: RateLimitName,
  identifier: string
): Promise<RateLimitResult> {
  const { limit, windowSec } = RATE_LIMITS[name];
  const windowId = Math.floor(Date.now() / (windowSec * 1000));
  const key = `rl:${name}:${identifier}:${windowId}`;

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSec);
  }

  if (count > limit) {
    const ttl = await redis.ttl(key);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: ttl > 0 ? ttl : windowSec,
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - count),
    retryAfterSec: 0,
  };
}
