import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getTranslations } from "@/lib/i18n";
import { LoginForm } from "@/components/admin/LoginForm";

/**
 * Page de connexion (§08.3). Déjà connecté → /admin.
 * Tous les libellés proviennent de la table `translations` (§00.2-2).
 */

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getSession();
  if (session) redirect("/admin");

  const { next } = await searchParams;
  const nextPath =
    next && next.startsWith("/admin") ? next : "/admin";

  const { translate } = await getTranslations();

  const labels: Record<string, string> = {
    subtitle: translate("login.subtitle"),
    email: translate("login.email"),
    password: translate("login.password"),
    remember: translate("login.remember"),
    signIn: translate("login.signIn"),
    signingIn: translate("login.signingIn"),
    mfaHint: translate("login.mfaHint"),
    mfaCode: translate("login.mfaCode"),
    verify: translate("login.verify"),
    verifying: translate("login.verifying"),
    backToLogin: translate("login.backToLogin"),
    genericError: translate("login.genericError"),
    networkError: translate("login.networkError"),
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper-alt px-4">
      <div className="w-full max-w-sm border border-rule bg-paper p-8">
        <LoginForm nextPath={nextPath} labels={labels} />
      </div>
    </main>
  );
}
