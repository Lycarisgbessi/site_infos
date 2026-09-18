import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { HomepageClient } from "@/components/admin/homepage/HomepageClient";

/**
 * Composeur de la page d'accueil (§11.2 /admin/homepage) — liste verticale
 * de blocs réordonnçables (glisser-déposer), édition de la configuration,
 * configurations nommées (layouts) et prévisualisation structurelle.
 */

export const dynamic = "force-dynamic";

export default async function AdminHomepagePage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/homepage");

  return <HomepageClient />;
}
