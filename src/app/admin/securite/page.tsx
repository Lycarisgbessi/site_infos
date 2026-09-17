import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getTranslations } from "@/lib/i18n";
import { SecurityClient } from "@/components/admin/SecurityClient";

/**
 * Écran /admin/securite — 2FA (§08.3) et gestion des sessions actives.
 * Accessible même quand la 2FA est exigée (c'est l'écran d'activation).
 */

export const dynamic = "force-dynamic";

export default async function AdminSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ enforce?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/securite");

  const { enforce } = await searchParams;
  const { translate } = await getTranslations(session.user.locale);

  const labels: Record<string, string> = {
    twoFactorTitle: translate("admin.security.twoFactorTitle"),
    twoFactorDesc: translate("admin.security.twoFactorDesc"),
    enabledBadge: translate("admin.security.enabledBadge"),
    disabledBadge: translate("admin.security.disabledBadge"),
    activateButton: translate("admin.security.activateButton"),
    setupSteps: translate("admin.security.setupSteps"),
    generateButton: translate("admin.security.generateButton"),
    qrAlt: translate("admin.security.qrAlt"),
    manualEntry: translate("admin.security.manualEntry"),
    codeLabel: translate("admin.security.codeLabel"),
    backupTitle: translate("admin.security.backupTitle"),
    backupOnce: translate("admin.security.backupOnce"),
    confirmButton: translate("admin.security.confirmButton"),
    sessionsTitle: translate("admin.security.sessionsTitle"),
    sessionsError: translate("admin.security.sessionsError"),
    loading: translate("common.loading"),
    noSessions: translate("admin.security.noSessions"),
    unknownDevice: translate("admin.security.unknownDevice"),
    currentSession: translate("admin.security.currentSession"),
    revoke: translate("admin.security.revoke"),
    sessionRevoked: translate("admin.security.sessionRevoked"),
    sessionError: translate("admin.security.sessionError"),
    activated: translate("admin.security.activated"),
    activateError: translate("admin.security.activateError"),
    setupError: translate("admin.security.setupError"),
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="font-serif text-2xl font-bold tracking-tight">
          {translate("admin.nav.security")}
        </h1>
        <p className="mt-1 text-sm text-ink-faint">
          {translate("admin.security.pageDesc")}
        </p>
      </header>

      <SecurityClient
        twoFactorEnabled={session.user.twoFactorEnabled}
        enforced={enforce === "1"}
        labels={labels}
      />
    </div>
  );
}
