/**
 * Client Redis (§03 lib/redis.ts) — Upstash Redis REST (§02.1).
 *
 * Si UPSTASH_REDIS_REST_URL/TOKEN sont présents : vrai client REST Upstash.
 * Sinon : repli mémoire process, explicite et journalisé une seule fois
 * (DECISIONS.md D-10) — mono-instance de développement uniquement.
 *
 * Opérations utilisées par : rate limiting (§17.1), compteurs de vues
 * (§16.3 « Redis, agrégés en base toutes les minutes »), capping pub
 * (§13.2 « cap:{campaignId}:{visitorHash}:{yyyymmdd} »), sessions.
 */

interface RedisLike {
  readonly backend: "upstash" | "memory";
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts?: { ex?: number; px?: number }): Promise<void>;
  del(...keys: string[]): Promise<void>;
  incr(key: string): Promise<number>;
  incrBy(key: string, delta: number): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  ttl(key: string): Promise<number>;
  ping(): Promise<boolean>;
}

// ─── Repli mémoire ─────────────────────────────────────────────────────

interface MemoryEntry {
  value: string;
  expiresAt: number | null;
}

const memoryStore = new Map<string, MemoryEntry>();

function memoryGet(key: string): string | null {
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

function memorySweep(): void {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (entry.expiresAt !== null && entry.expiresAt <= now) memoryStore.delete(key);
  }
}

const memoryBackend: RedisLike = {
  backend: "memory",
  async get(key) {
    return memoryGet(key);
  },
  async set(key, value, opts) {
    memorySweep();
    const expiresAt =
      opts?.ex != null
        ? Date.now() + opts.ex * 1000
        : opts?.px != null
          ? Date.now() + opts.px
          : null;
    memoryStore.set(key, { value, expiresAt });
  },
  async del(...keys) {
    for (const key of keys) memoryStore.delete(key);
  },
  async incr(key) {
    return memoryBackend.incrBy(key, 1);
  },
  async incrBy(key, delta) {
    memorySweep();
    const current = Number(memoryGet(key) ?? "0");
    const next = Number.isFinite(current) ? current + delta : delta;
    const entry = memoryStore.get(key);
    memoryStore.set(key, {
      value: String(next),
      expiresAt: entry?.expiresAt ?? null,
    });
    return next;
  },
  async expire(key, seconds) {
    const entry = memoryStore.get(key);
    if (entry) {
      memoryStore.set(key, { ...entry, expiresAt: Date.now() + seconds * 1000 });
    }
  },
  async ttl(key) {
    const entry = memoryStore.get(key);
    if (!entry) return -2;
    if (entry.expiresAt === null) return -1;
    return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
  },
  async ping() {
    return true;
  },
};

// ─── Backend Upstash ───────────────────────────────────────────────────

function createUpstashBackend(
  url: string,
  token: string,
): RedisLike {
  const call = async (
    command: (string | number)[],
  ): Promise<unknown> => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Upstash HTTP ${response.status}`);
    }
    const json = (await response.json()) as { result?: unknown; error?: string };
    if (json.error) throw new Error(`Upstash: ${json.error}`);
    return json.result;
  };

  return {
    backend: "upstash",
    async get(key) {
      const result = await call(["GET", key]);
      return result == null ? null : String(result);
    },
    async set(key, value, opts) {
      const command: (string | number)[] = ["SET", key, value];
      if (opts?.ex != null) command.push("EX", opts.ex);
      if (opts?.px != null) command.push("PX", opts.px);
      await call(command);
    },
    async del(...keys) {
      if (keys.length === 0) return;
      await call(["DEL", ...keys]);
    },
    async incr(key) {
      const result = await call(["INCR", key]);
      return Number(result ?? 0);
    },
    async incrBy(key, delta) {
      const result = await call(["INCRBY", key, delta]);
      return Number(result ?? 0);
    },
    async expire(key, seconds) {
      await call(["EXPIRE", key, seconds]);
    },
    async ttl(key) {
      const result = await call(["TTL", key]);
      return Number(result ?? -2);
    },
    async ping() {
      try {
        await call(["PING"]);
        return true;
      } catch {
        return false;
      }
    },
  };
}

// ─── Instance singleton ────────────────────────────────────────────────

const globalForRedis = globalThis as unknown as {
  infosproRedis: RedisLike | undefined;
};

function createRedis(): RedisLike {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return createUpstashBackend(url, token);
  }
  console.warn(
    "[redis] UPSTASH_REDIS_REST_URL/TOKEN absents — repli mémoire process activé " +
      "(développement mono-instance uniquement, voir docs/DECISIONS.md D-10)."
  );
  return memoryBackend;
}

export const redis: RedisLike =
  globalForRedis.infosproRedis ?? createRedis();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.infosproRedis = redis;
}

export type { RedisLike };
