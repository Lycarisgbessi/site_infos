import { NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
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

export class CsrfError extends Error {
  constructor(message = "Requête inter-origine refusée (CSRF).") {
    super(message);
    this.name = "CsrfError";
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
  if (error instanceof CsrfError) {
    return apiError(403, "CSRF", error.message);
  }
  console.error("[api] erreur interne :", error);
  return apiError(500, "INTERNAL", "Erreur interne du serveur.");
}

// ─── Garde de session pour les Route Handlers ──────────────────────────

const ALLOWED_FETCH_SITES = new Set(["same-origin", "same-site", "none"]);

/** L'origine déclarée est-elle de confiance pour cette requête ? */
function isOriginAllowed(originHeader: string, hdrs: Headers): boolean {
  let origin: URL;
  try {
    origin = new URL(originHeader);
  } catch {
    return false; // « null » ou valeur invalide : refus
  }
  // Same-origin : l'Origin correspond au Host servi (couvre prod et dev)
  const host = hdrs.get("host");
  if (host && origin.host === host) return true;
  // NEXT_PUBLIC_SITE_URL configuré (prod)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) {
    try {
      if (new URL(siteUrl).host === origin.host) return true;
    } catch {
      // NEXT_PUBLIC_SITE_URL mal formé : ignorer
    }
  }
  // Dev local
  if (
    process.env.NODE_ENV !== "production" &&
    (origin.host === "localhost:3000" || origin.host === "127.0.0.1:3000")
  ) {
    return true;
  }
  return false;
}

/**
 * Vérification d'origine anti-CSRF (§17) :
 * - absence d'Origin et de Sec-Fetch-Site (curl, tests serveur) = autorisé ;
 * - Origin présent → doit être same-host, NEXT_PUBLIC_SITE_URL, ou localhost:3000 en dev ;
 * - Sec-Fetch-Site présent → same-origin / same-site / none uniquement.
 */
function assertSameOrigin(hdrs: Headers): void {
  const origin = hdrs.get("origin");
  const fetchSite = hdrs.get("sec-fetch-site");
  if (!origin && !fetchSite) return; // client non-navigateur
  if (origin && !isOriginAllowed(origin, hdrs)) {
    throw new CsrfError("Origine non autorisée pour cette requête.");
  }
  if (fetchSite && !ALLOWED_FETCH_SITES.has(fetchSite)) {
    throw new CsrfError("Requête inter-origine (Sec-Fetch-Site: cross-site) refusée.");
  }
}

/**
 * Exige une session valide, sinon lève UnauthenticatedError (401).
 * Vérifie aussi l'origine de la requête (anti-CSRF) — les requêtes serveur
 * sans en-têtes de navigateur restent autorisées.
 */
export async function requireApiSession(): Promise<AuthenticatedSession> {
  const session = await getSession();
  if (!session) {
    throw new UnauthenticatedError();
  }
  assertSameOrigin(await nextHeaders());
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
