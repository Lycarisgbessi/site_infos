import Link from "next/link";
import { getTranslations } from "@/lib/i18n";
import { getFlashItems, type FlashItemView } from "@/lib/public/homepage-data";

/**
 * Bandeau flash info — défilement horizontal automatique et continu.
 * Technique : piste dupliquée ×2 + animation CSS translateX(-50%) en boucle
 * infinie → défilement sans saut. Pause au survol ; en `prefers-reduced-motion`,
 * la piste devient une rangée déroulable horizontalement (§10.2-4).
 * Task ID: 9-FLASH
 */

interface FlashItem {
  id: string;
  text: string;
  priority: number;
  articleSlug: string | null;
  externalUrl: string | null;
}

function TickerTrack({
  items,
  urgentLabel,
  ariaHidden,
}: {
  items: FlashItem[];
  urgentLabel: string;
  ariaHidden?: boolean;
}) {
  return (
    <div aria-hidden={ariaHidden} className="flex shrink-0 items-center whitespace-nowrap">
      {items.map((item) => {
        const href = item.articleSlug ? `/article/${item.articleSlug}` : item.externalUrl;
        const internal = Boolean(item.articleSlug);
        return (
          <span key={`${ariaHidden ?? "v"}-${item.id}`} className="flex items-center">
            {href ? (
              <Link
                href={href}
                {...(internal ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                tabIndex={ariaHidden ? -1 : undefined}
                className="px-6 text-sm font-semibold text-white transition-colors duration-200 hover:text-white hover:underline hover:decoration-white/70 hover:underline-offset-4"
              >
                {item.priority === 1 && (
                  <span className="me-2 inline-block rounded-sm bg-ink px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-widest text-white">
                    {urgentLabel}
                  </span>
                )}
                <span>{item.text}</span>
              </Link>
            ) : (
              <span className="px-6 text-sm font-semibold text-white">
                {item.priority === 1 && (
                  <span className="me-2 inline-block rounded-sm bg-ink px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-widest text-white">
                    {urgentLabel}
                  </span>
                )}
                <span>{item.text}</span>
              </span>
            )}
            <span aria-hidden className="inline-block size-1.5 shrink-0 rounded-full bg-white/70" />
          </span>
        );
      })}
    </div>
  );
}

export async function FlashTicker() {
  const { translate } = await getTranslations();
  const items = await getFlashItems();
  if (items.length === 0) return null;

  const hasUrgent = items.some((i) => i.priority === 1);

  return (
    <section aria-label={translate("public.flash.label")} className="border-b-2 border-ink/20 bg-gradient-to-r from-brand-red via-red-600 to-brand-red">
      <div className="container-page flex items-stretch gap-0">
        {/* Étiquette fixe à gauche */}
        <div className="relative z-10 flex shrink-0 items-center gap-2 bg-ink px-3 py-2 md:px-4">
          <span
            aria-hidden
            className={`inline-block size-2 rounded-full bg-paper ${hasUrgent ? "animate-ping" : "animate-pulse"}`}
          />
          <span className="kicker text-sm text-white">{translate("public.flash.label")}</span>
        </div>

        {/* Piste défilante — dupliquée pour une boucle sans rupture */}
        <div className="marquee-viewport flex min-w-0 flex-1 items-center overflow-hidden py-2">
          <div className="marquee-track flex">
            <TickerTrack items={items} urgentLabel={translate("public.flash.urgent")} />
            <TickerTrack items={items} urgentLabel={translate("public.flash.urgent")} ariaHidden />
          </div>
        </div>
      </div>
    </section>
  );
}
