import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getEffectivePermissions } from "@/lib/permissions";
import { AdsClient } from "@/components/admin/ads/AdsClient";

/**
 * Régie publicitaire (/admin/ads) — campagnes réelles : liste, création,
 * édition, activation/désactivation, suppression, compteurs
 * d'impressions et de clics.
 */

export const dynamic = "force-dynamic";

export default async function AdminAdsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/ads");

  const permissions = await getEffectivePermissions(session.user);
  if (!permissions.has("ads.read")) redirect("/admin");

  return <AdsClient canManage={permissions.has("ads.manage")} />;
}
