import type { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
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
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/audit";
import { getRequestContext } from "@/lib/auth/session";
import { hashPassword, secureToken } from "@/lib/auth/password";
import { slugify, ensureUniqueSlug } from "@/lib/utils/slug";
import { stringifyJsonArray } from "@/lib/json";
import type { UserStatusType } from "@/lib/auth/types";

export const runtime = "nodejs";

/**
 * /api/admin/users — comptes de la rédaction (§08.3, §11.2).
 *
 * GET  (user.read)  — liste des comptes non supprimés, filtre `q` sur
 *      l'e-mail et le nom (contient, insensible casse pour l'ASCII).
 * POST (user.manage) — invitation d'un collaborateur : mot de passe
 *      temporaire fort généré côté serveur, haché Argon2id, et retourné
 *      UNE SEULE FOIS dans la réponse. En l'absence de service e-mail
 *      disponible (décision D-10, repli explicite documenté), c'est
 *      l'administrateur qui transmet le secret au collaborateur ; il
 *      n'est jamais journalisé ni stocké en clair.
 */

// ─── Forme de réponse commune (GET et POST) ───────────────────────────

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

export interface UserItemRole {
  key: string;
  label: string;
  /** Rubriques autorisées — null = toutes (non restreint). */
  category_ids: string[] | null;
}

export interface UserItem {
  id: string;
  email: string;
  display_name: string;
  slug: string;
  job_title: string | null;
  status: UserStatusType;
  two_factor_enabled: boolean;
  last_login_at: string | null;
  created_at: string;
  roles: UserItemRole[];
}

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

function serializeUser(row: UserRow): UserItem {
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

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide.").max(255),
  display_name: z.string().trim().min(2, "Le nom complet est requis.").max(120),
  job_title: z.string().trim().max(120).optional(),
  role_key: z.string().trim().min(1, "Le rôle est requis.").max(64),
  category_ids: z.array(z.string()).max(200).optional(),
});

/**
 * Mot de passe temporaire (§08.3 : 12 caractères minimum, majuscule +
 * minuscule + chiffre + symbole). Même pattern que le seed
 * (prisma/seed.ts) : deux jetons base64url encadrant l'ancrage "Aa!",
 * avec garantie d'au moins un chiffre.
 */
function generateTemporaryPassword(): string {
  let password = secureToken(6) + "Aa!" + secureToken(4).replace(/[^\w]/g, "B");
  if (!/[0-9]/.test(password)) {
    password += String(randomBytes(1)[0] % 10);
  }
  return password;
}

// ─── GET — liste des comptes ──────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession();
    await requirePermission(session.user, "user.read");

    const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    const users = await db.user.findMany({
      where: {
        deleted_at: null,
        ...(q
          ? {
              OR: [
                { email: { contains: q.toLowerCase() } },
                { display_name: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { created_at: "desc" },
      select: userItemSelect,
    });

    return apiOk(users.map(serializeUser), { count: users.length });
  } catch (error) {
    return toErrorResponse(error);
  }
}

// ─── POST — invitation d'un collaborateur ─────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession();
    await requirePermission(session.user, "user.manage");
    const ctx = getRequestContext(request.headers);

    const body = await request.json().catch(() => null);
    if (!body) throw new ValidationError("Corps de requête manquant.");
    const input = inviteSchema.parse(body);

    // Unicité de l'e-mail, y compris pour un compte supprimé (soft delete).
    const existing = await db.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) {
      return apiError(
        409,
        "EMAIL_EXISTS",
        "Un compte existe déjà avec cette adresse e-mail."
      );
    }

    const role = await db.role.findUnique({
      where: { key: input.role_key },
      select: { id: true, key: true },
    });
    if (!role) throw new ValidationError("Rôle inconnu.");

    const categoryIds = input.category_ids ?? [];
    if (categoryIds.length > 0) {
      const known = await db.category.count({
        where: { id: { in: categoryIds }, deleted_at: null },
      });
      if (known !== categoryIds.length) {
        throw new ValidationError("Rubrique inconnue dans la restriction.");
      }
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    const slug = await ensureUniqueSlug(
      slugify(input.display_name),
      async (candidate) =>
        (await db.user.findFirst({
          where: { slug: candidate },
          select: { id: true },
        })) !== null
    );

    let user: UserRow;
    try {
      user = await db.user.create({
        data: {
          email: input.email,
          password_hash: passwordHash,
          display_name: input.display_name,
          slug,
          job_title: input.job_title ?? null,
          status: "invited",
          locale: "fr",
          userRoles: {
            create: {
              role_id: role.id,
              // Restriction par rubrique — vide/null = toutes (§08.2).
              category_ids:
                categoryIds.length > 0 ? stringifyJsonArray(categoryIds) : null,
              granted_by: session.user.id,
            },
          },
        },
        select: userItemSelect,
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === "P2002"
      ) {
        return apiError(
          409,
          "EMAIL_EXISTS",
          "Un compte existe déjà avec cette adresse e-mail."
        );
      }
      throw error;
    }

    await auditLog({
      userId: session.user.id,
      action: "user.invite",
      resourceType: "user",
      resourceId: user.id,
      after: { email: input.email, role_key: input.role_key },
      request: ctx,
    });

    // Le mot de passe temporaire n'est retourné qu'ici, une seule fois.
    return apiOk({
      user: serializeUser(user),
      temporary_password: temporaryPassword,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
