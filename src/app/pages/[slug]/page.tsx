import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "@/lib/i18n";
import { TopBar, SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { NewsletterBlock } from "@/components/public/newsletter-block";

/**
 * Pages statiques du site : contact, publicité, newsletters.
 * Rend des mises en page simples et élégantes (tokens ink/paper, cartes).
 * 404 pour tout autre slug.
 */

export const dynamic = "force-dynamic";

const CONTACT_EMAIL = "contact@infospro.net";
const ADS_EMAIL = "regie@infospro.net";
const PHONE = "+224 620 00 00 00";

export default async function StaticPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { translate } = await getTranslations();

  if (slug !== "contact" && slug !== "publicite" && slug !== "newsletters") notFound();

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <TopBar />
      <SiteHeader />

      <main id="contenu" className="flex-1 pb-16">
        <div className="mx-auto max-w-3xl px-6 pt-10">
          {slug === "contact" && (
            <section aria-label={translate("public.pages.contact.title")}>
              <header className="border-b-2 border-ink pb-3">
                <h1 className="font-serif text-3xl font-black tracking-tight md:text-4xl">
                  {translate("public.pages.contact.title")}
                </h1>
                <p className="mt-2 text-sm text-ink-soft">{translate("public.pages.contact.subtitle")}</p>
              </header>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="border border-rule bg-paper-alt p-5">
                  <p className="kicker text-brand-red">{translate("public.pages.contact.email")}</p>
                  <a href={`mailto:${CONTACT_EMAIL}`} className="mt-2 block break-all font-serif font-bold hover:text-brand-red">
                    {CONTACT_EMAIL}
                  </a>
                </div>
                <div className="border border-rule bg-paper-alt p-5">
                  <p className="kicker text-brand-red">{translate("public.pages.contact.phone")}</p>
                  <a href={`tel:${PHONE.replace(/\s/g, "")}`} className="mt-2 block font-serif font-bold hover:text-brand-red">
                    {PHONE}
                  </a>
                </div>
                <div className="border border-rule bg-paper-alt p-5">
                  <p className="kicker text-brand-red">{translate("public.pages.contact.address")}</p>
                  <p className="mt-2 font-serif font-bold">{translate("public.pages.contact.addressValue")}</p>
                </div>
              </div>

              <p className="mt-6 border border-dashed border-rule-strong p-4 text-sm text-ink-soft">
                {translate("public.pages.contact.formHint")}
              </p>
            </section>
          )}

          {slug === "publicite" && (
            <section aria-label={translate("public.pages.advertise.title")}>
              <header className="border-b-2 border-ink pb-3">
                <h1 className="font-serif text-3xl font-black tracking-tight md:text-4xl">
                  {translate("public.pages.advertise.title")}
                </h1>
                <p className="mt-2 text-sm text-ink-soft">{translate("public.pages.advertise.subtitle")}</p>
              </header>

              <p className="mt-6 leading-relaxed text-ink-soft">{translate("public.pages.advertise.pitch")}</p>

              <div className="mt-6 border border-rule bg-paper-alt p-5">
                <p className="kicker">{translate("public.pages.advertise.formats")}</p>
                <ul className="mt-3 space-y-2">
                  <li className="flex gap-2 text-sm leading-relaxed">
                    <span aria-hidden className="mt-2 inline-block size-1.5 shrink-0 rounded-full bg-brand-red" />
                    {translate("public.pages.advertise.format1")}
                  </li>
                  <li className="flex gap-2 text-sm leading-relaxed">
                    <span aria-hidden className="mt-2 inline-block size-1.5 shrink-0 rounded-full bg-brand-red" />
                    {translate("public.pages.advertise.format2")}
                  </li>
                  <li className="flex gap-2 text-sm leading-relaxed">
                    <span aria-hidden className="mt-2 inline-block size-1.5 shrink-0 rounded-full bg-brand-red" />
                    {translate("public.pages.advertise.format3")}
                  </li>
                </ul>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-4">
                <a
                  href={`mailto:${ADS_EMAIL}`}
                  className="inline-flex h-11 items-center bg-brand-red px-5 text-sm font-bold text-white transition-colors duration-200 hover:bg-red-deep"
                >
                  {translate("public.pages.advertise.cta")} — {ADS_EMAIL}
                </a>
              </div>
            </section>
          )}

          {slug === "newsletters" && (
            <section aria-label={translate("public.pages.newsletter.title")}>
              <header className="border-b-2 border-ink pb-3">
                <h1 className="font-serif text-3xl font-black tracking-tight md:text-4xl">
                  {translate("public.pages.newsletter.title")}
                </h1>
                <p className="mt-2 text-sm text-ink-soft">{translate("public.pages.newsletter.subtitle")}</p>
              </header>

              <div className="mt-6">
                <NewsletterBlock
                  kicker={translate("public.newsletter.kicker")}
                  title={translate("public.newsletter.morningTitle")}
                  description={translate("public.newsletter.morningDesc")}
                  placeholder={translate("public.newsletter.placeholder")}
                  cta={translate("public.newsletter.cta")}
                  okMessage={translate("public.newsletter.ok")}
                  errorMessage={translate("public.newsletter.error")}
                  loadingMessage={translate("public.newsletter.loading")}
                />
              </div>
            </section>
          )}

          <p className="mt-10">
            <Link href="/" className="text-xs font-semibold uppercase tracking-widest text-ink-faint hover:text-brand-red">
              ← {translate("public.pages.backHome")}
            </Link>
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
