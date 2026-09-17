import { db } from "@/lib/db";
import { getTranslations } from "@/lib/i18n";

/**
 * Route `/` — PHASE 1 : page d'état du socle technique (réelle, sans
 * contenu factice). La page d'accueil éditoriale pilotée par
 * homepage_blocks est livrée en PHASE 4 (§09.1).
 * Tous les libellés proviennent de `translations` (§00.2-2).
 */

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { translate } = await getTranslations();

  const [
    userCount,
    roleCount,
    categoryCount,
    articleCount,
    adSlotCount,
    listCount,
    menuCount,
    settingCount,
    translationCount,
    pageViewTables,
  ] = await Promise.all([
    db.user.count({ where: { deleted_at: null } }),
    db.role.count(),
    db.category.count({ where: { deleted_at: null } }),
    db.article.count({ where: { deleted_at: null } }),
    db.adSlot.count(),
    db.newsletterList.count(),
    db.menu.count(),
    db.setting.count(),
    db.translation.count(),
    db.page.count(),
  ]);

  const checks: { label: string; value: number; ready: boolean }[] = [
    { label: translate("status.check.roles"), value: roleCount, ready: roleCount >= 10 },
    { label: translate("status.check.users"), value: userCount, ready: userCount >= 1 },
    { label: translate("status.check.categories"), value: categoryCount, ready: categoryCount >= 12 },
    { label: translate("status.check.articles"), value: articleCount, ready: articleCount >= 1 },
    { label: translate("status.check.adSlots"), value: adSlotCount, ready: adSlotCount === 19 },
    { label: translate("status.check.newsletters"), value: listCount, ready: listCount >= 5 },
    { label: translate("status.check.menus"), value: menuCount, ready: menuCount >= 6 },
    { label: translate("status.check.settings"), value: settingCount, ready: settingCount >= 10 },
    { label: translate("status.check.translations"), value: translationCount, ready: translationCount >= 50 },
    { label: translate("status.check.pages"), value: pageViewTables, ready: pageViewTables >= 1 },
  ];

  const allReady = checks.every((check) => check.ready);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <header className="border-b border-rule pb-8">
        <p className="font-serif text-4xl font-bold tracking-tight">
          INFOS<span className="text-brand-red">PRO</span>
          <span className="text-lg font-normal text-ink-faint">.net</span>
        </p>
        <p className="mt-3 text-sm text-ink-soft">
          {translate("status.subtitle")}
        </p>
        <p className="mt-1 text-xs text-ink-faint">
          {translate("status.phaseBadge")}
        </p>
      </header>

      <section aria-labelledby="status-title" className="mt-8">
        <h1 id="status-title" className="kicker text-ink-faint">
          {translate("status.title")}
        </h1>
        <ul className="mt-4 divide-y divide-rule border border-rule">
          {checks.map((check) => (
            <li key={check.label} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm">{check.label}</span>
              <span className="flex items-center gap-3">
                <span className="font-mono text-sm tabular-nums text-ink-soft">
                  {check.value}
                </span>
                <span
                  aria-label={check.ready ? translate("status.ok") : translate("status.pending")}
                  className={`inline-block size-2 rounded-full ${
                    check.ready ? "bg-success" : "bg-rule-strong"
                  }`}
                />
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-ink-soft">
          {allReady
            ? translate("status.readyMessage")
            : translate("status.pendingMessage")}
        </p>
      </section>

      <section className="mt-10 border border-rule bg-paper-alt p-6">
        <h2 className="font-serif text-lg font-bold">
          {translate("status.adminTitle")}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">{translate("status.adminDesc")}</p>
        <a
          href="/login"
          className="mt-4 inline-block bg-brand-red px-4 py-2 text-sm font-semibold text-white transition-colors duration-[160ms] hover:bg-red-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
        >
          {translate("status.adminCta")}
        </a>
      </section>

      <footer className="mt-16 border-t border-rule pt-6 pb-4 text-xs text-ink-faint">
        <p>{translate("status.footerConakry")}</p>
      </footer>
    </main>
  );
}
