import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  requireApiSession,
  apiOk,
  apiError,
  toErrorResponse,
  ValidationError,
} from "@/lib/api/respond";
import { requirePermission, PermissionError } from "@/lib/permissions";
import { auditLog } from "@/lib/audit";
import { getRequestContext, revokeAllUserSessions } from "@/lib/auth/session";
import { parseJsonArray, stringifyJsonArray } from "@/lib/json";

export const runtime = "nodejs";

/**
 * /api/admin/users/[id] — modification d'un compte (§08.3, §11.2).
 *
 * PATCH (user.manage) :
 * - changement de statut (activer / suspendre / désactiver) ;
 * - changement de rôle + restriction par rubrique (delete + create du
 *   user_role dans une transaction) ;
 * - garde-fous : jamais de modification de son propre compte ; le dernier
 *   administrateur actif ne peut pas perdre l'accès ;
 * - notification in-app au compte concerné + audit before/after.
 */

// ─── Forme de réponse (alignée sur GET /api/admin/users) ──────────────

const userItemSelect = {
  id: true,
  email: true,
  display_name: true,
  slug: true,
  job_title: true,
  status: true,
  two_factor_enabled: true,
  last_login_at: true,
  created_at: true,
  userRoles: {
    select: {
      category_ids: true,
      role: { select: { key: true, label: true } },
    },
  },
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof userItemSelect }>;

function parseCategoryIds(value: string | null): string[] | null {
  if (value === null) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((v) => String(v));
    }
  } catch {
    // valeur corrompue → traitée comme non restreinte
  }
  return null;
}

function serializeUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    slug: row.slug,
    job_title: row.job_title,
    status: row.status,
    two_factor_enabled: row.two_factor_enabled,
    last_login_at: row.last_login_at ? row.last_login_at.toISOString() : null,
    created_at: row.created_at.toISOString(),
    roles: row.userRoles.map((ur) => ({
      key: ur.role.key,
      label: ur.role.label,
      category_ids: parseCategoryIds(ur.category_ids),
    })),
  };
}

// ─── Validation ───────────────────────────────────────────────────────

const patchSchema = z.object({
  status: z.enum(["active", "invited", "suspended", "disabled"]).optional(),
  role_key: z.string().trim().min(1).max(64).optional(),
  category_ids: z.array(z.string()).max(200).optional(),
});

