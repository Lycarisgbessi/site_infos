import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getEffectivePermissions } from "@/lib/permissions";
import { getTranslations } from "@/lib/i18n";
import { ADMIN_NAV } from "@/lib/admin/nav";
import { TWO_FACTOR_REQUIRED_ROLES } from "@/lib/auth/totp";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { CommandPalette } from "@/components/admin/CommandPalette";

/**
 * Layout du back-office (§11.1, §20 Phase 1 tâche 10) :
 * navigation latérale filtrée par permissions réelles, en-tête avec
 * l'utilisateur courant, palette de commandes Ctrl+K, thème clair/sombre.
 *
 * Garde serveur complète (session en base, expiration, statut du compte) —
 * le middleware ne fait qu'un tri rapide sur la présence du cookie.
 * 2FA obligatoire pour les rôles privilégiés (§08.3) : redirection forcée
 * vers l'écran de sécurité tant qu'elle n'est pas activée.
 */

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  if (!session) {
    redirect("/login?next=/admin");
  }

  const { user } = session;
  const permissions = await getEffectivePermissions(user);
  const { translate } = await getTranslations(user.locale);

  // 2FA obligatoire (§08.3) pour admin, publisher, chief_editor, ad_manager
  const twoFactorRequired =
    user.roles.some((r) => TWO_FACTOR_REQUIRED_ROLES.has(r.key)) &&
    !user.twoFactorEnabled;

  const visibleNav = ADMIN_NAV.filter((item) => {
    if (item.permission === null) return true;
    return permissions.has(item.permission);
  }).map((item) => ({
    ...item,
    label: translate(item.labelKey),
    enabled: item.phase === 1, // les modules des phases suivantes arrivent avec leur phase
    phaseLabel:
      item.phase === 1
        ? null
        : translate("admin.nav.phaseBadge", { phase: item.phase }),
  }));

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AdminHeader
        user={{
          displayName: user.displayName,
          email: user.email,
          roles: user.roles.map((r) => r.key),
          twoFactorEnabled: user.twoFactorEnabled,
        }}
        labels={{
          signOut: translate("admin.header.signOut"),
          theme: translate("admin.header.theme"),
          security: translate("admin.nav.security"),
          search: translate("admin.header.search"),
        }}
      />
      <div className="flex flex-1">
        <AdminSidebar items={visibleNav} />
        <main className="flex-1 min-w-0 px-4 py-6 lg:px-8">{children}</main>
      </div>
      <CommandPalette
        items={visibleNav.map((item) => ({
          href: item.href,
          label: item.label,
          enabled: item.enabled,
          phaseLabel: item.phaseLabel,
        }))}
      />
      {twoFactorRequired ? (
        <div className="fixed inset-x-0 bottom-0 z-[500] border-t border-rule bg-red-wash px-4 py-3 text-center text-sm text-ink">
          <a
            href="/admin/securite"
            className="font-medium underline underline-offset-2"
          >
            {translate("admin.security.twoFactorRequired")}
          </a>
        </div>
      ) : null}
    </div>
  );
}
