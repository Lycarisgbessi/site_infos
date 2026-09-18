import { PrismaClient } from "@prisma/client";

/**
 * Client Prisma singleton (§03 lib/db.ts).
 * En production PostgreSQL : DATABASE_URL (pool PgBouncer) pour le trafic
 * applicatif, DIRECT_DATABASE_URL pour les migrations (§04).
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "production"
        ? ["error"]
        : ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
