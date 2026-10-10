import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getEffectivePermissions } from "@/lib/permissions";
import { PodcastClient } from "@/components/admin/podcast/PodcastClient";

/**
 * Podcast / FM (/admin/podcast) — saisons hiérarchisées (ordre position,
 * dépliables) et leurs épisodes. Audio : URL directe ou lien Google Drive
 * converti en flux lisible à l'enregistrement.
 */

export const dynamic = "force-dynamic";

export default async function AdminPodcastPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/podcast");

  const permissions = await getEffectivePermissions(session.user);
  if (!permissions.has("page.manage")) redirect("/admin");

  return <PodcastClient />;
}
