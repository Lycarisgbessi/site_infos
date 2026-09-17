import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware (§03) :
 * - garde d'authentification /admin/* — la validation complète (session en
 *   base, expiration, statut du compte) est faite côté serveur dans le
 *   layout /admin et les Route Handlers ; ici, redirect rapide si le cookie
 *   est absent (économie d'un aller-retour DB en edge) ;
 * - i18n : locale par défaut `fr` (§18.2) — les URLs publiques ne portent
 *   pas de préfixe de locale à ce stade ;
 * - les redirections 301 (`redirects`) seront servies ici à la PHASE 2.
 *
 * Aucune donnée métier ne transite par localStorage (§00.2-5).
 */

const SESSION_COOKIE = "infospro_session";
const ADMIN_PREFIX = "/admin";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`)) {
    const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
    if (!hasSessionCookie) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
