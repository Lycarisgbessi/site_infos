import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { PagesClient } from "@/components/admin/pages/PagesClient";

/**
 * Écran /admin/pages (§11.2 — back-office éditorial, Phase 2) :
 * onglets « Pages » (pages statiques éditées en blocs §06.4) et
 * « Bannières » (bandeaux alerte / info / promo, ciblage de chemins,
 * fenêtrage temporel). Garde de session serveur ; l'écran interactif est
 * délégué à PagesClient.
 */

export const dynamic = "force-dynamic";

export default async function AdminPagesScreen() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/pages");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="kicker text-brand-red">Édition</p>
        <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight">
          Pages &amp; bannières
        </h1>
        <p className="mt-1 text-sm text-ink-faint">
          Pages statiques du site, bandeaux d&apos;information et annonces
          contextuelles.
        </p>
      </header>
      <PagesClient />
    </div>
  );
}
