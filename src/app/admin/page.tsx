import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { TWO_FACTOR_REQUIRED_ROLES } from "@/lib/auth/totp";
import { getTranslations } from "@/lib/i18n";
import { db } from "@/lib/db";

/**
 * Tableau de bord /admin (§11.2) — PHASE 1 : coquille avec indicateurs
 * réels issus de la base (aucune donnée en dur, §00.2-2).
 * Les widgets réorganisables, l'agenda éditorial complet et les sources
 * de trafic arrivent avec les phases de données (PHASE 3 analytics).
 */

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");

  // 2FA obligatoire (§08.3) — barrière serveur avant tout contenu
  const twoFactorRequired =
    session.user.roles.some((r) => TWO_FACTOR_REQUIRED_ROLES.has(r.key)) &&
    !session.user.twoFactorEnabled;
  if (twoFactorRequired) {
    redirect("/admin/securite?enforce=1");
  }

  const { translate } = await getTranslations(session.user.locale);

  const [articlesByStatus, usersByStatus, categoryCount, activeFlash, recentAudit] =
    await Promise.all([
      db.article.groupBy({
        by: ["status"],
        _count: { _all: true },
        where: { deleted_at: null },
      }),
      db.user.groupBy({
        by: ["status"],
        _count: { _all: true },
        where: { deleted_at: null },
      }),
      db.category.count({ where: { deleted_at: null } }),
      db.flashNews.count({
        where: { deleted_at: null, expires_at: { gt: new Date() } },
      }),
      db.auditLog.findMany({
        orderBy: { created_at: "desc" },
        take: 8,
        select: {
          id: true,
          action: true,
          resource_type: true,
          created_at: true,
          user: { select: { display_name: true } },
        },
      }),
    ]);

  const statusCount = (status: string) =>
    articlesByStatus.find((row) => row.status === status)?._count._all ?? 0;
  const userCount = (status: string) =>
    usersByStatus.find((row) => row.status === status)?._count._all ?? 0;

  const draftCount = statusCount("draft");
  const reviewCount =
    statusCount("in_review") + statusCount("changes_requested");
  const scheduledCount = statusCount("scheduled");
  const publishedCount = statusCount("published");

  const indicators = [
    { label: translate("admin.dash.published"), value: publishedCount },
    { label: translate("admin.dash.drafts"), value: draftCount },
    { label: translate("admin.dash.review"), value: reviewCount },
    { label: translate("admin.dash.scheduled"), value: scheduledCount },
  ];

  const formatAuditAction = (action: string) =>
    action.split(".").slice(1).join(".");

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <h1 className="font-serif text-2xl font-bold tracking-tight">
          {translate("admin.dash.title")}
        </h1>
        <p className="mt-1 text-sm text-ink-faint">
          {translate("admin.dash.subtitle")}
        </p>
      </header>

      <section aria-labelledby="dash-indicators">
        <h2 id="dash-indicators" className="kicker text-ink-faint">
          {translate("admin.dash.indicators")}
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-px border border-rule bg-rule lg:grid-cols-4">
          {indicators.map((item) => (
            <div key={item.label} className="bg-paper p-4">
              <dt className="text-xs uppercase tracking-wide text-ink-faint">
                {item.label}
              </dt>
              <dd className="mt-1 font-serif text-3xl font-bold tabular-nums">
                {item.value}
              </dd>
            </div>
          ))}
          <div className="bg-paper p-4 lg:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-ink-faint">
              {translate("admin.dash.flashActive")}
            </dt>
            <dd className="mt-1 font-serif text-3xl font-bold tabular-nums">
              {activeFlash}
            </dd>
          </div>
          <div className="bg-paper p-4 lg:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-ink-faint">
              {translate("admin.dash.categories")}
            </dt>
            <dd className="mt-1 font-serif text-3xl font-bold tabular-nums">
              {categoryCount}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="dash-team">
        <h2 id="dash-team" className="kicker text-ink-faint">
          {translate("admin.dash.team")}
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-px border border-rule bg-rule lg:grid-cols-4">
          {(["active", "invited", "suspended", "disabled"] as const).map(
            (status) => (
              <div key={status} className="bg-paper p-4">
                <dt className="text-xs uppercase tracking-wide text-ink-faint">
                  {translate(`admin.dash.userStatus.${status}`)}
                </dt>
                <dd className="mt-1 font-serif text-2xl font-bold tabular-nums">
                  {userCount(status)}
                </dd>
              </div>
            )
          )}
        </dl>
      </section>

      <section aria-labelledby="dash-audit">
        <h2 id="dash-audit" className="kicker text-ink-faint">
          {translate("admin.dash.recentActivity")}
        </h2>
        <div className="mt-3 overflow-hidden border border-rule">
          <table className="w-full text-sm">
            <caption className="sr-only">
              {translate("admin.dash.recentActivity")}
            </caption>
            <thead className="bg-paper-alt text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {translate("admin.dash.action")}
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {translate("admin.dash.resource")}
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {translate("admin.dash.by")}
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {translate("admin.dash.at")}
                </th>
              </tr>
            </thead>
            <tbody>
              {recentAudit.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-ink-faint">
                    {translate("admin.dash.noActivity")}
                  </td>
                </tr>
              ) : (
                recentAudit.map((entry) => (
                  <tr key={String(entry.id)} className="border-t border-rule">
                    <td className="px-3 py-2 font-mono text-xs">
                      {formatAuditAction(entry.action)}
                    </td>
                    <td className="px-3 py-2 text-ink-soft">{entry.resource_type}</td>
                    <td className="px-3 py-2 text-ink-soft">
                      {entry.user?.display_name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-ink-faint tabular-nums">
                      {new Intl.DateTimeFormat("fr-FR", {
                        dateStyle: "short",
                        timeStyle: "short",
                        timeZone: "Africa/Conakry",
                      }).format(entry.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
