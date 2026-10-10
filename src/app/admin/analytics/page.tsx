import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { AnalyticsClient } from "@/app/admin/analytics/AnalyticsClient";
import {
  getAnalyticsOverview,
  parsePeriod,
} from "@/server/services/analytics";

/**
 * Écran /admin/analytics — Statistiques (§11.2) : vues de pages publiques
 * (table page_views), cartes indicateurs, série quotidienne, top articles.
 *
 * Garde serveur : session obligatoire ; la permission analytics.read est
 * contrôlée ici même (la donnée vient du service, pas de l'API) — message
 * 403 explicite si le compte ne l'a pas (§00.2-6 « masquer un bouton
 * n'est jamais une protection »).
 */

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ days?: string }>;
}

export default async function AdminAnalyticsPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/analytics");

  const allowed = await hasPermission(session.user, "analytics.read");

  const days = parsePeriod((await searchParams).days);
  const overview = allowed ? await getAnalyticsOverview(days) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="kicker text-brand-red">Audience</p>
        <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-ink">
          Statistiques
        </h1>
        <p className="mt-1 text-sm text-ink-faint">
          Vues de pages publiques, articles les plus lus et tendances de la
          période.
        </p>
      </header>
      {allowed && overview ? (
        <AnalyticsClient overview={overview} />
      ) : (
        <p className="rounded-sm border border-rule bg-paper-alt p-4 text-sm text-ink-soft">
          Permission requise : analytics.read. Contactez un administrateur si
          vous pensez devoir y avoir accès.
        </p>
      )}
    </div>
  );
}
