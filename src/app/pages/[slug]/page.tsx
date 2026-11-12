import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BadgeCheck, Handshake, MapPin, ShieldCheck, Users } from "lucide-react";
import { db } from "@/lib/db";
import { BlockRenderer, type MediaLike } from "@/components/blocks/BlockRenderer";
import { parseBlocks, type Block } from "@/types/blocks";
import { getTranslations } from "@/lib/i18n";
import { getSettingsByGroup } from "@/server/services/settings";
import { listActiveTeam, type PublicTeamMemberView } from "@/server/services/team";
import { listActivePartners, type PublicPartnerView } from "@/server/services/partners";
import { PartnersMarquee } from "@/components/public/partners-marquee";
import { TopBar, SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { NewsletterBlock } from "@/components/public/newsletter-block";
import { Reveal } from "@/components/public/reveal";
import { decodeSlug } from "@/lib/slug-decode";

/**
 * Pages publiques /pages/[slug].
 * 1. Page publiée en base (table `pages`, créée dans /admin/pages) : rendu
 *    éditorial — titre + blocs du body (même format §06.4 que les articles,
 *    mêmes props BlockRenderer).
 * 2. Slugs spéciaux gérés ici (le contenu d'accompagnement en blocs peut
 *    venir d'une Page admin publiée du même slug, optionnel) :
 *    - `a-propos`        : Page admin si elle existe, sinon page éditoriale
 *                          par défaut (valeurs, CTA contact) ;
 *    - `notre-equipe`    : grille des membres actifs (table `team_members`,
 *                          gérée dans /admin/pages → onglet Équipe) ;
 *    - `nos-partenaires` : partenaires actifs groupés par catégorie (table
 *                          `partners`, onglet Partenaires).
 * 3. Repli : les trois pages codées en dur historiques (contact, publicite,
 *    newsletters), contenu conservé à l'identique.
 * 4. Sinon : 404.
 */

export const dynamic = "force-dynamic";

const CONTACT_EMAIL = "contact@infospro.net";
const ADS_EMAIL = "regie@infospro.net";
const PHONE = "+224 620 00 00 00";

// ─── Slugs spéciaux ────────────────────────────────────────────────────

const SPECIAL_SLUGS = {
  "a-propos": "public.about",
  "notre-equipe": "public.team",
  "nos-partenaires": "public.partners",
} as const;

type SpecialSlug = keyof typeof SPECIAL_SLUGS;

function specialSlug(slug: string): SpecialSlug | null {
  return slug in SPECIAL_SLUGS ? (slug as SpecialSlug) : null;
}

// ─── Contacts branchés sur les réglages (§ contact) ──────────────────────

interface ContactInfo {
  email: string;
  phone: string;
  address: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Décode la valeur brute d'un réglage (sérialisée JSON dans la table
 * `settings`) : tableau, objet, chaîne JSON ou chaîne simple — jamais d'échec.
 */
function decodeSettingValue(raw: string | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    const trimmed = raw.trim();
    return trimmed !== "" ? trimmed : null;
  }
}

/** Premier e-mail valide trouvé (contact.emails = objet {service: email}, tableau ou chaîne). */
function firstEmail(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return EMAIL_RE.test(trimmed) ? trimmed : "";
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstEmail(item);
      if (found) return found;
    }
    return "";
  }
  if (typeof value === "object" && value !== null) {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const found = firstEmail(item);
      if (found) return found;
    }
  }
  return "";
}

/** Premier numéro exploitable (≥7 chiffres) de contact.phones (liste JSON). */
function firstPhone(value: unknown): string {
  const candidates: string[] =
    typeof value === "string"
      ? [value]
      : Array.isArray(value)
        ? value.filter((v): v is string => typeof v === "string")
        : [];
  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (trimmed.replace(/\D/g, "").length >= 7) return trimmed;
  }
  return "";
}

