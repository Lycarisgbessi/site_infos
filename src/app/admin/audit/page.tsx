import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AuditClient } from "@/components/admin/audit/AuditClient";

/**
 * Écran /admin/audit — Journal d'audit (§11.2) : journal horodaté de toutes
 * les actions d'écriture du back-office, filtrable par utilisateur, action,
 * ressource et période, avec diff avant/après et export CSV.
 *
 * Garde serveur : session obligatoire ; la permission audit.read est
 * contrôlée par l'API (403 affiché tel quel à l'utilisateur si le compte
 * ne l'a pas — §00.2-6 « masquer un bouton n'est jamais une protection »).
 */

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/audit");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="kicker text-brand-red">Traçabilité</p>
        <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-ink">
          Journal d&apos;audit
        </h1>
        <p className="mt-1 text-sm text-ink-faint">
          Toutes les actions d&apos;écriture du back-office, filtrables et
          exportables.
        </p>
      </header>
      <AuditClient />
    </div>
  );
}
