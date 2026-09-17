import { getTranslations } from "@/lib/i18n";
import type { PublicArticle } from "@/lib/public/homepage-data";

/**
 * Cartes et listes d'articles du front-office public (§05.2).
 * Toutes les cartes portent une image (couverture réelle), la rubrique,
 * l'heure et le temps de lecture. Lien : aperçu éditorial de l'article.
 * Task ID: 9-CARDS
 */

export function articleHref(a: PublicArticle): string {
  return `/admin/preview/${a.id}`;
}

export function timeAgo(date: Date | null, now: Date, labels: { today: string; yesterday: string }): string {
  if (!date) return "";
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return `${Math.max(diffMin, 1)} min`;
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return `${labels.today} ${new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Conakry" }).format(date)}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `${labels.yesterday} ${new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Conakry" }).format(date)}`;
  }
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Conakry" }).format(date);
}

async function Badge({ article }: { article: PublicArticle }) {
  const { translate } = await getTranslations();
  if (article.isBreaking) {
    return (
      <span className="inline-block bg-brand-red px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-widest text-white">
        {translate("public.card.breaking")}
      </span>
    );
  }
  if (article.format === "video") {
    return (
      <span className="inline-flex items-center gap-1 bg-ink px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-widest text-paper">
        ▶ {translate("public.card.video")}
      </span>
    );
  }
  if (article.isSponsored) {
    return (
      <span className="inline-block bg-paper-alt px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-widest text-ink-soft ring-1 ring-rule-strong">
        {translate("public.card.sponsored")}
      </span>
    );
  }
  return null;
}

/** Image de couverture — <img> simple, ratios presse, pas de layout shift. */
export function Cover({
  article,
  className = "",
  sizesClass = "",
  priority = false,
}: {
  article: PublicArticle;
  className?: string;
  sizesClass?: string;
  priority?: boolean;
}) {
  if (!article.cover) {
    return <div aria-hidden className={`bg-paper-sunk ${className}`} />;
  }
  return (
    <img
      src={article.cover.url}
      alt={article.cover.alt ?? article.title}
      width={article.cover.width ?? undefined}
      height={article.cover.height ?? undefined}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={`object-cover ${sizesClass} ${className}`}
    />
  );
}

/** Carte vedette de la une (grande image + titre + chapô). */
export async function HeroCard({ article }: { article: PublicArticle }) {
  const { translate } = await getTranslations();
  const now = new Date();
  return (
    <a href={articleHref(article)} className="group block">
      <div className="relative overflow-hidden">
        <Cover
          article={article}
          priority
          className="aspect-[16/9] w-full transition-transform duration-500 ease-[var(--ease-inout)] group-hover:scale-[1.02]"
        />
        <div className="absolute left-3 top-3 flex gap-2">
          <Badge article={article} />
        </div>
      </div>
      <div className="pt-4">
        <p className="kicker text-brand-red">{article.category?.name ?? article.kicker}</p>
        <h2 className="mt-2 font-serif text-2xl font-black leading-tight tracking-tight transition-colors duration-200 group-hover:text-brand-red md:text-[2rem]">
          {article.title}
        </h2>
        {article.lede && <p className="mt-2 line-clamp-2 text-[0.95rem] leading-relaxed text-ink-soft">{article.lede}</p>}
        <p className="mt-3 text-xs text-ink-faint">
          {timeAgo(article.publishedAt, now, { today: translate("public.time.today"), yesterday: translate("public.time.yesterday") })}
          {" · "}
          {article.readingTimeMin} {translate("public.card.readTime")}
        </p>
      </div>
    </a>
  );
}

/** Carte latérale de la une — vignette + titre. */
export async function SideCard({ article }: { article: PublicArticle }) {
  const { translate } = await getTranslations();
  const now = new Date();
  return (
    <a
      href={articleHref(article)}
      className="group flex gap-3 border-b border-rule pb-3 last:border-0 last:pb-0"
    >
      <div className="w-24 shrink-0 overflow-hidden md:w-28">
        <Cover
          article={article}
          className="aspect-[4/3] w-full transition-transform duration-500 group-hover:scale-[1.04]"
        />
      </div>
      <div className="min-w-0">
        <p className="kicker text-[0.65rem] text-brand-red">{article.category?.name}</p>
        <h3 className="mt-1 line-clamp-3 font-serif text-[0.95rem] font-bold leading-snug transition-colors duration-200 group-hover:text-brand-red">
          {article.shortTitle ?? article.title}
        </h3>
        <p className="mt-1 text-[0.7rem] text-ink-faint">
          {timeAgo(article.publishedAt, now, { today: translate("public.time.today"), yesterday: translate("public.time.yesterday") })}
        </p>
      </div>
    </a>
  );
}

/** Ligne compacte de section — vignette + titre (liste à droite de la vedette). */
export async function RowCard({ article }: { article: PublicArticle }) {
  const { translate } = await getTranslations();
  const now = new Date();
  return (
    <a href={articleHref(article)} className="group flex gap-3 py-3">
      <div className="w-20 shrink-0 overflow-hidden md:w-24">
        <Cover article={article} className="aspect-[4/3] w-full transition-transform duration-500 group-hover:scale-[1.04]" />
      </div>
      <div className="min-w-0">
        <h3 className="line-clamp-2 font-serif text-[0.95rem] font-bold leading-snug transition-colors duration-200 group-hover:text-brand-red">
          {article.shortTitle ?? article.title}
        </h3>
        <p className="mt-1 text-[0.7rem] text-ink-faint">
          {timeAgo(article.publishedAt, now, { today: translate("public.time.today"), yesterday: translate("public.time.yesterday") })}
          {" · "}
          {article.readingTimeMin} {translate("public.card.readTime")}
        </p>
      </div>
    </a>
  );
}

/** Ligne texte de « En continu » — numérotée. */
export async function ContinuousItem({ article, index }: { article: PublicArticle; index: number }) {
  const { translate } = await getTranslations();
  const now = new Date();
  return (
    <a href={articleHref(article)} className="group flex gap-3 py-2.5">
      <span aria-hidden className="w-6 shrink-0 font-mono text-sm font-bold text-rule-strong transition-colors duration-200 group-hover:text-brand-red">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="min-w-0">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug transition-colors duration-200 group-hover:text-brand-red">
          {article.shortTitle ?? article.title}
        </h3>
        <p className="mt-0.5 text-[0.65rem] uppercase tracking-wide text-ink-faint">
          {article.category?.name} ·{" "}
          {timeAgo(article.publishedAt, now, { today: translate("public.time.today"), yesterday: translate("public.time.yesterday") })}
        </p>
      </div>
    </a>
  );
}

/** Item « Les plus lus » — grand numéro serif. */
export async function MostReadItem({ article, index }: { article: PublicArticle; index: number }) {
  return (
    <a href={articleHref(article)} className="group flex items-start gap-3 border-b border-rule py-3 last:border-0">
      <span aria-hidden className="font-serif text-3xl font-black leading-none text-rule transition-colors duration-200 group-hover:text-brand-red">
        {index + 1}
      </span>
      <div className="min-w-0">
        <h3 className="line-clamp-2 font-serif text-sm font-bold leading-snug transition-colors duration-200 group-hover:text-brand-red">
          {article.shortTitle ?? article.title}
        </h3>
        <p className="mt-0.5 text-[0.65rem] uppercase tracking-wide text-ink-faint">{article.category?.name}</p>
      </div>
    </a>
  );
}
