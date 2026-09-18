import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { FlashClient } from "@/components/admin/flash/FlashClient";

/**
 * Publication d'urgence (§11.2 /admin/flash) — saisie en une ligne,
 * liste des flashs actifs avec compte à rebours et actions d'expiration.
 */

export const dynamic = "force-dynamic";

export default async function AdminFlashPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/flash");

  return <FlashClient />;
}