// ─── PATCH — statut et/ou rôle ────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiSession();
    await requirePermission(session.user, "user.manage");
    const ctx = getRequestContext(request.headers);

    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = patchSchema.parse(body);

    if (input.status === undefined && input.role_key === undefined && input.category_ids === undefined) {
      throw new ValidationError("Aucune modification fournie.");
    }

    const target = await db.user.findFirst({
      where: { id, deleted_at: null },
      select: {
        id: true,
        email: true,
        status: true,
        userRoles: {
          select: {
            category_ids: true,
            role: { select: { key: true, label: true } },
          },
        },
      },
    });
    if (!target) {
      return apiError(404, "NOT_FOUND", "Utilisateur introuvable.");
    }

    // Garde-fou 1 : on ne modifie jamais son propre compte (§11.2).
    if (id === session.user.id) {
      throw new PermissionError("Vous ne pouvez pas modifier votre propre compte.");
    }

    const targetIsAdmin = target.userRoles.some((ur) => ur.role.key === "admin");
    const statusChanged = input.status !== undefined && input.status !== target.status;
    const roleFieldsProvided = input.role_key !== undefined || input.category_ids !== undefined;

    // Garde-fou 2 : le dernier administrateur actif conserve l'accès.
    if (targetIsAdmin && target.status === "active") {
      const losesAccess =
        input.status === "suspended" ||
        input.status === "disabled" ||
        (input.role_key !== undefined && input.role_key !== "admin");
      if (losesAccess) {
        const otherActiveAdmins = await db.user.count({
          where: {
            id: { not: id },
            deleted_at: null,
            status: "active",
            userRoles: { some: { role: { key: "admin" } } },
          },
        });
        if (otherActiveAdmins === 0) {
          throw new ValidationError(
            "Le dernier administrateur actif ne peut pas être désactivé."
          );
        }
      }
    }

    // Résolution du rôle cible avant écriture.
    const nextRole =
      input.role_key !== undefined
        ? await db.role.findUnique({
            where: { key: input.role_key },
            select: { id: true, key: true },
          })
        : null;
    if (input.role_key !== undefined && !nextRole) {
      throw new ValidationError("Rôle inconnu.");
    }

    if (input.category_ids !== undefined && input.category_ids.length > 0) {
      const known = await db.category.count({
        where: { id: { in: input.category_ids }, deleted_at: null },
      });
      if (known !== input.category_ids.length) {
        throw new ValidationError("Rubrique inconnue dans la restriction.");
      }
    }

    // ── Écritures ─────────────────────────────────────────────────────
    let updated: UserRow | null;
    if (statusChanged && roleFieldsProvided) {
      // Statut + rôle : une seule transaction cohérente.
      updated = await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id },
          data: { status: input.status },
        });
        if (nextRole) {
          await tx.userRole.deleteMany({ where: { user_id: id } });
          await tx.userRole.create({
            data: {
              user_id: id,
              role_id: nextRole.id,
              category_ids:
                input.category_ids !== undefined && input.category_ids.length > 0
                  ? stringifyJsonArray(input.category_ids)
                  : null,
              granted_by: session.user.id,
            },
          });
        } else if (input.category_ids !== undefined) {
          await tx.userRole.updateMany({
            where: { user_id: id },
            data: {
              category_ids:
                input.category_ids.length > 0
                  ? stringifyJsonArray(input.category_ids)
                  : null,
            },
          });
        }
        return tx.user.findUnique({ where: { id }, select: userItemSelect });
      });
    } else if (statusChanged) {
      updated = await db.user.update({
        where: { id },
        data: { status: input.status },
        select: userItemSelect,
      });
    } else if (roleFieldsProvided) {
      updated = await db.$transaction(async (tx) => {
        if (nextRole) {
          await tx.userRole.deleteMany({ where: { user_id: id } });
          await tx.userRole.create({
            data: {
              user_id: id,
              role_id: nextRole.id,
              category_ids:
                input.category_ids !== undefined && input.category_ids.length > 0
                  ? stringifyJsonArray(input.category_ids)
                  : null,
              granted_by: session.user.id,
            },
          });
        } else {
          await tx.userRole.updateMany({
            where: { user_id: id },
            data: {
              category_ids:
                input.category_ids !== undefined && input.category_ids.length > 0
                  ? stringifyJsonArray(input.category_ids)
                  : null,
            },
          });
        }
        return tx.user.findUnique({ where: { id }, select: userItemSelect });
      });
    } else {
      // Rien ne change (statut identique) : réponse sans écriture.
      updated = await db.user.findUnique({ where: { id }, select: userItemSelect });
    }

    // Un compte qui perd l'accès perd aussi ses sessions actives.
    if (input.status === "suspended" || input.status === "disabled") {
      await revokeAllUserSessions(id).catch(() => undefined);
    }

    // ── Audit (before/after) ──────────────────────────────────────────
    if (statusChanged) {
      await auditLog({
        userId: session.user.id,
        action: "user.status_change",
        resourceType: "user",
        resourceId: id,
        before: { status: target.status },
        after: { status: input.status },
        request: ctx,
      });
    }
    if (roleFieldsProvided) {
      const finalRoleKey = nextRole ? nextRole.key : target.userRoles[0]?.role.key ?? null;
      const finalCategoryIds =
        input.category_ids !== undefined
          ? input.category_ids.length > 0
            ? input.category_ids
            : null
          : target.userRoles.length === 1
            ? parseCategoryIds(target.userRoles[0].category_ids)
            : null;
      await auditLog({
        userId: session.user.id,
        action: "user.role_change",
        resourceType: "user",
        resourceId: id,
        before: {
          roles: target.userRoles.map((ur) => ({
            key: ur.role.key,
            category_ids: parseCategoryIds(ur.category_ids),
          })),
        },
        after: { role_key: finalRoleKey, category_ids: finalCategoryIds },
        request: ctx,
      });
    }

    // ── Notification in-app au compte concerné ────────────────────────
    const payload: Record<string, string> = { actor: session.user.displayName };
    if (input.status !== undefined) payload.status = input.status;
    if (input.role_key !== undefined) payload.role_key = input.role_key;
    await db.notification.create({
      data: {
        user_id: id,
        type: "account.updated",
        payload: JSON.stringify(payload),
      },
    });

    if (!updated) {
      return apiError(404, "NOT_FOUND", "Utilisateur introuvable.");
    }
    return apiOk({ user: serializeUser(updated) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
