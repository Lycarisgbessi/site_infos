import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { TextesClient } from "@/components/admin/textes/TextesClient";

/**
 * Écran /admin/textes — « Textes d'interface » (§11.2) : tous les libellés
 * du site public (table translations) éditables en direct. Garde serveur :
 * session obligatoire ; la permission settings.manage est contrôlée par
 * l'API (403 affiché tel quel à l'utilisateur si le compte ne l'a pas).
 */

export const dynamic = "force-dynamic";

export default async function AdminTextesPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/textes");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="kicker text-brand-red">Autonomie éditoriale</p>
        <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-ink">
          Textes d&apos;interface
        </h1>
        <p className="mt-1 text-sm text-ink-faint">
          Libellés, messages et mentions du site public — modification en
          direct, sans intervention technique.
        </p>
      </header>
      <TextesClient />
    </div>
  );
}
