import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { MenusClient } from "@/components/admin/menus/MenusClient";

/**
 * Écran /admin/menus (§11.2 — back-office éditorial, Phase 2) :
 * onglets « Menus » (édition des zones de navigation §21.4 — arborescence
 * deux niveaux, cibles typées, réordonnancement) et « Redirections »
 * (301/302, dont celles créées automatiquement par les renommages).
 * Garde de session serveur ; l'écran interactif est délégué à MenusClient.
 */

export const dynamic = "force-dynamic";

export default async function AdminMenusScreen() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/menus");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="kicker text-brand-red">Structure</p>
        <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight">
          Menus &amp; redirections
        </h1>
        <p className="mt-1 text-sm text-ink-faint">
          Navigation du site et redirections permanentes ou temporaires.
        </p>
      </header>
      <MenusClient />
    </div>
  );
}
