import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

/**
 * Middleware (§03) :
 * - garde d'authentification /admin/* — la validation complète (session en
 *   base, expiration, statut du compte) est faite côté serveur dans le
 *   layout /admin et les Route Handlers ; ici, redirect rapide si le cookie
 *   est absent (économie d'un aller-retour DB en edge) ;
 * - /admin/preview/[id]?token= : un jeton de prévisualisation valide passe
 *   (vérification HMAC complète dans la page, §11.1) ;
 * - redirections 301 (table `redirects`) servies ici — PHASE 2 (§11.2 :
 *   renommage rubrique/tag → 301 automatique ; écran redirections).
 *
 * Prisma requiert le runtime Node.js (Next 16 : runtime nodejs du middleware,
 * cf. DECISIONS.md D-11). matcher élargi à tout sauf fichiers statiques.
 */

const SESSION_COOKIE = "infospro_session";
const ADMIN_PREFIX = "/admin";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Garde /admin ─────────────────────────────────────────────────────
  if (pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`)) {
    const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

    if (!hasSessionCookie) {
      // Aperçu avec jeton signé : laisse passer, la page revalide (HMAC)
      const isPreview = pathname.startsWith(`${ADMIN_PREFIX}/preview/`);
      const hasToken = Boolean(request.nextUrl.searchParams.get("token"));
      if (!(isPreview && hasToken)) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("next", pathname);
        return NextResponse.redirect(loginUrl);
      }
    }
    return NextResponse.next();
  }

  // ── Redirections 301/302 (table redirects) ───────────────────────────
  const redirect = await db.redirect.findUnique({
    where: { source_path: pathname },
    select: { target_path: true, status_code: true },
  });
  if (redirect) {
    // Compteur d'utilisation (best effort — ne bloque jamais la redirection)
    db.redirect
      .update({ where: { source_path: pathname }, data: { hit_count: { increment: 1 } } })
      .catch(() => undefined);
    const target = new URL(redirect.target_path, request.url);
    target.search = request.nextUrl.search; // préserve la query string
    return NextResponse.redirect(target, redirect.status_code === 302 ? 302 : 301);
  }

  return NextResponse.next();
}

export const config = {
  runtime: "nodejs",
  matcher: [
    // Tout sauf : _next, fichiers statiques, api (les API gèrent leurs 404),
    // favicon/robots/sitemaps
    "/((?!_next/static|_next/image|uploads/|api/|favicon|robots|sitemap|opengraph|media-demo|logo.svg).*)",
    "/admin/:path*",
  ],
};