function firstAddress(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Contacts de la page « contact » : réglages admin (contact.emails,
 * contact.phones, contact.address — variantes singulières acceptées) avec
 * repli sur les valeurs historiques codées. Résilient : base indisponible
 * ou valeurs vides/malformées → fallback.
 */
async function loadContactInfo(fallbackAddress: string): Promise<ContactInfo> {
  const fallback: ContactInfo = { email: CONTACT_EMAIL, phone: PHONE, address: fallbackAddress };
  try {
    const rows = await getSettingsByGroup("contact");
    const byKey = new Map(rows.map((r) => [r.key, decodeSettingValue(r.value)]));
    const email = firstEmail(byKey.get("contact.emails") ?? byKey.get("contact.email")) || fallback.email;
    const phone = firstPhone(byKey.get("contact.phones") ?? byKey.get("contact.phone")) || fallback.phone;
    const address = firstAddress(byKey.get("contact.address")) || fallback.address;
    return { email, phone, address };
  } catch {
    return fallback;
  }
}

/** Page publiée correspondant au slug (soft-delete exclue). Null si absente ou base indisponible (repli statique). */
async function findPublishedPage(slug: string) {
  try {
    return await db.page.findFirst({
      where: { slug, is_published: true, deleted_at: null },
      select: { slug: true, title: true, body: true, seo: true },
    });
  } catch {
    return null;
  }
}

/** Équipe publique (membres actifs) — résilient : base indisponible → []. */
async function loadTeam(): Promise<PublicTeamMemberView[]> {
  try {
    return await listActiveTeam();
  } catch {
    return [];
  }
}

/** Partenaires publics (actifs) — résilient : base indisponible → []. */
async function loadPartners(): Promise<PublicPartnerView[]> {
  try {
    return await listActivePartners();
  } catch {
    return [];
  }
}

/** Extrait title/description du champ seo (JSON libre) sans échouer si malformé. */
function parseSeo(seo: string): { title?: string; description?: string } {
  try {
    const parsed: unknown = JSON.parse(seo);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const record = parsed as Record<string, unknown>;
    const title = typeof record.title === "string" && record.title.trim() !== "" ? record.title.trim() : undefined;
    const description =
      typeof record.description === "string" && record.description.trim() !== "" ? record.description.trim() : undefined;
    return { title, description };
  } catch {
    return {};
  }
}

/** Initiales d'affichage (« Mariama Diallo » → « MD ») pour les membres sans photo. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => (word[0] ?? "").toUpperCase())
    .join("");
}

/**
 * Regroupe les partenaires par catégorie (ordre de première apparition) ;
 * les partenaires sans catégorie forment le dernier groupe.
 */
function groupPartnersByCategory(
  partners: PublicPartnerView[],
): { category: string | null; items: PublicPartnerView[] }[] {
  const byCategory = new Map<string | null, PublicPartnerView[]>();
  for (const partner of partners) {
    const current = byCategory.get(partner.category);
    if (current) current.push(partner);
    else byCategory.set(partner.category, [partner]);
  }
  const groups: { category: string | null; items: PublicPartnerView[] }[] = [];
  for (const [category, items] of byCategory) {
    if (category !== null) groups.push({ category, items });
  }
  const uncategorized = byCategory.get(null);
  if (uncategorized && uncategorized.length > 0) groups.push({ category: null, items: uncategorized });
  return groups;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeSlug(rawSlug);
  const page = await findPublishedPage(slug);

  if (page) {
    const seo = parseSeo(page.seo);
    return {
      title: seo.title ?? page.title,
      ...(seo.description ? { description: seo.description } : {}),
    };
  }

  // Slugs spéciaux sans Page admin : métadonnées éditoriales du dictionnaire.
  const special = specialSlug(slug);
  if (special) {
    const { translate } = await getTranslations();
    return {
      title: translate(`${SPECIAL_SLUGS[special]}.metaTitle`),
      description: translate(`${SPECIAL_SLUGS[special]}.metaDescription`),
    };
  }

  // Pages codées en dur et 404 : pas de métadonnées spécifiques (comportement historique).
  return {};
}

export default async function PublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = decodeSlug(rawSlug);
  const { translate } = await getTranslations();

  const page = await findPublishedPage(slug);
  const special = specialSlug(slug);
  // Équipe / partenaires : la Page admin du même slug (optionnelle) fournit
  // le contenu d'accompagnement en blocs, affiché sous l'entête éditoriale.
  const isTeamOrPartners = slug === "notre-equipe" || slug === "nos-partenaires";
  const team = slug === "notre-equipe" ? await loadTeam() : [];
  const partners = slug === "nos-partenaires" ? await loadPartners() : [];

  if (!page && !special && slug !== "contact" && slug !== "publicite" && slug !== "newsletters") notFound();

  // Page contact codée en dur : coordonnées lues dans les réglages admin,
  // repli sur les valeurs historiques si absentes/vides.
  const contactInfo =
    !page && slug === "contact"
      ? await loadContactInfo(translate("public.pages.contact.addressValue"))
      : null;
  const contact: ContactInfo = contactInfo ?? {
    email: CONTACT_EMAIL,
    phone: PHONE,
    address: translate("public.pages.contact.addressValue"),
  };

  // Résolution des références des blocs (médias, articles liés) — même usage
  // que la page article : les blocs portent des identifiants, le rendu
  // regroupe les lignes correspondantes en deux requêtes. Sert le rendu
  // générique ET le contenu d'accompagnement des slugs spéciaux.
  let blocks: Block[] = [];
  const mediaById = new Map<string, MediaLike>();
  const articleTitles = new Map<string, string>();

  if (page) {
    blocks = parseBlocks(page.body);

    const mediaIds = new Set<string>();
    for (const b of blocks) {
      if (b.type === "image") mediaIds.add(b.mediaId);
      if (b.type === "gallery") b.mediaIds.forEach((m) => mediaIds.add(m));
      if (b.type === "video" && b.mediaId) mediaIds.add(b.mediaId);
      if (b.type === "audio" && b.mediaId) mediaIds.add(b.mediaId);
      if (b.type === "beforeafter") {
        mediaIds.add(b.beforeMediaId);
        mediaIds.add(b.afterMediaId);
      }
    }
    const mediaRows =
      mediaIds.size > 0
        ? await db.media.findMany({
            where: { id: { in: [...mediaIds] } },
            select: {
              id: true,
              url: true,
              alt_text: true,
              credit: true,
              caption: true,
              mime_type: true,
              width: true,
              height: true,
              variants: true,
              focal_point: true,
            },
          })
        : [];
    for (const m of mediaRows) mediaById.set(m.id, m);

    const readmoreIds = blocks.filter((b) => b.type === "readmore").flatMap((b) => b.articleIds);
    const relatedRows =
      readmoreIds.length > 0
        ? await db.article.findMany({ where: { id: { in: readmoreIds } }, select: { id: true, title: true } })
        : [];
    for (const r of relatedRows) articleTitles.set(r.id, r.title);
  }

  // Contenu d'accompagnement (blocs) d'un slug spécial, rendu sous l'entête.
  const accompanyingBlocks =
    page && isTeamOrPartners && blocks.length > 0 ? (
      <div className="mt-8">
        <BlockRenderer blocks={blocks} mediaById={mediaById} articleTitles={articleTitles} adsEnabled={true} />
      </div>
    ) : null;

  // Grilles de l'équipe / partenaires : largeur éditoriale plus généreuse
  // que les pages de texte classique.
  const wideSpecial = isTeamOrPartners || (slug === "a-propos" && !page);

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <TopBar />
      <SiteHeader />

      <main id="contenu" className="flex-1 pb-16">
        <div className={`mx-auto px-6 pt-10 ${wideSpecial ? "max-w-5xl" : "max-w-3xl"}`}>
          {/* ── Page admin publiée (rendu générique, sauf équipe/partenaires) ── */}
          {page && !isTeamOrPartners ? (
            <article aria-label={page.title}>
              <header className="border-b-2 border-ink pb-3">
                <h1 className="font-serif text-3xl font-black tracking-tight md:text-4xl">{page.title}</h1>
              </header>

              {blocks.length > 0 && (
                <div className="mt-8">
                  <BlockRenderer blocks={blocks} mediaById={mediaById} articleTitles={articleTitles} adsEnabled={true} />
                </div>
              )}
            </article>
          ) : null}

          {/* ── « À propos » par défaut (aucune Page admin publiée) ─────── */}
          {slug === "a-propos" && !page ? (
            <section aria-label={translate("public.about.title")}>
              <header className="border-b-2 border-ink pb-4">
                <p className="kicker text-brand-red">{translate("public.about.kicker")}</p>
                <h1 className="mt-1 font-serif text-3xl font-black tracking-tight md:text-4xl">
                  {translate("public.about.title")}
                </h1>
              </header>

              <Reveal className="mt-6">
                <p className="text-lg leading-relaxed text-ink">{translate("public.about.intro1")}</p>
                <p className="mt-4 leading-relaxed text-ink-soft">{translate("public.about.intro2")}</p>
              </Reveal>

              <Reveal className="mt-10">
                <h2 className="border-b-2 border-brand-red pb-2 font-serif text-xl font-bold">
                  {translate("public.about.valuesTitle")}
                </h2>
              </Reveal>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {(
                  [
                    { icon: ShieldCheck, title: translate("public.about.value1Title"), text: translate("public.about.value1Text") },
                    { icon: BadgeCheck, title: translate("public.about.value2Title"), text: translate("public.about.value2Text") },
                    { icon: MapPin, title: translate("public.about.value3Title"), text: translate("public.about.value3Text") },
                  ] as const
                ).map((value, i) => (
                  <Reveal key={value.title} delay={i * 100}>
                    <div className="h-full border border-rule bg-paper p-5">
                      <value.icon className="h-6 w-6 text-brand-red" aria-hidden />
                      <h3 className="mt-3 font-serif text-lg font-bold">{value.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{value.text}</p>
                    </div>
                  </Reveal>
                ))}
              </div>

              <Reveal className="mt-8">
                <div className="flex flex-wrap items-center gap-4">
                  <Link
                    href="/pages/contact"
                    className="inline-flex h-11 items-center bg-brand-red px-5 text-sm font-bold text-white transition-colors duration-200 hover:bg-red-deep"
                  >
                    {translate("public.about.cta")}
                  </Link>
                </div>
              </Reveal>
            </section>
          ) : null}

          {/* ── « Notre équipe » : entête + blocs d'accompagnement + grille ── */}
          {slug === "notre-equipe" ? (
            <section aria-label={translate("public.team.title")}>
              <header className="border-b-2 border-ink pb-4">
                <p className="kicker text-brand-red">{translate("public.team.kicker")}</p>
                <h1 className="mt-1 font-serif text-3xl font-black tracking-tight md:text-4xl">
                  {translate("public.team.title")}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-ink-soft">{translate("public.team.subtitle")}</p>
              </header>

              {accompanyingBlocks}

              {team.length === 0 ? (
                <div className="mt-8 border border-dashed border-rule-strong p-10 text-center">
                  <Users className="mx-auto h-8 w-8 text-ink-faint" aria-hidden />
                  <p className="mt-3 font-serif text-lg font-bold text-ink">{translate("public.team.emptyTitle")}</p>
                  <p className="mt-1 text-sm text-ink-soft">{translate("public.team.emptyText")}</p>
                </div>
              ) : (
                <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {team.map((member, i) => (
                    <Reveal key={member.id} delay={Math.min(i * 90, 450)}>
                      <article className="h-full border border-rule bg-paper p-5">
                        {member.photoUrl ? (
                          <img
                            src={member.photoUrl}
                            alt={member.photoAlt ?? member.name}
                            className="aspect-[4/5] w-full rounded-sm object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div
                            className="flex aspect-[4/5] w-full items-center justify-center rounded-sm border border-rule bg-paper-alt font-serif text-4xl font-black text-ink-faint"
                            aria-hidden
                          >
                            {initials(member.name) || "·"}
                          </div>
                        )}
                        <h2 className="mt-4 font-serif text-xl font-bold">{member.name}</h2>
                        <p className="kicker mt-1 text-brand-red">{member.role}</p>
                        {member.bio ? <p className="mt-3 text-sm leading-relaxed text-ink-soft">{member.bio}</p> : null}
                        {member.email ? (
                          <a
                            href={`mailto:${member.email}`}
                            className="mt-3 inline-block break-all text-xs font-semibold text-ink-soft underline-offset-4 transition-colors hover:text-brand-red hover:underline"
                            aria-label={translate("public.team.write", { name: member.name })}
                          >
                            {member.email}
                          </a>
                        ) : null}
                      </article>
                    </Reveal>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {/* ── « Nos partenaires » : catégories + grille de logos ────────── */}
          {slug === "nos-partenaires" ? (
            <section aria-label={translate("public.partners.title")}>
              <header className="border-b-2 border-ink pb-4">
                <p className="kicker text-brand-red">{translate("public.partners.kicker")}</p>
                <h1 className="mt-1 font-serif text-3xl font-black tracking-tight md:text-4xl">
                  {translate("public.partners.title")}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-ink-soft">{translate("public.partners.subtitle")}</p>
              </header>

              {accompanyingBlocks}

              {partners.length === 0 ? (
                <div className="mt-8 border border-dashed border-rule-strong p-10 text-center">
                  <Handshake className="mx-auto h-8 w-8 text-ink-faint" aria-hidden />
                  <p className="mt-3 font-serif text-lg font-bold text-ink">
                    {translate("public.partners.emptyTitle")}
                  </p>
                  <p className="mt-1 text-sm text-ink-soft">{translate("public.partners.emptyText")}</p>
                </div>
              ) : (
                <div className="mt-8 space-y-10">
                  {groupPartnersByCategory(partners).map((group) => (
                    <div key={group.category ?? "__uncategorized__"}>
                      <p className="kicker border-b border-rule pb-2 text-brand-red">
                        {group.category ?? translate("public.partners.otherCategory")}
                      </p>
                      <div className="mt-4 -mx-2">
                        <PartnersMarquee
                          partners={group.items.map((p) => ({
                            id: p.id,
                            name: p.name,
                            url: p.url,
                            logoUrl: p.logoUrl,
                            logoAlt: p.logoAlt,
                          }))}
                          ariaLabel={group.category ?? translate("public.partners.title")}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {/* ── Pages codées en dur historiques (contact, publicite, newsletters) ── */}
          {!page && !special ? (
            <>
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
                      <a href={`mailto:${contact.email}`} className="mt-2 block break-all font-serif font-bold hover:text-brand-red">
                        {contact.email}
                      </a>
                    </div>
                    <div className="border border-rule bg-paper-alt p-5">
                      <p className="kicker text-brand-red">{translate("public.pages.contact.phone")}</p>
                      <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="mt-2 block font-serif font-bold hover:text-brand-red">
                        {contact.phone}
                      </a>
                    </div>
                    <div className="border border-rule bg-paper-alt p-5">
                      <p className="kicker text-brand-red">{translate("public.pages.contact.address")}</p>
                      <p className="mt-2 font-serif font-bold">{contact.address}</p>
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
            </>
          ) : null}

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
