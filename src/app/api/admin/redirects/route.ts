import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  apiError,
  apiOk,
  requireApiSession,
  toErrorResponse,
  ValidationError,
} from "@/lib/api/respond";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/audit";
import { getRequestContext } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * API des redirections (§11.2 — onglet « Redirections » de /admin/pages,
 * §20 Phase 2 tâche 7 « Pages, menus, bannières, redirections »).
 *
 * Les redirections sont créées automatiquement par les renommages (pages,
 * taxonomies) avec `is_auto: true` ; cette route permet aussi de les gérer
 * manuellement.
 *
 * Règles métier :
 * - `is_auto` n'a PAS de champ de désactivation : le modèle Redirect ne
 *   comporte pas de `is_active` (pas de soft-disable). Le champ `is_active`
 *   est donc volontairement absent des payloads — émuler la désactivation
 *   en préfixant la cible est interdit, et la désactivation n'est pas
 *   proposée du tout.
 * - Une redirection `is_auto: true` ne peut pas être supprimée (403) :
 *   elle matérialise un renommage éditorial ; pour la faire disparaître,
 *   renommez la source d'origine ou contactez un administrateur.
 * - Normalisation des chemins : trim + « / » initial ajouté si absent.
 * - `source_path` est unique (contrainte base) : un doublon est refusé (409).
 *
 * Ordre contractuel §07.2 : session → validation Zod → permission
 * (redirect.manage) → écriture → audit. Enveloppe {data, meta} §07.1.
 */

// ─── Validation Zod ────────────────────────────────────────────────────

const redirectQuerySchema = z.object({
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(1).max(200).optional(),
});

const redirectCreateSchema = z.object({
  source_path: z
    .string()
    .min(1, "Le chemin source est obligatoire.")
    .max(2000),
  target_path: z
    .string()
    .min(1, "Le chemin cible est obligatoire.")
    .max(2000),
  status_code: z.union([z.literal(301), z.literal(302)]).optional(),
});

// Pas de champ is_active : le modèle Redirect n'en comporte pas (voir
// docstring) — l'écran n'en propose donc pas non plus.
const redirectUpdateSchema = z.object({
  id: z.string().min(1, "Identifiant manquant."),
  target_path: z.string().min(1).max(2000).optional(),
  status_code: z.union([z.literal(301), z.literal(302)]).optional(),
});

const redirectDeleteQuerySchema = z.object({
  id: z.string().min(1, "Paramètre id manquant."),
});

/** Normalise un chemin saisi : trim + « / » initial si absent. */
function normalizePath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new ValidationError("Le chemin ne peut pas être vide.");
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

// ─── GET : liste filtrable et paginée ──────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const url = new URL(request.url);
    const query = redirectQuerySchema.parse(Object.fromEntries(url.searchParams));
    await requirePermission(session.user, "redirect.manage");

    const page = query.page ?? 1;
    const perPage = query.per_page ?? 50;
    const where = query.q
      ? {
          OR: [
            { source_path: { contains: query.q } },
            { target_path: { contains: query.q } },
          ],
        }
      : {};

    const [total, items] = await Promise.all([
      db.redirect.count({ where }),
      db.redirect.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return apiOk(items, { page, per_page: perPage, total });
  } catch (error) {
    return toErrorResponse(error);
  }
}

// ─── POST : création manuelle ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = redirectCreateSchema.parse(body);
    await requirePermission(session.user, "redirect.manage");

    const source = normalizePath(input.source_path);
    const target = normalizePath(input.target_path);
    if (source === target) {
      throw new ValidationError(
        "La source et la cible doivent être différentes."
      );
    }
    const statusCode = input.status_code ?? 301;

    const existing = await db.redirect.findUnique({
      where: { source_path: source },
      select: { id: true },
    });
    if (existing) {
      return apiError(
        409,
        "CONFLICT",
        "Une redirection existe déjà pour ce chemin."
      );
    }

    try {
      const created = await db.redirect.create({
        data: {
          source_path: source,
          target_path: target,
          status_code: statusCode,
          is_auto: false,
        },
      });
      await auditLog({
        userId: session.user.id,
        action: "redirect.create",
        resourceType: "redirect",
        resourceId: created.id,
        after: {
          source_path: created.source_path,
          target_path: created.target_path,
          status_code: created.status_code,
          is_auto: created.is_auto,
        },
        request: getRequestContext(request.headers),
      });
      return apiOk(created);
    } catch (error) {
      // Course possible entre findUnique et create : la contrainte unique
      // de la base reste le garant final (même message que le 409 amont).
      if ((error as { code?: unknown }).code === "P2002") {
        return apiError(
          409,
          "CONFLICT",
          "Une redirection existe déjà pour ce chemin."
        );
      }
      throw error;
    }
  } catch (error) {
    return toErrorResponse(error);
  }
}

// ─── PATCH : édition de la cible / du code ─────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = redirectUpdateSchema.parse(body);
    await requirePermission(session.user, "redirect.manage");

    if (input.target_path === undefined && input.status_code === undefined) {
      throw new ValidationError("Aucune modification fournie.");
    }

    const current = await db.redirect.findUnique({ where: { id: input.id } });
    if (!current) throw new ValidationError("Redirection introuvable.");

    let target = current.target_path;
    if (input.target_path !== undefined) {
      target = normalizePath(input.target_path);
      if (target === current.source_path) {
        throw new ValidationError(
          "La cible ne peut pas être identique à la source (boucle de redirection)."
        );
      }
    }
    const statusCode = input.status_code ?? current.status_code;

    const updated = await db.redirect.update({
      where: { id: current.id },
      data: { target_path: target, status_code: statusCode },
    });

    await auditLog({
      userId: session.user.id,
      action: "redirect.update",
      resourceType: "redirect",
      resourceId: current.id,
      before: {
        target_path: current.target_path,
        status_code: current.status_code,
      },
      after: {
        target_path: updated.target_path,
        status_code: updated.status_code,
      },
      request: getRequestContext(request.headers),
    });

    return apiOk({ ok: true, id: updated.id });
  } catch (error) {
    return toErrorResponse(error);
  }
}

// ─── DELETE : suppression (manuelle uniquement) ────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireApiSession();
    const url = new URL(request.url);
    const query = redirectDeleteQuerySchema.parse(
      Object.fromEntries(url.searchParams)
    );
    await requirePermission(session.user, "redirect.manage");

    const current = await db.redirect.findUnique({ where: { id: query.id } });
    if (!current) throw new ValidationError("Redirection introuvable.");

    if (current.is_auto) {
      // Règle §20 Phase 2 tâche 7 : une redirection née d'un renommage
      // (taxonomies, pages) n'est pas supprimable manuellement.
      return apiError(
        403,
        "AUTO_REDIRECT",
        "Redirection automatique : renommez la source ou contactez un administrateur."
      );
    }

    await db.redirect.delete({ where: { id: current.id } });
    await auditLog({
      userId: session.user.id,
      action: "redirect.delete",
      resourceType: "redirect",
      resourceId: current.id,
      before: {
        source_path: current.source_path,
        target_path: current.target_path,
        status_code: current.status_code,
        is_auto: current.is_auto,
        hit_count: current.hit_count,
      },
      request: getRequestContext(request.headers),
    });

    return apiOk({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
