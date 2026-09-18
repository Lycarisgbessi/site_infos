import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { MediaLibraryClient } from "@/components/admin/medias/MediaLibraryClient";

export const dynamic = "force-dynamic";

/** Médiathèque (§11.2 /admin/medias). */
export default async function AdminMediasPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <MediaLibraryClient />;
}
