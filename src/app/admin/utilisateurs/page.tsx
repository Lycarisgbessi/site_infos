import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { UtilisateursClient } from "@/components/admin/utilisateurs/UtilisateursClient";

/**
 * Écran /admin/utilisateurs — comptes de la rédaction (§08.3, §11.2) :
 * invitations, statuts, rôles et restrictions par rubrique, sans aucune
 * intervention technique. Garde serveur : session obligatoire ; les
 * permissions user.read / user.manage sont contrôlées par l'API (403
 * affiché tel quel si le compte ne les porte pas).
 */

export const dynamic = "force-dynamic";

export default async function AdminUtilisateursPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/utilisateurs");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="kicker text-brand-red">Rédaction</p>
        <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-ink">
          Utilisateurs
        </h1>
        <p className="mt-1 text-sm text-ink-faint">
          Comptes, rôles et accès de l&apos;équipe — invitations, statuts,
          restrictions par rubrique.
        </p>
      </header>
      <UtilisateursClient />
    </div>
  );
}
