import { getTranslations } from "@/lib/i18n";
import type { PublicArticle } from "@/lib/public/homepage-data";
import { Cover, HeroCard, RowCard } from "./article-cards";

/**
 * Section « rubrique » (gabarit featured-list §09.1) : vedette à gauche,
 * liste compacte à droite, filet et titre cliquable.
 * Task ID: 9-SECTIONS
 */

export async function SectionBlock({
  id,
  title,
  articles,
  adSlot,
}: {
  id: string;
  title: string;
  articles: PublicArticle[];
  adSlot?: React.ReactNode;
}) {
  const { translate } = await getTranslations();
  if (articles.length === 0) return null;

  const [featured, ...rest] = articles;
  const listItems = rest.slice(0, 4);

  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20">
      <header className="flex items-baseline justify-between border-b-2 border-ink pb-2">
        <h2 id={`${id}-title`} className="font-serif text-xl font-black tracking-tight md:text-2xl">
          {title}
        </h2>
        <a
          href={`/#${id}`}
          className="text-xs font-semibold uppercase tracking-widest text-ink-faint transition-colors duration-200 hover:text-brand-red"
        >
          {translate("public.section.all")} →
        </a>
      </header>

      <div className="grid gap-x-8 gap-y-4 pt-4 md:grid-cols-2">
        <HeroCard article={featured} />
        <div className="divide-y divide-rule border-t border-rule md:border-t-0">
          {listItems.map((a) => (
            <RowCard key={a.id} article={a} />
          ))}
        </div>
      </div>

      {adSlot}
    </section>
  );
}

/** Bloc dossier immersif (Z-11) — image plein cadre + voile. */
export async function DossierBlock({
  dossier,
  kickerLabel,
}: {
  dossier: { id: string; title: string; lede: string | null; cover: { url: string; alt: string | null } | null };
  kickerLabel: string;
}) {
  return (
    <section aria-label={kickerLabel} className="relative overflow-hidden">
      {dossier.cover ? (
        <img
          src={dossier.cover.url}
          alt={dossier.cover.alt ?? dossier.title}
          className="aspect-[21/9] w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="aspect-[21/9] w-full bg-ink" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/40 to-transparent" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 p-5 md:p-8">
        <p className="kicker text-red-bright">{kickerLabel}</p>
        <h2 className="mt-1 max-w-2xl font-serif text-2xl font-black leading-tight text-paper md:text-3xl">
          {dossier.title}
        </h2>
        {dossier.lede && <p className="mt-2 hidden max-w-xl text-sm text-paper/80 md:block">{dossier.lede}</p>}
      </div>
    </section>
  );
}

/** Bloc reportages vidéo (Z-08) — fond sombre, défilement horizontal. */
export async function VideoSection({ articles, title, playLabel }: { articles: PublicArticle[]; title: string; playLabel: string }) {
  if (articles.length === 0) return null;
  return (
    <section aria-label={title} className="bg-ink py-6 md:py-8">
      <div className="container-page">
        <header className="mb-4 flex items-center justify-between border-b border-paper/20 pb-2">
          <h2 className="font-serif text-xl font-black tracking-tight text-paper md:text-2xl">▶ {title}</h2>
        </header>
        <div className="flex snap-x gap-4 overflow-x-auto pb-2">
          {articles.map((a) => (
            <a key={a.id} href={`/admin/preview/${a.id}`} className="group relative w-[260px] shrink-0 snap-start md:w-[320px]">
              <div className="relative overflow-hidden">
                {a.cover ? (
                  <img
                    src={a.cover.url}
                    alt={a.cover.alt ?? a.title}
                    className="aspect-video w-full object-cover opacity-90 transition-all duration-500 group-hover:scale-[1.03] group-hover:opacity-100"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="aspect-video w-full bg-paper-sunk" />
                )}
                <span
                  aria-hidden
                  className="absolute inset-0 m-auto flex size-12 items-center justify-center rounded-full bg-brand-red/95 text-lg text-white transition-transform duration-300 group-hover:scale-110"
                >
                  ▶
                </span>
              </div>
              <h3 className="mt-2 line-clamp-2 font-serif text-sm font-bold leading-snug text-paper transition-colors duration-200 group-hover:text-red-bright">
                {a.shortTitle ?? a.title}
              </h3>
              <p className="sr-only">{playLabel}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Mini-cartes horizontales Monde (Z-12) — grille 2×2 avec vignettes. */
export async function WorldGrid({ articles }: { articles: PublicArticle[] }) {
  if (articles.length === 0) return null;
  return (
    <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
      {articles.slice(0, 4).map((a) => (
        <a key={a.id} href={`/admin/preview/${a.id}`} className="group block">
          <Cover article={a} className="aspect-[16/10] w-full transition-transform duration-500 group-hover:scale-[1.03]" />
          <p className="kicker mt-2 text-[0.65rem] text-brand-red">{a.category?.name}</p>
          <h3 className="mt-1 line-clamp-3 font-serif text-sm font-bold leading-snug transition-colors duration-200 group-hover:text-brand-red">
            {a.shortTitle ?? a.title}
          </h3>
        </a>
      ))}
    </div>
  );
}

/** Cartes Opinions (Z-13) — Fond papier alterné, auteur mis en avant. */
export async function OpinionCards({ articles }: { articles: PublicArticle[] }) {
  if (articles.length === 0) return null;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {articles.slice(0, 4).map((a) => (
        <a
          key={a.id}
          href={`/admin/preview/${a.id}`}
          className="group flex flex-col border border-rule bg-paper-alt p-4 transition-colors duration-200 hover:border-ink"
        >
          <p className="kicker text-brand-red">{a.category?.name}</p>
          <h3 className="mt-2 line-clamp-3 flex-1 font-serif text-base font-bold leading-snug transition-colors duration-200 group-hover:text-brand-red">
            {a.shortTitle ?? a.title}
          </h3>
          {a.authors[0] && (
            <p className="mt-3 border-t border-rule pt-2 text-xs text-ink-soft">
              <span className="font-semibold text-ink">{a.authors[0].name}</span>
              {a.authors[0].role ? ` — ${a.authors[0].role}` : ""}
            </p>
          )}
        </a>
      ))}
    </div>
  );
}
