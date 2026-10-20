import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getEffectivePermissions } from "@/lib/permissions";
import { NewsletterClient } from "@/components/admin/newsletter/NewsletterClient";

/**
 * Écran /admin/newsletter — Inscrits à la newsletter (§06.3, §11.2) :
 * indicateurs (total, en attente, confirmés, désabonnés, par liste),
 * table des inscrits filtrable (e-mail, statut, liste) et paginée,
 * confirmation manuelle, désabonnement, suppression, export CSV.
 *
 * Garde serveur : session obligatoire + permission newsletter.read
 * (même pattern que /admin/ads).
 */

export const dynamic = "force-dynamic";

export default async function AdminNewsletterPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/newsletter");

  const permissions = await getEffectivePermissions(session.user);
  if (!permissions.has("newsletter.read")) redirect("/admin");

  return <NewsletterClient canManage={permissions.has("subscriber.manage")} />;
}
