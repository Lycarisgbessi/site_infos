import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ParametresClient } from "@/components/admin/parametres/ParametresClient";

/**
 * Écran /admin/parametres — « Autonomie totale » (§11.2) :
 * les 9 groupes de réglages du site, éditables par l'équipe éditoriale sans
 * aucune intervention technique. Garde serveur : session obligatoire ; la
 * permission settings.manage est contrôlée par l'API (403 affiché tel quel
 * à l'utilisateur si le compte ne l'a pas).
 */

export const dynamic = "force-dynamic";

export default async function AdminParametresPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/parametres");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="kicker text-brand-red">Autonomie totale</p>
        <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-ink">
          Paramètres
        </h1>
        <p className="mt-1 text-sm text-ink-faint">
          Tous les réglages du site sont modifiables ici — aucune intervention
          technique requise.
        </p>
      </header>
      <ParametresClient />
    </div>
  );
}
