import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireApiSession, apiOk, toErrorResponse } from "@/lib/api/respond";
import { requirePermission } from "@/lib/permissions";
import { subscribersQuerySchema } from "@/schemas/newsletter";
import {
  getNewsletterOverview,
  listSubscribers,
  listSubscribersForExport,
  type SubscriberRow,
} from "@/server/services/newsletter";

export const runtime = "nodejs";

/**
 * GET /api/admin/newsletter/subscribers — inscrits newsletter (§06.3) :
 * liste paginée filtrable (recherche e-mail, statut, liste) + indicateurs
 * (compteurs par statut, effectifs par liste) dans `meta`.
 *
 * `format=csv` : export texte (séparateur « ; », BOM UTF-8, guillemets
 * échappés) limité aux 5 000 inscrits les plus récents correspondant aux
 * filtres — même modèle que l'export du journal d'audit (§11.2).
 *
 * Lecture seule : aucune écriture d'audit ici. Ordre contractuel conservé :
 * session → validation Zod → permission (newsletter.read) → lecture.
 */

const PER_PAGE_DEFAULT = 20;

/** Échappe un champ CSV : guillemets doublés, champ entre guillemets. */
function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function toCsv(rows: SubscriberRow[]): string {
  const header = [
    "email",
    "prenom",
    "pays",
    "statut",
    "listes",
    "source",
    "date_inscription",
    "desabonne_le",
  ];
  const lines = [header.map(csvField).join(";")];
  for (const row of rows) {
    lines.push(
      [
        row.email,
        row.first_name ?? "",
        row.country ?? "",
        row.status,
        row.lists.map((l) => l.name).join(", "),
        row.source ?? "",
        row.created_at,
        row.unsubscribed_at ?? "",
      ]
        .map(csvField)
        .join(";")
    );
  }
  return `\uFEFF${lines.join("\r\n")}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession();
    await requirePermission(session.user, "newsletter.read");

    const url = new URL(request.url);
    const query = subscribersQuerySchema.parse(Object.fromEntries(url.searchParams));
    const filters = {
      q: query.q,
      status: query.status,
      listId: query.list_id,
    };

    // Export CSV : mêmes filtres, sans pagination.
    if (query.format === "csv") {
      const rows = await listSubscribersForExport(filters);
      return new NextResponse(toCsv(rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="newsletter-inscrits.csv"',
          "Cache-Control": "no-store",
        },
      });
    }

    const page = query.page ?? 1;
    const perPage = query.per_page ?? PER_PAGE_DEFAULT;

    const [{ items, total }, overview] = await Promise.all([
      listSubscribers(filters, page, perPage),
      getNewsletterOverview(),
    ]);

    return apiOk(items, {
      page,
      per_page: perPage,
      total,
      stats: overview.stats,
      lists: overview.lists,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
