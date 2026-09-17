"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MediaPicker, type MediaItem } from "@/components/admin/MediaPicker";
import { BlockEditor, createEmptyBlock } from "@/components/editor/BlockEditor";
import { computeSeoScore, type SeoScoreResult } from "@/lib/seo/score";
import { plainTextFromBlocks } from "@/lib/blocks";
import { apiFetch, ApiError, errorMessage } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import {
  Eye, Save, Send, CheckCheck, CalendarClock, Undo2, Archive, ArrowLeft, Unlock, Loader2, Zap, FileUp,
} from "lucide-react";
import type { Block } from "@/types/blocks";
import type { ARTICLE_FORMATS } from "@/schemas/article";

/**
 * Éditeur d'article (§11.2 /admin/articles/[id]) :
 * - zone centrale : éditeur TipTap par blocs ;
 * - 6 panneaux latéraux (Publication, Classement, Signature, Médias, SEO,
 *   Relecture) ;
 * - enregistrement automatique toutes les 20 s (§11.1) + avertissement
 *   avant sortie non enregistrée ;
 * - verrou d'édition avec heartbeat 60 s ;
 * - contrôles bloquants côté serveur, score SEO en direct (calcul local) ;
 * - publication d'urgence « Publier en flash ».
 */

// ─── Types d'état ──────────────────────────────────────────────────────

export interface EditorArticle {
  id: string;
  slug: string;
  status: string;
  kicker: string | null;
  title: string;
  short_title: string | null;
  seo_title: string | null;
  lede: string | null;
  body: Block[];
  published_at: string | null;
  scheduled_at: string | null;
  expires_at: string | null;
  visibility: string;
  importance: number;
  is_breaking: boolean;
  is_sponsored: boolean;
  sponsor_name: string | null;
  send_push: boolean;
  include_newsletter: boolean;
  social_text: string | null;
  category_id: string;
  format: string;
  dossier_id: string | null;
  secondary_category_ids: string[];
  tag_ids: string[];
  geo_zone_ids: string[];
  entity_ids: string[];
  authors: { user_id: string; role: string }[];
  source_agency: string | null;
  dateline: string | null;
  cover_media_id: string | null;
  cover_alt: string;
  cover_caption: string;
  cover_credit: string;
  cover_url: string | null;
  social_image_id: string | null;
  slug_frozen: boolean;
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  robots_directives: string;
  focus_keyword: string | null;
  seo_score: number | null;
  sources: { label: string; url: string }[];
  correction_note: string | null;
  word_count: number;
}

export interface EditorLists {
  categories: { id: string; name: string; depth: number }[];
  tags: { id: string; name: string }[];
  dossiers: { id: string; title: string }[];
  geoZones: { id: string; name: string; type: string }[];
  entities: { id: string; name: string }[];
  users: { id: string; display_name: string }[];
  formats: readonly string[];
}

export interface EditorRights {
  editable: boolean;
  canPublish: boolean;
  canDelete: boolean;
  canSchedule: boolean;
  isOwner: boolean;
  canFlash: boolean;
}

const FORMAT_LABELS: Record<string, string> = {
  brief: "Brève", standard: "Standard", analysis: "Analyse", investigation: "Enquête",
  interview: "Interview", opinion: "Opinion", portrait: "Portrait", live: "Direct",
  video: "Vidéo", infographic: "Infographie", factcheck: "Vérification", press_review: "Revue de presse",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon", in_review: "À relire", changes_requested: "Retour de relecture",
  approved: "Approuvé", scheduled: "Programmé", published: "Publié", updated: "Publié (maj)",
  archived: "Archivé", unpublished: "Dépublié",
};

// ─── Composant principal ───────────────────────────────────────────────

