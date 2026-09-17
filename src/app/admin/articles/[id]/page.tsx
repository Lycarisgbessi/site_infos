import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { parseBlocks } from "@/types/blocks";
import { parseJsonArrayObjects } from "@/lib/json";
import { getArticleForEdit } from "@/server/services/articles";
import { ARTICLE_FORMATS } from "@/schemas/article";
import { ArticleEditorClient, type EditorArticle } from "@/components/admin/article/ArticleEditorClient";

export const dynamic = "force-dynamic";

/**
 * Éditeur d'article — route /admin/articles/[id] (§11.2).
 * Serveur : garde de session, chargement article + listes de référence,
 * calcul des droits ; le client gère l'édition, l'autosave et le verrou.
 */

export default async function ArticleEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;

  let data: Awaited<ReturnType<typeof getArticleForEdit>>;
  try {
    data = await getArticleForEdit(session, id);
  } catch {
    notFound();
  }

  const { article, rights } = data;

  const [categories, tags, dossiers, geoZones, entities, users] = await Promise.all([
    db.category.findMany({
      where: { deleted_at: null },
      orderBy: [{ parent_id: "asc" }, { position: "asc" }],
      select: { id: true, name: true, parent_id: true, depth: true },
    }),
    db.tag.findMany({ where: { deleted_at: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.dossier.findMany({ where: { deleted_at: null }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
    db.geoZone.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }], select: { id: true, name: true, type: true } }),
    db.entity.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true }, take: 300 }),
    db.user.findMany({
      where: { deleted_at: null, status: { in: ["active", "invited"] } },
      orderBy: { display_name: "asc" },
      select: { id: true, display_name: true },
    }),
  ]);

  // Ordre hiérarchique correct de l'arbre de rubriques (profondeur puis nom)
  const orderedCategories = [...categories].sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.name.localeCompare(b.name, "fr");
  });

  const isSource = (v: unknown): v is { label: string; url: string } =>
    typeof v === "object" && v !== null && "label" in v && "url" in v;

  const editorArticle: EditorArticle = {
    id: article.id,
    slug: article.slug,
    status: article.status,
    kicker: article.kicker,
    title: article.title,
    short_title: article.short_title,
    seo_title: article.seo_title,
    lede: article.lede,
    body: parseBlocks(article.body),
    published_at: article.published_at?.toISOString() ?? null,
    scheduled_at: article.scheduled_at?.toISOString() ?? null,
    expires_at: article.expires_at?.toISOString() ?? null,
    visibility: article.visibility,
    importance: article.importance,
    is_breaking: article.is_breaking,
    is_sponsored: article.is_sponsored,
    sponsor_name: article.sponsor_name,
    send_push: article.send_push,
    include_newsletter: article.include_newsletter,
    social_text: article.social_text,
    category_id: article.category_id,
    format: article.format,
    dossier_id: article.dossier_id,
    secondary_category_ids: article.secondaryCats.map((c) => c.category_id),
    tag_ids: article.tags.map((t) => t.tag_id),
    geo_zone_ids: article.geoZones.map((g) => g.geo_zone_id),
    entity_ids: article.entities.map((e) => e.entity_id),
    authors: article.authors.map((a) => ({ user_id: a.user_id, role: a.role })),
    source_agency: article.source_agency,
    dateline: article.dateline,
    cover_media_id: article.coverMedia?.id ?? null,
    cover_alt: article.coverMedia?.alt_text ?? "",
    cover_caption: article.coverMedia?.caption ?? "",
    cover_credit: article.coverMedia?.credit ?? "",
    cover_url: article.coverMedia?.url ?? null,
    social_image_id: article.socialImage?.id ?? null,
    slug_frozen: article.status === "published" || article.status === "updated" || article.status === "archived",
    meta_title: article.meta_title,
    meta_description: article.meta_description,
    canonical_url: article.canonical_url,
    robots_directives: article.robots_directives,
    focus_keyword: article.focus_keyword,
    seo_score: article.seo_score,
    sources: parseJsonArrayObjects(article.sources, isSource),
    correction_note: article.correction_note,
    word_count: article.word_count,
  };

  const canFlash = await hasPermission(session.user, "flash.manage");

  return (
    <ArticleEditorClient
      article={editorArticle}
      lists={{
        categories: orderedCategories.map((c) => ({ id: c.id, name: c.name, depth: c.depth })),
        tags: tags.map((t) => ({ id: t.id, name: t.name })),
        dossiers: dossiers.map((d) => ({ id: d.id, title: d.title })),
        geoZones: geoZones.map((g) => ({ id: g.id, name: g.name, type: g.type })),
        entities: entities.map((e) => ({ id: e.id, name: e.name })),
        users: users.map((u) => ({ id: u.id, display_name: u.display_name })),
        formats: ARTICLE_FORMATS,
      }}
      rights={{ ...rights, canFlash }}
    />
  );
}
