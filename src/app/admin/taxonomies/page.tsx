import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { TaxonomiesClient } from "@/components/admin/taxonomies/TaxonomiesClient";

export const dynamic = "force-dynamic";

/**
 * Taxonomies (§11.2 /admin/taxonomies) : rubriques, mots-clés, dossiers,
 * zones géographiques et entités. Garde serveur — la page n'est rendue
 * que pour une session valide, sinon redirection vers la connexion.
 */
export default async function AdminTaxonomiesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <TaxonomiesClient />;
}
