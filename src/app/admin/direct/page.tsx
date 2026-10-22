import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getEffectivePermissions } from "@/lib/permissions";
import { getSettingsValues } from "@/server/services/settings";
import { DirectClient } from "@/components/admin/direct/DirectClient";

/**
 * TV & Direct (/admin/direct) — configuration du direct : interrupteur
 * features.live, URL du flux (YouTube live / iframe http(s)) et titre
 * affiché. Un direct actif s'affiche en tête de la page /video.
 */

export const dynamic = "force-dynamic";

export default async function AdminDirectPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/direct");

  const permissions = await getEffectivePermissions(session.user);
  // Entrée de navigation : live.manage ; l'écriture des réglages passe par
  // l'API settings générique (permission settings.manage).
  if (!permissions.has("live.manage") && !permissions.has("settings.manage")) redirect("/admin");

  // Lecture serveur : la config est visible même sans settings.manage.
  const settings = await getSettingsValues(["features.live", "direct.live_url", "direct.live_title"]);

  return (
    <DirectClient
      initialLiveEnabled={settings["features.live"] !== "false"}
      initialLiveUrl={settings["direct.live_url"] ?? ""}
      initialLiveTitle={settings["direct.live_title"] ?? "En direct"}
      canManage={permissions.has("settings.manage")}
    />
  );
}
