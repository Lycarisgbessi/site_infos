import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "@/lib/i18n";
import { TopBar, SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { Reveal } from "@/components/public/reveal";
import { getActiveDossiersList } from "@/lib/public/taxonomy-data";

/**
 * Route `/dossiers` — index de tous les dossiers actifs et dans leur
 * fenêtre de publication : couverture, titre, chapô (lede) et compte
 * d'articles publiés. Cartes cliquables vers `/dossiers/{slug}`, mis en
 * avant (is_featured) d'abord, puis du plus récent au plus ancien.
 */

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://site-infos-six.vercel.app";

export async function generateMetadata(): Promise<Metadata> {
  const { translate } = await getTranslations();
  return {
    title: translate("public.dossiers.pageTitle"),
    description: translate("public.dossiers.pageSubtitle"),
    alternates: { canonical: `${SITE_URL}/dossiers` },
  };
}

export default async function DossiersIndexPage() {
  const { translate } = await getTranslations();
  const dossiers = await getActiveDossiersList();

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <TopBar />
      <SiteHeader />

      <main id="contenu" className="flex-1 pb-16">
        <div className="container-page pt-10">
          <header className="border-b-2 border-ink pb-3">
            <p className="kicker text-brand-red">{translate("public.dossiers.kicker")}</p>
            <h1 className="mt-1 font-serif text-3xl font-black tracking-tight md:text-4xl">
              {translate("public.dossiers.pageTitle")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-ink-soft">{translate("public.dossiers.pageSubtitle")}</p>
          </header>

          {dossiers.length === 0 ? (
            <p className="mt-8 border border-dashed border-rule-strong p-6 text-sm text-ink-soft">
              {translate("public.dossiers.empty")}
            </p>
          ) : (
            <div className="mt-6 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {dossiers.map((d, i) => (
                <Reveal key={d.id} delay={Math.min(i, 5) * 60}>
                  <Link href={`/dossiers/${d.slug}`} className="group block">
                    <div className="overflow-hidden">
                      {d.cover ? (
                        <img
                          src={d.cover.url}
                          alt={d.cover.alt ?? d.title}
                          width={d.cover.width ?? undefined}
                          height={d.cover.height ?? undefined}
                          loading="lazy"
                          decoding="async"
                          className="aspect-[16/9] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="flex aspect-[16/9] w-full items-center justify-center border border-rule bg-paper-alt">
                          <span aria-hidden className="font-serif text-3xl font-black text-ink-faint">
                            D.
                          </span>
                        </div>
                      )}
                    </div>
                    {d.isFeatured && (
                      <p className="kicker mt-3 text-brand-red">{translate("public.dossiers.featured")}</p>
                    )}
                    <h2 className="mt-1 line-clamp-2 font-serif text-base font-bold leading-snug transition-colors duration-200 group-hover:text-brand-red">
                      {d.title}
                    </h2>
                    {d.lede && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-soft">{d.lede}</p>}
                    <p className="mt-2 text-xs uppercase tracking-widest text-ink-faint">
                      {translate("public.dossiers.articlesCount", { count: d.articleCount })}
                    </p>
                  </Link>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
