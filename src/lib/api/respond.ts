import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSession } from "@/lib/auth/session";
import { UnauthenticatedError, PermissionError } from "@/lib/permissions";
import type { AuthenticatedSession } from "@/lib/auth/types";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";

/**
 * Helpers d'API d'administration (§07.2 — modèle obligatoire conservé,
 * transport Route Handlers conformément à DECISIONS.md D-07).
 *
 * Toute mutation admin suit l'ordre contractuel :
 *   session → validation Zod → permission → écriture → audit → revalidateTag.
 *
 * Enveloppe de réponse homogène avec l'API publique (§07.1) : `{ data, meta }`.
 */

// ─── Enveloppe de réponse ──────────────────────────────────────────────

export function apiOk<T>(data: T, meta?: Record<string, unknown>): NextResponse {
  return NextResponse.json(
    meta === undefined ? { data } : { data, meta },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export function apiError(
  status: number,
  code: string,
  message: string,
  headers?: Record<string, string>
): NextResponse {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store", ...headers } }
  );
}

// ─── Erreurs normalisées ───────────────────────────────────────────────

export class RateLimitError extends Error {
  readonly retryAfterSec: number;
  constructor(retryAfterSec: number) {
    super("Trop de tentatives. Réessayez plus tard.");
    this.name = "RateLimitError";
    this.retryAfterSec = retryAfterSec;
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Convertit une exception en réponse HTTP normalisée. */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof UnauthenticatedError) {
    return apiError(401, error.code, error.message);
  }
  if (error instanceof PermissionError) {
    return apiError(403, error.code, error.message);
  }
  if (error instanceof RateLimitError) {
    return apiError(429, "RATE_LIMITED", error.message, {
      "Retry-After": String(error.retryAfterSec),
    });
  }
  if (error instanceof ZodError) {
    return apiError(422, "VALIDATION", "Données invalides.");
  }
  if (error instanceof ValidationError) {
    return apiError(422, "VALIDATION", error.message);
  }
  console.error("[api] erreur interne :", error);
  return apiError(500, "INTERNAL", "Erreur interne du serveur.");
}

// ─── Garde de session pour les Route Handlers ──────────────────────────

/** Exige une session valide, sinon lève UnauthenticatedError (401). */
export async function requireApiSession(): Promise<AuthenticatedSession> {
  const session = await getSession();
  if (!session) {
    throw new UnauthenticatedError();
  }
  return session;
}

/** Rate limit applicatif (§17.1) — lève RateLimitError (429). */
export async function requireRateLimit(
  name: keyof typeof RATE_LIMITS,
  identifier: string
): Promise<void> {
  const result = await rateLimit(name, identifier);
  if (!result.allowed) {
    throw new RateLimitError(result.retryAfterSec);
  }
}
