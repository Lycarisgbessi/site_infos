import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { UneClient } from "@/components/admin/une/UneClient";

/**
 * Composeur de la une (§11.2 /admin/une) — zone article principal (héros),
 * zone articles secondaires, recherche de candidats, titres et images
 * alternatifs, épinglage.
 */

export const dynamic = "force-dynamic";

export default async function AdminUnePage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/une");

  return <UneClient />;
}
