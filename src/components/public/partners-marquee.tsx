"use client";

import Link from "next/link";

/**
 * Bandeau des logos partenaires — défilement horizontal AUTONOME en boucle
 * (piste dupliquée ×2, translation -50 %), pause au survol, repli statique
 * en prefers-reduced-motion. Cartes claires, logos nets (object-contain,
 * jamais déformés), légèrement grisés puis en couleurs au survol.
 */

export interface MarqueePartner {
  id: string;
  name: string;
  url: string | null;
  logoUrl: string | null;
  logoAlt: string | null;
}

function PartnerCard({ partner }: { partner: MarqueePartner }) {
  const inner = (
    <>
      {partner.logoUrl ? (
        <img
          src={partner.logoUrl}
          alt={partner.logoAlt ?? partner.name}
          className="h-12 w-auto max-w-[140px] object-contain opacity-75 grayscale transition-all duration-300 group-hover:opacity-100 group-hover:grayscale-0 md:h-14"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="px-2 text-center font-serif text-sm font-bold leading-snug text-ink-soft transition-colors duration-300 group-hover:text-ink">
          {partner.name}
        </span>
      )}
    </>
  );

  const cls =
    "group flex h-20 w-[170px] shrink-0 items-center justify-center rounded-lg border border-rule bg-paper px-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#A4161A]/40 hover:shadow-md md:h-24 md:w-[190px]";

  return partner.url ? (
    <a
      href={partner.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cls}
      aria-label={partner.name}
    >
      {inner}
    </a>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function PartnersMarquee({
  partners,
  title,
  ariaLabel,
}: {
  partners: MarqueePartner[];
  title?: string;
  ariaLabel: string;
}) {
  if (partners.length === 0) return null;

  // Trop peu de partenaires : une rangée statique centrée (défilement inutile)
  const staticMode = partners.length < 4;

  return (
    <section aria-label={ariaLabel} className="border-y border-rule bg-paper-alt py-4">
      {title && (
        <p className="mb-3 text-center text-[0.68rem] font-bold uppercase tracking-[0.34em] text-ink-faint">
          {title}
        </p>
      )}

      {staticMode ? (
        <div className="flex flex-wrap items-center justify-center gap-3 px-4">
          {partners.map((p) => (
            <PartnerCard key={p.id} partner={p} />
          ))}
        </div>
      ) : (
        <div
          className="pmarquee-viewport relative overflow-hidden"
          style={{ "--pm-duration": `${Math.max(26, partners.length * 7)}s` } as React.CSSProperties}
        >
          <div className="pmarquee-track flex w-max">
            {[0, 1].map((dup) => (
              <div key={dup} className="flex gap-3 pe-3 ps-3" aria-hidden={dup === 1}>
                {partners.map((p) => (
                  <PartnerCard key={`${dup}-${p.id}`} partner={p} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
