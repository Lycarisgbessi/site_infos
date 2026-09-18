import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireApiSession, apiOk, toErrorResponse } from "@/lib/api/respond";
import { requirePermission } from "@/lib/permissions";

export const runtime = "nodejs";

/**
 * GET /api/admin/audit — Journal d'audit (§11.2) : entrées horodatées des
 * actions d'écriture du back-office, filtrables par utilisateur, action
 * (préfixe, ex. « article. »), ressource et période, avec pagination.
 *
 * `format=csv` : export texte (séparateur « ; », BOM UTF-8, guillemets
 * échappés) limité aux 5 000 entrées les plus récentes correspondant aux
 * filtres — téléchargement via Content-Disposition.
 *
 * Lecture seule : aucune écriture d'audit ici (le §07.2 ne concerne que les
 * mutations). Ordre contractuel conservé : session → validation Zod →
 * permission (audit.read) → lecture.
 */

// ─── Validation Zod des paramètres de requête ──────────────────────────

/** Date seule « AAAA-MM-JJ » (champ <input type="date">) ou instant ISO. */
const periodParam = z
  .string()
  .min(10)
  .max(40)
  .refine(
    (value) =>
      /^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isNaN(new Date(value).getTime()),
    "Période invalide (AAAA-MM-JJ ou date ISO attendue)."
  );

const auditQuerySchema = z.object({
  user_id: z.string().min(1).max(64).optional(),
  action: z.string().min(1).max(100).optional(), // préfixe, ex. « article. »
  resource_type: z.string().min(1).max(64).optional(),
  from: periodParam.optional(),
  to: periodParam.optional(),
  page: z.coerce.number().int().min(1).max(100000).optional(),
  per_page: z.coerce.number().int().min(1).max(100).optional(),
  format: z.enum(["json", "csv"]).optional(),
});

type AuditQuery = z.infer<typeof auditQuerySchema>;

/** Plafond contractuel de l'export CSV (§11.2). */
const CSV_EXPORT_LIMIT = 5000;

// ─── Construction du filtre Prisma ─────────────────────────────────────

/**
 * Convertit un paramètre de période en borne Date inclusive :
 * - date seule « AAAA-MM-JJ » → début (00:00:00.000 UTC) ou fin
 *   (23:59:59.999 UTC) de la journée ;
 * - instant ISO → utilisé tel quel.
 */
function periodBound(value: string, endOfDay = false): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(endOfDay ? `${value}T23:59:59.999Z` : `${value}T00:00:00.000Z`);
  }
  return new Date(value);
}

function buildWhere(query: AuditQuery): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  if (query.user_id) where.user_id = query.user_id;
  if (query.action) where.action = { startsWith: query.action };
  if (query.resource_type) where.resource_type = query.resource_type;
  if (query.from || query.to) {
    where.created_at = {
      ...(query.from ? { gte: periodBound(query.from) } : {}),
      ...(query.to ? { lte: periodBound(query.to, true) } : {}),
    };
  }
  return where;
}

// ─── Export CSV ────────────────────────────────────────────────────────

type AuditRow = Prisma.AuditLogGetPayload<{
  include: { user: { select: { display_name: true; email: true } } };
}>;

/** Échappe un champ CSV : guillemets doublés, champ entre guillemets. */
function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** Sérialise les lignes en CSV « ; » avec BOM UTF-8 en tête. */
function toCsv(rows: AuditRow[]): string {
  const header = [
    "id",
    "date",
    "action",
    "resource_type",
    "resource_id",
    "user_email",
    "ip_hash",
    "user_agent",
    "before",
    "after",
  ];
  const lines = [header.map(csvField).join(";")];
  for (const row of rows) {
    lines.push(
      [
        String(row.id),
        row.created_at.toISOString(),
        row.action,
        row.resource_type,
        row.resource_id ?? "",
        row.user?.email ?? "",
        row.ip_hash ?? "",
        row.user_agent ?? "",
        row.before ?? "",
        row.after ?? "",
      ]
        .map(csvField)
        .join(";")
    );
  }
  return `\uFEFF${lines.join("\r\n")}`;
}

// ─── Route Handler ─────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession();
    await requirePermission(session.user, "audit.read");

    const url = new URL(request.url);
    const query = auditQuerySchema.parse(Object.fromEntries(url.searchParams));
    const where = buildWhere(query);
    const include = { user: { select: { display_name: true, email: true } } } as const;

    // Export CSV : mêmes filtres, sans pagination, plafonné à 5 000 lignes.
    if (query.format === "csv") {
      const rows = await db.auditLog.findMany({
        where,
        orderBy: { created_at: "desc" },
        include,
        take: CSV_EXPORT_LIMIT,
      });
      return new NextResponse(toCsv(rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="audit-export.csv"',
          "Cache-Control": "no-store",
        },
      });
    }

    const page = query.page ?? 1;
    const perPage = query.per_page ?? 20;

    const [total, items] = await Promise.all([
      db.auditLog.count({ where }),
      db.auditLog.findMany({
        where,
        orderBy: { created_at: "desc" },
        include,
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return apiOk(items, { page, per_page: perPage, total });
  } catch (error) {
    return toErrorResponse(error);
  }
}