export function ArticleEditorClient({
  article: initial,
  lists,
  rights,
}: {
  article: EditorArticle;
  lists: EditorLists;
  rights: EditorRights;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [article, setArticle] = useState<EditorArticle>(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [lockInfo, setLockInfo] = useState<{ mine: boolean; holder: string | null } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lockedBlocks, setLockedBlocks] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("publication");
  const stateRef = useRef(article);
  stateRef.current = article;

  // ── Import Word/Google Docs (§20 Phase 2, tâche 10)
  const docInputRef = useRef<HTMLInputElement>(null);
  const [importingDoc, setImportingDoc] = useState(false);
  const importDocx = useCallback(
    async (file: File) => {
      setImportingDoc(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const { data } = await apiFetch<{ blocks: Block[]; warnings: string[] }>(
          "/api/admin/articles/import",
          { method: "POST", body: form }
        );
        if (data.blocks.length === 0) {
          toast({ title: "Rien à importer", description: "Le document ne contient pas de contenu exploitable." });
          return;
        }
        setArticle((prev) => ({ ...prev, body: [...prev.body, ...data.blocks] }));
        setDirty(true);
        toast({
          title: `${data.blocks.length} bloc(s) importé(s)`,
          description:
            data.warnings.length > 0
              ? `${data.warnings.length} avertissement(s) — vérifiez les blocs marqués et les images importées.`
              : "Document converti proprement en blocs.",
        });
        for (const warning of data.warnings.slice(0, 4)) {
          toast({ title: "Avertissement d'import", description: warning });
        }
      } catch (error) {
        toast({ title: "Import impossible", description: errorMessage(error), variant: "destructive" });
      } finally {
        setImportingDoc(false);
        if (docInputRef.current) docInputRef.current.value = "";
      }
    },
    [toast]
  );

  // ── Suivi de modification
  const markDirty = useCallback(() => setDirty(true), []);

  const patch = useCallback(
    (partial: Partial<EditorArticle>) => {
      setArticle((prev) => ({ ...prev, ...partial }));
      setDirty(true);
    },
    []
  );

  // ── Payload de sauvegarde (ordre contractuel §07.2 assuré côté API)
  const buildPayload = useCallback(
    (a: EditorArticle) => ({
      kicker: a.kicker,
      title: a.title,
      short_title: a.short_title,
      seo_title: a.seo_title,
      lede: a.lede,
      body: a.body,
      publication: {
        scheduled_at: a.scheduled_at,
        expires_at: a.expires_at,
        visibility: a.visibility,
        importance: a.importance,
        is_breaking: a.is_breaking,
        send_push: a.send_push,
        include_newsletter: a.include_newsletter,
        social_text: a.social_text,
      },
      classification: {
        category_id: a.category_id,
        secondary_category_ids: a.secondary_category_ids,
        tag_ids: a.tag_ids,
        dossier_id: a.dossier_id,
        geo_zone_ids: a.geo_zone_ids,
        format: a.format,
        entity_ids: a.entity_ids,
      },
      signature: {
        authors: a.authors,
        source_agency: a.source_agency,
        dateline: a.dateline,
      },
      media: {
        cover_media_id: a.cover_media_id,
        cover_alt: a.cover_alt,
        cover_caption: a.cover_caption,
        cover_credit: a.cover_credit,
        social_image_id: a.social_image_id,
      },
      seo: {
        slug: a.slug,
        meta_title: a.meta_title,
        meta_description: a.meta_description,
        canonical_url: a.canonical_url,
        robots_directives: a.robots_directives,
        focus_keyword: a.focus_keyword,
      },
      review: {
        sources: a.sources,
        correction_note: a.correction_note,
      },
    }),
    []
  );

  // ── Sauvegarde explicite
  const save = useCallback(
    async (opts?: { silent?: boolean }) => {
      setSaving(true);
      try {
        await apiFetch(`/api/admin/articles/${initial.id}`, {
          method: "PUT",
          json: buildPayload(stateRef.current),
        });
        setDirty(false);
        setLastSavedAt(new Date());
        if (!opts?.silent) toast({ title: "Article enregistré" });
      } catch (error) {
        if (!opts?.silent) {
          toast({ title: "Échec de l'enregistrement", description: errorMessage(error), variant: "destructive" });
        }
        if (error instanceof ApiError && error.status === 403) {
          // verrou d'édition ou droit perdu : on fige l'autosave
        }
      } finally {
        setSaving(false);
      }
    },
    [buildPayload, initial.id, toast]
  );

  // ── Autosave 20 s (§11.1)
  useEffect(() => {
    const timer = setInterval(() => {
      if (dirty && rights.editable && lockInfo?.mine !== false && !saving) {
        void save({ silent: true });
      }
    }, 20_000);
    return () => clearInterval(timer);
  }, [dirty, rights.editable, lockInfo, saving, save]);

  // ── Avertissement avant sortie non enregistrée (§11.1)
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // ── Verrou d'édition + heartbeat 60 s
  useEffect(() => {
    if (!rights.editable) return;
    let cancelled = false;
    const beat = async () => {
      try {
        const { data } = await apiFetch<{ acquired: boolean; mine: boolean; holder: string | null }>(
          `/api/admin/articles/${initial.id}/lock`,
          { method: "POST", json: { action: "acquire" } }
        );
        if (!cancelled) setLockInfo({ mine: data.mine, holder: data.holder });
      } catch {
        if (!cancelled) setLockInfo({ mine: false, holder: "inconnu" });
      }
    };
    void beat();
    const timer = setInterval(beat, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      void fetch(`/api/admin/articles/${initial.id}/lock`, { method: "DELETE" }).catch(() => undefined);
    };
  }, [initial.id, rights.editable]);

  // ── Transitions de workflow
  const transition = useCallback(
    async (action: string, extra?: Record<string, unknown>) => {
      try {
        const { data } = await apiFetch<{ status: string }>(`/api/admin/articles/${initial.id}/transition`, {
          method: "POST",
          json: { action, ...extra },
        });
        setArticle((prev) => ({ ...prev, status: data.status }));
        setDirty(false);
        toast({ title: `Statut : ${STATUS_LABELS[data.status] ?? data.status}` });
        router.refresh();
      } catch (error) {
        toast({ title: "Transition refusée", description: errorMessage(error), variant: "destructive" });
      }
    },
    [initial.id, router, toast]
  );

  // ── Score SEO en direct (calcul local, même logique que le serveur)
  const seoLive: SeoScoreResult = useMemo(
    () =>
      computeSeoScore({
        title: article.title,
        lede: article.lede ?? "",
        slug: article.slug,
        metaTitle: article.meta_title ?? "",
        metaDescription: article.meta_description ?? "",
        focusKeyword: article.focus_keyword ?? "",
        plainText: plainTextFromBlocks(article.body),
        wordCount: plainTextFromBlocks(article.body).split(/\s+/).filter(Boolean).length,
        internalLinkCount: countLinks(article.body),
        hasCoverImage: Boolean(article.cover_media_id),
        coverAlt: article.cover_alt,
        coverCredit: article.cover_credit,
        tagsCount: article.tag_ids.length,
      }),
    [article]
  );

  const preview = useCallback(async () => {
    if (dirty) await save({ silent: true });
    window.open(`/admin/preview/${initial.id}`, "_blank", "noopener");
  }, [dirty, save, initial.id]);

  const publishFlash = useCallback(async () => {
    try {
      await apiFetch("/api/admin/flash", {
        method: "POST",
        json: { text: article.title.slice(0, 300), priority: 1, link: null },
      });
      toast({ title: "Flash publié en urgence" });
    } catch (error) {
      toast({ title: "Publication flash refusée", description: errorMessage(error), variant: "destructive" });
    }
  }, [article.title, toast]);

  const isSponsored = article.is_sponsored;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      {/* En-tête éditeur */}
      <div className="flex flex-wrap items-center gap-2 border-b border-rule pb-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/articles")}>
          <ArrowLeft className="size-4" aria-hidden /> Articles
        </Button>
        <Badge variant="outline" className="border-rule text-ink-soft">
          {STATUS_LABELS[article.status] ?? article.status}
        </Badge>
        {lockInfo && !lockInfo.mine && (
          <Badge className="bg-brand-red text-white">
            Verrouillé par {lockInfo.holder}
            {rights.canPublish ? " — les administrateurs peuvent forcer" : ""}
          </Badge>
        )}
        {lockInfo?.mine && <Badge variant="outline" className="border-rule text-ink-faint"><Unlock className="mr-1 size-3" aria-hidden />Verrou détenu</Badge>}
        <span className="ml-auto text-xs text-ink-faint" aria-live="polite">
          {saving ? (
            <span className="inline-flex items-center gap-1"><Loader2 className="size-3 animate-spin" aria-hidden /> Enregistrement…</span>
          ) : dirty ? (
            "Modifications non enregistrées"
          ) : lastSavedAt ? (
            `Enregistré à ${lastSavedAt.toLocaleTimeString("fr-FR")}`
          ) : (
            "À jour"
          )}
        </span>

        <div className="flex w-full flex-wrap gap-2 pt-2 lg:w-auto">
          <Button variant="outline" size="sm" onClick={() => void preview()}>
            <Eye className="mr-1 size-4" aria-hidden /> Prévisualiser
          </Button>
          <Button variant="outline" size="sm" onClick={() => void save()} disabled={!rights.editable || !lockInfo?.mine && lockInfo !== null}>
            <Save className="mr-1 size-4" aria-hidden /> Enregistrer
          </Button>

          {(article.status === "draft" || article.status === "changes_requested") && (
            <Button variant="outline" size="sm" onClick={() => void transition("submit")} disabled={!rights.editable}>
              <Send className="mr-1 size-4" aria-hidden /> Soumettre à relecture
            </Button>
          )}
          {article.status === "in_review" && (
            <>
              {rights.canPublish && (
                <Button size="sm" className="bg-brand-red text-white hover:bg-red-deep" onClick={() => void transition("publish")}>
                  <CheckCheck className="mr-1 size-4" aria-hidden /> Publier
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => void transition("request_changes", { note: "Retour pour corrections." })}>
                <Undo2 className="mr-1 size-4" aria-hidden /> Demander des modifications
              </Button>
              {rights.canSchedule && <ScheduleButton onConfirm={(when) => void transition("schedule", { scheduled_at: when })} />}
            </>
          )}
          {article.status === "scheduled" && (
            <>
              {rights.canPublish && (
                <Button size="sm" className="bg-brand-red text-white hover:bg-red-deep" onClick={() => void transition("publish")}>
                  <CheckCheck className="mr-1 size-4" aria-hidden /> Publier maintenant
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => void transition("restore_draft")}>
                <CalendarClock className="mr-1 size-4" aria-hidden /> Annuler la programmation
              </Button>
            </>
          )}
          {(article.status === "published" || article.status === "updated") && rights.canPublish && (
            <>
              <Button variant="outline" size="sm" onClick={() => void transition("unpublish")}>Dépublier</Button>
              <Button variant="outline" size="sm" onClick={() => void transition("archive")}><Archive className="mr-1 size-4" aria-hidden /> Archiver</Button>
            </>
          )}
          {article.status === "unpublished" && rights.canPublish && (
            <>
              <Button size="sm" className="bg-brand-red text-white hover:bg-red-deep" onClick={() => void transition("publish")}>Republier</Button>
              <Button variant="outline" size="sm" onClick={() => void transition("archive")}>Archiver</Button>
            </>
          )}
          {rights.canFlash && (
            <Button variant="outline" size="sm" onClick={() => void publishFlash()} title="Crée un flash d'urgence priorité 1 (12 h)">
              <Zap className="mr-1 size-4 text-brand-red" aria-hidden /> Publier en flash
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* ── Zone centrale : éditeur par blocs */}
        <div>
          <div className="space-y-3">
            <div>
              <Label htmlFor="kicker" className="kicker">Surtitre (kicker)</Label>
              <Input id="kicker" value={article.kicker ?? ""} onChange={(e) => patch({ kicker: e.target.value })} disabled={!rights.editable} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="title" className="kicker">Titre *</Label>
              <Textarea
                id="title"
                value={article.title}
                onChange={(e) => patch({ title: e.target.value })}
                disabled={!rights.editable}
                rows={2}
                className="mt-1 font-serif text-2xl font-bold leading-snug"
                required
              />
            </div>
            <div>
              <Label htmlFor="lede" className="kicker">Chapô * (≥ 80 caractères)</Label>
              <Textarea id="lede" value={article.lede ?? ""} onChange={(e) => patch({ lede: e.target.value })} disabled={!rights.editable} rows={3} className="mt-1 font-serif text-lg" />
              <p className={`mt-1 text-xs ${(article.lede ?? "").length >= 80 ? "text-success" : "text-ink-faint"}`}>
                {(article.lede ?? "").length} / 80 caractères minimum
              </p>
            </div>
          </div>

          <Separator className="my-5" />

          <div aria-label="Corps de l'article">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-ink-faint">
                Collez depuis Word ou Google Docs — conversion automatique en
                blocs. Ou importez un document .docx.
              </p>
              <input
                ref={docInputRef}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importDocx(file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!rights.editable || importingDoc}
                onClick={() => docInputRef.current?.click()}
              >
                {importingDoc ? (
                  <Loader2 className="mr-1 size-4 animate-spin" aria-hidden />
                ) : (
                  <FileUp className="mr-1 size-4" aria-hidden />
                )}
                {importingDoc ? "Import en cours…" : "Importer un document (.docx)"}
              </Button>
            </div>
            <BlockEditor
              blocks={article.body}
              onChange={(blocks) => patch({ body: blocks })}
              lockedBlocks={lockedBlocks}
              onToggleLock={(blockId) =>
                setLockedBlocks((prev) => {
                  const next = new Set(prev);
                  if (next.has(blockId)) next.delete(blockId);
                  else next.add(blockId);
                  return next;
                })
              }
            />
          </div>
        </div>

        {/* ── Panneaux latéraux (§11.2) */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="border border-rule bg-paper">
          <TabsList className="flex w-full flex-wrap justify-start gap-0 rounded-none border-b border-rule bg-paper-alt p-0">
            {[
              ["publication", "Publi."], ["classement", "Class."], ["signature", "Sign."],
              ["medias", "Médias"], ["seo", "SEO"], ["relecture", "Relec."],
            ].map(([key, label]) => (
              <TabsTrigger
                key={key}
                value={key}
                className="rounded-none border-0 px-3 py-2 text-xs data-[state=active]:border-b-2 data-[state=active]:border-brand-red data-[state=active]:bg-paper"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="publication" className="space-y-4 p-4">
            <PanelRow label="Visibilité">
              <Select value={article.visibility} onValueChange={(v) => patch({ visibility: v })} disabled={!rights.editable}>
                <SelectTrigger aria-label="Visibilité"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="unlisted">Non répertorié</SelectItem>
                  <SelectItem value="restricted">Restreint</SelectItem>
                </SelectContent>
              </Select>
            </PanelRow>
            <PanelRow label="Importance (1 = majeure)">
              <Input type="number" min={1} max={5} value={article.importance} onChange={(e) => patch({ importance: Number(e.target.value) })} disabled={!rights.editable} aria-label="Importance de 1 à 5" />
            </PanelRow>
            <PanelRow label="Programmation">
              <Input
                type="datetime-local"
                value={toLocalInput(article.scheduled_at)}
                onChange={(e) => patch({ scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                disabled={!rights.editable}
                aria-label="Date et heure de programmation"
              />
            </PanelRow>
            <PanelRow label="Expiration">
              <Input
                type="datetime-local"
                value={toLocalInput(article.expires_at)}
                onChange={(e) => patch({ expires_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                disabled={!rights.editable}
                aria-label="Date d'expiration"
              />
            </PanelRow>
            <ToggleRow label="Article majeur (mise en avant)" checked={article.is_breaking} onChange={(v) => patch({ is_breaking: v })} disabled={!rights.editable} />
            <ToggleRow label="Envoi push à la publication" checked={article.send_push} onChange={(v) => patch({ send_push: v })} disabled={!rights.editable} />
            <ToggleRow label="Inclure dans la newsletter" checked={article.include_newsletter} onChange={(v) => patch({ include_newsletter: v })} disabled={!rights.editable} />
            <ToggleRow label="Article sponsorisé" checked={isSponsored} onChange={(v) => patch({ is_sponsored: v, sponsor_name: v ? article.sponsor_name : null })} disabled={!rights.editable} />
            {isSponsored && (
              <PanelRow label="Nom du sponsor *">
                <Input value={article.sponsor_name ?? ""} onChange={(e) => patch({ sponsor_name: e.target.value })} disabled={!rights.editable} />
              </PanelRow>
            )}
            <PanelRow label="Texte social (réseaux)">
              <Textarea value={article.social_text ?? ""} onChange={(e) => patch({ social_text: e.target.value })} rows={2} disabled={!rights.editable} aria-label="Texte pour les réseaux sociaux" />
            </PanelRow>
          </TabsContent>

          <TabsContent value="classement" className="space-y-4 p-4">
            <PanelRow label="Rubrique principale *">
              <CategorySelect
                categories={lists.categories}
                value={article.category_id}
                onChange={(v) => patch({ category_id: v })}
                disabled={!rights.editable}
              />
            </PanelRow>
            <PanelRow label="Format éditorial">
              <Select value={article.format} onValueChange={(v) => patch({ format: v })} disabled={!rights.editable}>
                <SelectTrigger aria-label="Format"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {lists.formats.map((f) => (
                    <SelectItem key={f} value={f}>{FORMAT_LABELS[f] ?? f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PanelRow>
            <PanelRow label="Rubriques secondaires">
              <MultiCheckbox
                items={lists.categories.map((c) => ({ id: c.id, label: "—".repeat(c.depth) + " " + c.name }))}
                selected={article.secondary_category_ids}
                onChange={(ids) => patch({ secondary_category_ids: ids })}
                disabled={!rights.editable}
              />
            </PanelRow>
            <PanelRow label="Mots-clés * (au moins 1)">
              <TagPicker
                tags={lists.tags}
                selected={article.tag_ids}
                onChange={(ids) => patch({ tag_ids: ids })}
                onCreated={(tag) => lists.tags.push(tag)}
                disabled={!rights.editable}
              />
            </PanelRow>
            <PanelRow label="Dossier">
              <Select value={article.dossier_id ?? "none"} onValueChange={(v) => patch({ dossier_id: v === "none" ? null : v })} disabled={!rights.editable}>
                <SelectTrigger aria-label="Dossier"><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {lists.dossiers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PanelRow>
            <PanelRow label="Zones géographiques">
              <MultiCheckbox items={lists.geoZones.map((g) => ({ id: g.id, label: `${g.name} (${g.type})` }))} selected={article.geo_zone_ids} onChange={(ids) => patch({ geo_zone_ids: ids })} disabled={!rights.editable} maxHeight="max-h-40" />
            </PanelRow>
            <PanelRow label="Entités citées">
              <MultiCheckbox items={lists.entities.map((e) => ({ id: e.id, label: e.name }))} selected={article.entity_ids} onChange={(ids) => patch({ entity_ids: ids })} disabled={!rights.editable} maxHeight="max-h-40" />
            </PanelRow>
          </TabsContent>

          <TabsContent value="signature" className="space-y-4 p-4">
            <PanelRow label="Auteurs et rôles *">
              <AuthorEditor
                users={lists.users}
                authors={article.authors}
                onChange={(authors) => patch({ authors })}
                disabled={!rights.editable}
              />
            </PanelRow>
            <PanelRow label="Agence source">
              <Input value={article.source_agency ?? ""} onChange={(e) => patch({ source_agency: e.target.value })} disabled={!rights.editable} placeholder="AFP, Reuters…" aria-label="Agence source" />
            </PanelRow>
            <PanelRow label="Dateline">
              <Input value={article.dateline ?? ""} onChange={(e) => patch({ dateline: e.target.value })} disabled={!rights.editable} placeholder="Conakry, envoyé spécial" aria-label="Dateline" />
            </PanelRow>
          </TabsContent>

          <TabsContent value="medias" className="space-y-4 p-4">
            <div>
              <Label className="kicker">Image principale *</Label>
              {article.cover_url ? (
                <div className="mt-2">
                  <img src={article.cover_url} alt={article.cover_alt} className="max-h-48 w-full rounded-sm object-cover" />
                  <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setPickerOpen(true)} disabled={!rights.editable}>Changer</Button>
                </div>
              ) : (
                <Button type="button" variant="outline" className="mt-2 w-full" onClick={() => setPickerOpen(true)} disabled={!rights.editable}>
                  Choisir une image principale
                </Button>
              )}
            </div>
            <PanelRow label="Texte alternatif * (accessibilité)">
              <Input value={article.cover_alt} onChange={(e) => patch({ cover_alt: e.target.value })} disabled={!rights.editable} aria-label="Texte alternatif de l'image principale" />
            </PanelRow>
            <PanelRow label="Crédit *">
              <Input value={article.cover_credit} onChange={(e) => patch({ cover_credit: e.target.value })} disabled={!rights.editable} placeholder="Nom du photographe / agence" aria-label="Crédit photo" />
            </PanelRow>
            <PanelRow label="Légende">
              <Textarea value={article.cover_caption} onChange={(e) => patch({ cover_caption: e.target.value })} rows={2} disabled={!rights.editable} aria-label="Légende de l'image principale" />
            </PanelRow>
            <p className="text-xs text-ink-faint">
              Recadrages 16:9 / 4:3 / 1:1 / 21:9 et point focal : réglables dans la médiathèque (/admin/medias).
            </p>
            <Separator />
            <PanelRow label="Image sociale spécifique">
              <SocialImagePicker
                value={article.social_image_id}
                onChange={(id) => patch({ social_image_id: id })}
                disabled={!rights.editable}
              />
            </PanelRow>
          </TabsContent>

          <TabsContent value="seo" className="space-y-4 p-4">
            <div className="rounded-sm border border-rule bg-paper-alt p-3">
              <div className="flex items-center justify-between">
                <span className="kicker">Score SEO en direct</span>
                <span className={`text-2xl font-bold tabular-nums ${seoLive.score >= 60 ? "text-success" : "text-brand-red"}`}>
                  {seoLive.score}
                </span>
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                {seoLive.checks.slice(0, 6).map((c) => (
                  <li key={c.id} className="flex items-center gap-1.5">
                    <span aria-hidden className={c.status === "pass" ? "text-success" : c.status === "warn" ? "text-amber-600" : "text-brand-red"}>●</span>
                    <span className="text-ink-soft">{c.label}</span>
                  </li>
                ))}
              </ul>
            </div>
            <PanelRow label="Slug (URL)">
              <Input value={article.slug} onChange={(e) => patch({ slug: e.target.value })} disabled={!rights.editable || article.slug_frozen} aria-label="Slug de l'article" />
              {article.slug_frozen && (
                <p className="mt-1 text-xs text-ink-faint">
                  Gelé après publication — toute modification crée automatiquement une redirection 301.
                </p>
              )}
            </PanelRow>
            <PanelRow label="Méta-titre">
              <Input value={article.meta_title ?? ""} onChange={(e) => patch({ meta_title: e.target.value })} disabled={!rights.editable} maxLength={200} aria-label="Méta-titre" />
            </PanelRow>
            <PanelRow label="Méta-description">
              <Textarea value={article.meta_description ?? ""} onChange={(e) => patch({ meta_description: e.target.value })} rows={2} maxLength={400} disabled={!rights.editable} aria-label="Méta-description" />
              <p className="mt-1 text-xs text-ink-faint">{(article.meta_description ?? "").length} / 160 recommandé</p>
            </PanelRow>
            <PanelRow label="URL canonique">
              <Input value={article.canonical_url ?? ""} onChange={(e) => patch({ canonical_url: e.target.value })} disabled={!rights.editable} aria-label="URL canonique" />
            </PanelRow>
            <PanelRow label="Robots">
              <Input value={article.robots_directives} onChange={(e) => patch({ robots_directives: e.target.value })} disabled={!rights.editable} aria-label="Directives robots" />
            </PanelRow>
            <PanelRow label="Mot-clé cible">
              <Input value={article.focus_keyword ?? ""} onChange={(e) => patch({ focus_keyword: e.target.value })} disabled={!rights.editable} aria-label="Mot-clé cible SEO" />
            </PanelRow>
          </TabsContent>

          <TabsContent value="relecture" className="space-y-4 p-4">
            <PanelRow label="Note de correction">
              <Textarea value={article.correction_note ?? ""} onChange={(e) => patch({ correction_note: e.target.value })} rows={3} disabled={!rights.editable} aria-label="Note de correction" />
            </PanelRow>
            <SourcesEditor sources={article.sources} onChange={(sources) => patch({ sources })} disabled={!rights.editable} />
            <Separator />
            <VersionHistory articleId={initial.id} onRestored={(blocks, title, lede) => {
              setArticle((prev) => ({ ...prev, body: blocks, title, lede }));
              setDirty(true);
              toast({ title: "Version restaurée — pensez à enregistrer" });
            }} />
          </TabsContent>
        </Tabs>
      </div>

      <MediaPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(media: MediaItem) => patch({ cover_media_id: media.id, cover_url: media.url })}
        filterType="image"
        title="Image principale"
      />
    </div>
  );
}

// ─── Sous-composants ───────────────────────────────────────────────────

function PanelRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs font-semibold text-ink-soft">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-xs font-semibold text-ink-soft">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label} />
    </div>
  );
}

function CategorySelect({
  categories, value, onChange, disabled,
}: {
  categories: { id: string; name: string; depth: number }[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger aria-label="Rubrique principale"><SelectValue placeholder="Choisir…" /></SelectTrigger>
      <SelectContent className="max-h-72">
        {categories.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {"—".repeat(c.depth)} {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MultiCheckbox({
  items, selected, onChange, disabled, maxHeight = "max-h-48",
}: {
  items: { id: string; label: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  maxHeight?: string;
}) {
  return (
    <div className={`${maxHeight} overflow-y-auto rounded-sm border border-rule p-2`} style={{ scrollbarWidth: "thin" }}>
      {items.map((item) => (
        <label key={item.id} className="flex items-center gap-2 rounded-sm px-1 py-1 text-sm hover:bg-paper-alt">
          <input
            type="checkbox"
            checked={selected.includes(item.id)}
            disabled={disabled}
            onChange={(e) =>
              onChange(e.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))
            }
            className="accent-[#C8102E]"
          />
          <span className="truncate">{item.label}</span>
        </label>
      ))}
    </div>
  );
}

function TagPicker({
  tags, selected, onChange, onCreated, disabled,
}: {
  tags: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onCreated: (tag: { id: string; name: string }) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const filtered = tags.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()) && !selected.includes(t.id));

  const createTag = async () => {
    if (!query.trim()) return;
    try {
      const { data } = await apiFetch<{ id: string; name: string }>("/api/admin/taxonomies/tags", {
        method: "POST",
        json: { name: query.trim() },
      });
      onCreated(data);
      onChange([...selected, data.id]);
      setQuery("");
    } catch (error) {
      // si le slug existe déjà, on retente la simple association
      const existing = tags.find((t) => t.name.toLowerCase() === query.trim().toLowerCase());
      if (existing) {
        onChange([...selected, existing.id]);
        setQuery("");
      } else {
        throw error;
      }
    }
  };

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((id) => {
            const tag = tags.find((t) => t.id === id);
            return (
              <Badge key={id} variant="outline" className="border-rule text-ink-soft">
                {tag?.name ?? id}
                {!disabled && (
                  <button type="button" onClick={() => onChange(selected.filter((s) => s !== id))} aria-label={`Retirer ${tag?.name}`} className="ml-1 text-ink-faint hover:text-brand-red">✕</button>
                )}
              </Badge>
            );
          })}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrer ou créer un mot-clé…"
          disabled={disabled}
          aria-label="Recherche de mot-clé"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void createTag().catch((err) => void err);
            }
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => void createTag().catch(() => undefined)} disabled={disabled || !query.trim()}>
          + Créer
        </Button>
      </div>
      {query && filtered.length > 0 && (
        <ul className="max-h-32 overflow-y-auto rounded-sm border border-rule" style={{ scrollbarWidth: "thin" }}>
          {filtered.slice(0, 8).map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-paper-alt"
                onClick={() => {
                  onChange([...selected, t.id]);
                  setQuery("");
                }}
              >
                {t.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AuthorEditor({
  users, authors, onChange, disabled,
}: {
  users: { id: string; display_name: string }[];
  authors: { user_id: string; role: string }[];
  onChange: (authors: { user_id: string; role: string }[]) => void;
  disabled?: boolean;
}) {
  const [userId, setUserId] = useState("none");
  const [role, setRole] = useState("author");
  return (
    <div className="space-y-2">
      {authors.map((a, i) => {
        const user = users.find((u) => u.id === a.user_id);
        return (
          <div key={`${a.user_id}-${a.role}-${i}`} className="flex items-center gap-2 text-sm">
            <span className="flex-1 truncate">{user?.display_name ?? a.user_id}</span>
            <Select value={a.role} onValueChange={(v) => { const next = [...authors]; next[i] = { ...a, role: v }; onChange(next); }} disabled={disabled}>
              <SelectTrigger className="w-32" aria-label="Rôle de signature"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="author">Auteur</SelectItem>
                <SelectItem value="coauthor">Co-auteur</SelectItem>
                <SelectItem value="photographer">Photographe</SelectItem>
                <SelectItem value="translator">Traducteur</SelectItem>
                <SelectItem value="editor">Éditeur</SelectItem>
              </SelectContent>
            </Select>
            <button type="button" onClick={() => onChange(authors.filter((_, j) => j !== i))} aria-label="Retirer l'auteur" className="text-ink-faint hover:text-brand-red">✕</button>
          </div>
        );
      })}
      <div className="flex gap-2">
        <Select value={userId} onValueChange={setUserId} disabled={disabled}>
          <SelectTrigger className="flex-1" aria-label="Ajouter un signataire"><SelectValue placeholder="Personne…" /></SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="none">Choisir…</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.display_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={role} onValueChange={setRole} disabled={disabled}>
          <SelectTrigger className="w-32" aria-label="Rôle du nouveau signataire"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="author">Auteur</SelectItem>
            <SelectItem value="coauthor">Co-auteur</SelectItem>
            <SelectItem value="photographer">Photographe</SelectItem>
            <SelectItem value="translator">Traducteur</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || userId === "none"}
          onClick={() => {
            if (userId === "none") return;
            if (!authors.some((a) => a.user_id === userId && a.role === role)) {
              onChange([...authors, { user_id: userId, role }]);
            }
            setUserId("none");
          }}
        >
          + Ajouter
        </Button>
      </div>
    </div>
  );
}

function SocialImagePicker({ value, onChange, disabled }: { value: string | null; onChange: (id: string | null) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} disabled={disabled}>
        {value ? "Changer" : "Choisir"}
      </Button>
      {value && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} disabled={disabled}>Retirer</Button>
      )}
      <MediaPicker open={open} onOpenChange={setOpen} onSelect={(m) => onChange(m.id)} filterType="image" title="Image sociale (Open Graph)" />
    </div>
  );
}

function SourcesEditor({ sources, onChange, disabled }: { sources: { label: string; url: string }[]; onChange: (s: { label: string; url: string }[]) => void; disabled?: boolean }) {
  return (
    <div>
      <Label className="kicker">Sources</Label>
      <div className="mt-2 space-y-2">
        {sources.map((s, i) => (
          <div key={i} className="flex gap-2">
            <Input value={s.label} onChange={(e) => { const next = [...sources]; next[i] = { ...s, label: e.target.value }; onChange(next); }} placeholder="Libellé" aria-label={`Libellé source ${i + 1}`} disabled={disabled} />
            <Input value={s.url} onChange={(e) => { const next = [...sources]; next[i] = { ...s, url: e.target.value }; onChange(next); }} placeholder="https://…" aria-label={`URL source ${i + 1}`} disabled={disabled} />
            <button type="button" onClick={() => onChange(sources.filter((_, j) => j !== i))} aria-label="Retirer la source" className="text-ink-faint hover:text-brand-red">✕</button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...sources, { label: "", url: "" }])} disabled={disabled}>+ Source</Button>
      </div>
    </div>
  );
}

function VersionHistory({ articleId, onRestored }: { articleId: string; onRestored: (blocks: Block[], title: string, lede: string | null) => void }) {
  const [versions, setVersions] = useState<{ id: string; version: number; change_note: string | null; created_at: string; createdBy?: { display_name: string } }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await apiFetch<typeof versions>(`/api/admin/articles/${articleId}/versions`);
        setVersions(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [articleId]);

  const restore = async (version: number) => {
    try {
      await apiFetch(`/api/admin/articles/${articleId}/versions`, { method: "POST", json: { version } });
      const { data: full } = await apiFetch<{ article: { body: string; title: string; lede: string | null } }>(
        `/api/admin/articles/${articleId}`
      );
      const blocks = JSON.parse(full.article.body) as Block[];
      onRestored(blocks, full.article.title, full.article.lede);
    } catch (error) {
      void error;
    }
  };

  if (loading) return <p className="text-xs text-ink-faint">Chargement de l'historique…</p>;
  if (versions.length === 0) return <p className="text-xs text-ink-faint">Aucune version enregistrée — les instantanés sont créés à la soumission, à la publication et à chaque enregistrement explicite.</p>;

  return (
    <div>
      <Label className="kicker">Historique des versions</Label>
      <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-sm" style={{ scrollbarWidth: "thin" }}>
        {versions.map((v) => (
          <li key={v.id} className="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 hover:bg-paper-alt">
            <span>
              <strong>v{v.version}</strong> — {v.change_note ?? "modification"}
              <span className="ml-2 text-xs text-ink-faint">
                {new Date(v.created_at).toLocaleString("fr-FR")}
                {v.createdBy ? ` · ${v.createdBy.display_name}` : ""}
              </span>
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => void restore(v.version)}>Restaurer</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScheduleButton({ onConfirm }: { onConfirm: (whenIso: string) => void }) {
  const [when, setWhen] = useState("");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CalendarClock className="mr-1 size-4" aria-hidden /> Programmer
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" role="dialog" aria-modal="true" aria-label="Programmation de la publication">
          <div className="w-full max-w-sm border border-rule bg-paper p-5">
            <p className="font-serif text-lg font-bold">Programmer la publication</p>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="mt-3" aria-label="Date de publication" />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
              <Button
                size="sm"
                className="bg-brand-red text-white hover:bg-red-deep"
                disabled={!when}
                onClick={() => {
                  setOpen(false);
                  onConfirm(new Date(when).toISOString());
                }}
              >
                Programmer
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function countLinks(blocks: Block[]): number {
  let count = 0;
  for (const b of blocks) {
    if (b.type === "paragraph") count += b.text.filter((f) => f.link && !f.link.external).length;
    if (b.type === "readmore") count += b.articleIds.length;
  }
  return count;
}

export { createEmptyBlock, FORMAT_LABELS, STATUS_LABELS };
