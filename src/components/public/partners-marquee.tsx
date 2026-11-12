"use client";

/**
 * Bandeau partenaires — PREMIUM : défilement horizontal autonome en boucle
 * parfaite (répétition suffisante du jeu de logos + piste dupliquée),
 * cartes blanches élégantes, logos nets (object-contain), monogramme
 * raffiné pour les partenaires sans logo, pause au survol, fondu des bords.
 */

export interface MarqueePartner {
  id: string;
  name: string;
  url: string | null;
  logoUrl: string | null;
  logoAlt: string | null;
}

/** Monogramme élégant (2 initiales en serif sur fond rosé). */
function Monogram({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span className="flex size-14 items-center justify-center rounded-full border border-[#A4161A]/15 bg-gradient-to-br from-[#A4161A]/10 to-transparent">
      <span className="bg-gradient-to-br from-[#A4161A] to-[#d45055] bg-clip-text font-serif text-xl font-black text-transparent">
        {initials || "?"}
      </span>
    </span>
  );
}

function PartnerCard({ partner }: { partner: MarqueePartner }) {
  const flare = (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 -translate-x-[130%] skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/50 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[520%]"
    />
  );
  const inner = partner.logoUrl ? (
    <img
      src={partner.logoUrl}
      alt={partner.logoAlt ?? partner.name}
      className="max-h-16 w-auto max-w-[150px] object-contain opacity-80 saturate-[.35] transition-all duration-500 ease-out group-hover:opacity-100 group-hover:saturate-100 md:max-h-[4.5rem]"
      loading="lazy"
      decoding="async"
    />
  ) : (
    <>
      <Monogram name={partner.name} />
      <span className="mt-1.5 max-w-[130px] truncate text-center text-[0.72rem] font-bold uppercase tracking-wider text-ink-soft">
        {partner.name}
      </span>
    </>
  );

  const cls =
    "group relative flex h-28 w-[180px] shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border border-rule/70 bg-white px-4 shadow-[0_1px_2px_rgba(20,18,14,0.04),0_10px_24px_-14px_rgba(20,18,14,0.18)] transition-all duration-500 ease-out hover:-translate-y-1 hover:border-[#A4161A]/35 hover:shadow-[0_2px_4px_rgba(20,18,14,0.05),0_18px_36px_-16px_rgba(164,22,26,0.35)] md:h-32 md:w-[210px]";

  return partner.url ? (
    <a href={partner.url} target="_blank" rel="noopener noreferrer" className={cls} aria-label={partner.name}>
      {inner}
      {flare}
    </a>
  ) : (
    <div className={cls}>
      {inner}
      {flare}
    </div>
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

  // Répétition du jeu pour garantir une piste large même avec 1-2
  // partenaires — le défilement tourne TOUJOURS, en boucle parfaite.
  const repetitions = Math.max(4, Math.ceil(10 / partners.length));
  const sequence = Array.from({ length: repetitions }, (_, r) =>
    partners.map((p) => ({ ...p, id: `${p.id}-${r}` })),
  ).flat();
  const duration = Math.min(70, Math.max(30, sequence.length * 4.2));

  return (
    <section aria-label={ariaLabel} className="partners-band">
      {title && (
        <p className="mb-4 flex items-center justify-center gap-3">
          <span aria-hidden className="h-px w-10 bg-gradient-to-r from-transparent to-rule-strong" />
          <span className="text-[0.66rem] font-bold uppercase tracking-[0.42em] text-ink-faint">{title}</span>
          <span aria-hidden className="h-px w-10 bg-gradient-to-l from-transparent to-rule-strong" />
        </p>
      )}

      <div
        className="pmarquee-viewport relative overflow-hidden"
        style={{ "--pm-duration": `${duration}s` } as React.CSSProperties}
      >
        <div className="pmarquee-track flex w-max">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex gap-5 px-2.5" aria-hidden={dup === 1}>
              {sequence.map((p) => (
                <PartnerCard key={`${dup}-${p.id}`} partner={p} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
