import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { BlockRenderer, type MediaLike } from "@/components/blocks/BlockRenderer";
import { parseBlocks, type Block } from "@/types/blocks";
import { getTranslations } from "@/lib/i18n";
import { getSettingsByGroup } from "@/server/services/settings";
import { TopBar, SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { NewsletterBlock } from "@/components/public/newsletter-block";
import { decodeSlug } from "@/lib/slug-decode";

/**
 * Pages publiques /pages/[slug].
 * 1. Page publiée en base (table `pages`, créée dans /admin/pages) : rendu
 *    éditorial — titre + blocs du body (même format §06.4 que les articles,
 *    mêmes props BlockRenderer).
 * 2. Repli : les trois pages codées en dur historiques (contact, publicite,
 *    newsletters), contenu conservé à l'identique.
 * 3. Sinon : 404.
 */

export const dynamic = "force-dynamic";

const CONTACT_EMAIL = "contact@infospro.net";
const ADS_EMAIL = "regie@infospro.net";
const PHONE = "+224 620 00 00 00";

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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeSlug(rawSlug);
  const page = await findPublishedPage(slug);
  // Pages codées en dur et 404 : pas de métadonnées spécifiques (comportement historique).
  if (!page) return {};

  const seo = parseSeo(page.seo);
  return {
    title: seo.title ?? page.title,
    ...(seo.description ? { description: seo.description } : {}),
  };
}

export default async function PublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = decodeSlug(rawSlug);
  const { translate } = await getTranslations();

  const page = await findPublishedPage(slug);

  if (!page && slug !== "contact" && slug !== "publicite" && slug !== "newsletters") notFound();

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
  // regroupe les lignes correspondantes en deux requêtes.
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

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <TopBar />
      <SiteHeader />

      <main id="contenu" className="flex-1 pb-16">
        <div className="mx-auto max-w-3xl px-6 pt-10">
          {page ? (
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
          ) : (
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
