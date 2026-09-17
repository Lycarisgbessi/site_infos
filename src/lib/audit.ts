import { db } from "@/lib/db";
import { hashIp } from "@/lib/auth/session";
import type { RequestContext } from "@/lib/auth/types";

/**
 * Journal d'audit (§03, §06.2 audit_log, §07.2 modèle obligatoire).
 * Toute action d'écriture du back-office crée une entrée (§20 Phase 1,
 * critère d'acceptation 4). before/after sérialisés JSON (adaptation D-01).
 */

export interface AuditEntry {
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  request?: RequestContext;
}

function serialize(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        user_id: entry.userId ?? null,
        action: entry.action,
        resource_type: entry.resourceType,
        resource_id: entry.resourceId ?? null,
        before: serialize(entry.before),
        after: serialize(entry.after),
        ip_hash: entry.request ? hashIp(entry.request.ip) : null,
        user_agent: entry.request?.userAgent?.slice(0, 500) ?? null,
      },
    });
  } catch (error) {
    // L'audit ne doit jamais bloquer l'opération métier, mais doit être visible
    console.error("[audit] échec d'écriture du journal :", error);
  }
}
