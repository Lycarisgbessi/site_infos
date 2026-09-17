"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { apiFetch, errorMessage } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  BookmarkPlus,
  Copy,
  Eye,
  GripVertical,
  LayoutTemplate,
  Loader2,
  Pencil,
  RotateCcw,
  Save,
  Search,
  X,
} from "lucide-react";

/**
 * Composeur de la page d'accueil (§11.2 /admin/homepage) : liste verticale
 * des blocs réordonnçable au glisser-déposer (dnd-kit), édition locale de la
 * configuration (source, variante, fenêtre de publication…), enregistrement
 * global, configurations nommées (layouts) et prévisualisation structurelle.
 * Le rendu visuel de l'accueil est livré en phase 4.
 */

interface HomepageBlock {
  id: string;
  code: string;
  type: string;
  variant: string | null;
  title: string | null;
  subtitle: string | null;
  source_type: string | null;
  source_id: string | null;
  manual_article_ids: string;
  item_count: number;
  settings: string;
  position: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  locale: string;
}

interface HomepageLayoutItem {
  id: string;
  name: string;
  created_at: string;
  is_current: boolean;
}

interface CategoryRow {
  id: string;
  name: string;
  depth: number;
}

interface DossierRow {
  id: string;
  title: string;
}

interface TagRow {
  id: string;
  name: string;
}

interface CandidateArticle {
  id: string;
  title: string;
  category: { name: string } | null;
}

interface BlockDraft {
  id: string;
  title: string;
  subtitle: string;
  variant: string;
  source_type: string; // "" = aucune source
  source_id: string;
  manualIds: string[];
  item_count: number;
  starts_at: string | null;
  ends_at: string | null;
}

interface BlockPayload {
  id: string;
  title: string | null;
  subtitle: string | null;
  variant: string | null;
  source_type: string | null;
  source_id: string | null;
  manual_article_ids: string[];
  item_count: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

const SOURCE_TYPES: { value: string; label: string }[] = [
  { value: "category", label: "Rubrique" },
  { value: "dossier", label: "Dossier" },
  { value: "tag", label: "Mot-clé" },
  { value: "manual", label: "Sélection manuelle" },
  { value: "auto", label: "Automatique" },
  { value: "format", label: "Format éditorial" },
];

const TYPE_LABELS: Record<string, string> = {
  alert: "Alerte",
  flash: "Flash",
  lead: "À la une",
  live: "Direct",
  latest: "Dernières nouvelles",
  section: "Rubrique",
  video: "Vidéo",
  newsletter: "Newsletter",
  weather: "Météo",
  dossier: "Dossier",
  world: "International",
  opinion: "Opinion",
  ad: "Publicité",
  most_read: "Les plus lus",
  custom_html: "HTML libre",
};

const FORMAT_LABELS: Record<string, string> = {
  brief: "Brève",
  standard: "Standard",
  analysis: "Analyse",
  investigation: "Enquête",
  interview: "Interview",
  opinion: "Opinion",
  portrait: "Portrait",
  live: "Direct",
  video: "Vidéo",
  infographic: "Infographie",
  factcheck: "Vérification",
  press_review: "Revue de presse",
};

function parseManualIds(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isoOrNull(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

export function HomepageClient() {
  const { toast } = useToast();

  const [blocks, setBlocks] = useState<HomepageBlock[]>([]);
  const [layouts, setLayouts] = useState<HomepageLayoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  // Référentiels pour les libellés de source et l'éditeur
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [dossiers, setDossiers] = useState<DossierRow[]>([]);
  const [tags, setTags] = useState<TagRow[]>([]);

  // Éditeur de bloc (brouillon local)
  const [draft, setDraft] = useState<BlockDraft | null>(null);

  // Candidats pour la sélection manuelle
  const [manualQ, setManualQ] = useState("");
  const [manualCandidates, setManualCandidates] = useState<CandidateArticle[]>([]);
  const [manualLoading, setManualLoading] = useState(false);

  // Configurations nommées
  const [layoutDialogOpen, setLayoutDialogOpen] = useState(false);
  const [layoutName, setLayoutName] = useState("");
  const [savingLayout, setSavingLayout] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiFetch<{ blocks: HomepageBlock[]; layouts: HomepageLayoutItem[] }>("/api/admin/homepage");
      setBlocks(data.blocks);
      setLayouts(data.layouts);
      setDirty(false);
    } catch (error) {
      toast({ title: "Chargement impossible", description: errorMessage(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const [cats, dos, tgs] = await Promise.all([
          apiFetch<CategoryRow[]>("/api/admin/taxonomies/categories"),
          apiFetch<DossierRow[]>("/api/admin/taxonomies/annexes?kind=dossiers"),
          apiFetch<TagRow[]>("/api/admin/taxonomies/tags"),
        ]);
        setCategories(cats.data);
        setDossiers(dos.data);
        setTags(tgs.data);
      } catch {
        // Référentiels indisponibles : les libellés afficheront un repli
      }
    })();
  }, []);

  // Recherche des candidats pour la sélection manuelle (anti-rebond)
  const draftId = draft?.id ?? null;
  const draftIsManual = draft?.source_type === "manual";
  useEffect(() => {
    if (!draftId || !draftIsManual) return;
    let cancelled = false;
    const timer = setTimeout(
      async () => {
        setManualLoading(true);
        try {
          const params = new URLSearchParams({ candidates: "1" });
          if (manualQ.trim()) params.set("q", manualQ.trim());
          const { data } = await apiFetch<CandidateArticle[]>(`/api/admin/une?${params}`);
          if (!cancelled) setManualCandidates(data);
        } catch (error) {
          if (!cancelled) toast({ title: "Recherche impossible", description: errorMessage(error), variant: "destructive" });
        } finally {
          if (!cancelled) setManualLoading(false);
        }
      },
      manualQ.trim() === "" ? 0 : 300
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draftId, draftIsManual, manualQ, toast]);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name] as const)), [categories]);
  const dossierMap = useMemo(() => new Map(dossiers.map((d) => [d.id, d.title] as const)), [dossiers]);
  const tagMap = useMemo(() => new Map(tags.map((t) => [t.id, t.name] as const)), [tags]);

  const sourceLabelFor = useCallback(
    (block: HomepageBlock): string => {
      switch (block.source_type) {
        case "category":
          return `Rubrique : ${block.source_id ? catMap.get(block.source_id) ?? "rubrique inconnue" : "non définie"}`;
        case "dossier":
          return `Dossier : ${block.source_id ? dossierMap.get(block.source_id) ?? "dossier inconnu" : "non défini"}`;
        case "tag":
          return `Mot-clé : ${block.source_id ? tagMap.get(block.source_id) ?? "mot-clé inconnu" : "non défini"}`;
        case "manual":
          return `Sélection manuelle (${parseManualIds(block.manual_article_ids).length} article${parseManualIds(block.manual_article_ids).length > 1 ? "s" : ""})`;
        case "auto":
          return "Source automatique";
        case "format":
          return `Format : ${block.source_id ? FORMAT_LABELS[block.source_id] ?? block.source_id : "non défini"}`;
        default:
          return "Source non définie";
      }
    },
    [catMap, dossierMap, tagMap]
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBlocks((prev) => {
      const from = prev.findIndex((b) => b.id === active.id);
      const to = prev.findIndex((b) => b.id === over.id);
      if (from < 0 || to < 0) return prev;
      return arrayMove(prev, from, to);
    });
    setDirty(true);
  };

  const editBlock = (block: HomepageBlock) => {
    setDraft({
      id: block.id,
      title: block.title ?? "",
      subtitle: block.subtitle ?? "",
      variant: block.variant ?? "",
      source_type: block.source_type ?? "",
      source_id: block.source_id ?? "",
      manualIds: parseManualIds(block.manual_article_ids),
      item_count: block.item_count,
      starts_at: block.starts_at,
      ends_at: block.ends_at,
    });
    setManualQ("");
  };

  const toggleManual = (id: string, checked: boolean) => {
    setDraft((d) => {
      if (!d) return d;
      if (checked && d.manualIds.length >= 30) {
        toast({
          title: "Sélection limitée",
          description: "Un bloc manuel accepte 30 articles maximum.",
          variant: "destructive",
        });
        return d;
      }
      return { ...d, manualIds: checked ? [...d.manualIds, id] : d.manualIds.filter((x) => x !== id) };
    });
  };

  const applyDraft = () => {
    if (!draft) return;
    if (["category", "dossier", "tag", "format"].includes(draft.source_type) && draft.source_id.trim() === "") {
      toast({
        title: "Source requise",
        description: `Choisissez une valeur pour le type de source « ${SOURCE_TYPES.find((s) => s.value === draft.source_type)?.label ?? draft.source_type} ».`,
        variant: "destructive",
      });
      return;
    }
    const itemCount = Math.min(20, Math.max(1, Math.round(draft.item_count) || 1));
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === draft.id
          ? {
              ...b,
              title: draft.title.trim() || null,
              subtitle: draft.subtitle.trim() || null,
              variant: draft.variant.trim() || null,
              source_type: draft.source_type === "" ? null : draft.source_type,
              source_id: draft.source_id.trim() || null,
              manual_article_ids: JSON.stringify(draft.manualIds),
              item_count: itemCount,
              starts_at: draft.starts_at,
              ends_at: draft.ends_at,
            }
          : b
      )
    );
    setDirty(true);
    setDraft(null);
    toast({ title: "Bloc mis à jour", description: "Modifications locales — cliquez sur Enregistrer pour publier." });
  };

  const toggleActive = (blockId: string, checked: boolean) => {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, is_active: checked } : b)));
    setDirty(true);
  };

  const duplicate = async (block: HomepageBlock) => {
    setDuplicatingId(block.id);
    try {
      const { data } = await apiFetch<HomepageBlock>("/api/admin/homepage", {
        method: "POST",
        json: { action: "duplicate", id: block.id },
      });
      setBlocks((prev) => [...prev, data]);
      toast({ title: "Bloc dupliqué", description: `${data.code} a été ajouté en fin de page (inactif).` });
    } catch (error) {
      toast({ title: "Duplication impossible", description: errorMessage(error), variant: "destructive" });
    } finally {
      setDuplicatingId(null);
    }
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const payload: { blocks: BlockPayload[] } = {
        blocks: blocks.map((b) => ({
          id: b.id,
          title: b.title,
          subtitle: b.subtitle,
          variant: b.variant,
          source_type: b.source_type,
          source_id: b.source_id,
          manual_article_ids: parseManualIds(b.manual_article_ids),
          item_count: b.item_count,
          is_active: b.is_active,
          starts_at: b.starts_at,
          ends_at: b.ends_at,
        })),
      };
      await apiFetch("/api/admin/homepage", { method: "POST", json: payload });
      toast({ title: "Page d'accueil enregistrée", description: "L'ordre et la configuration des blocs sont publiés." });
      await load();
    } catch (error) {
      toast({ title: "Enregistrement impossible", description: errorMessage(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openLayoutDialog = () => {
    if (dirty) {
      toast({
        title: "Modifications non enregistrées",
        description: "Enregistrez d'abord l'ordre et la configuration actuels (bouton Enregistrer).",
        variant: "destructive",
      });
      return;
    }
    setLayoutName("");
    setLayoutDialogOpen(true);
  };

  const saveLayout = async () => {
    const name = layoutName.trim();
    if (!name) {
      toast({ title: "Nom requis", description: "Donnez un nom à la configuration.", variant: "destructive" });
      return;
    }
    setSavingLayout(true);
    try {
      await apiFetch("/api/admin/homepage", { method: "POST", json: { action: "save_layout", name } });
      setLayoutDialogOpen(false);
      setLayoutName("");
      toast({ title: "Configuration enregistrée", description: `Instantané « ${name} » créé.` });
      await load();
    } catch (error) {
      toast({ title: "Enregistrement impossible", description: errorMessage(error), variant: "destructive" });
    } finally {
      setSavingLayout(false);
    }
  };

  const restoreLayout = async (layout: HomepageLayoutItem) => {
    setRestoringId(layout.id);
    try {
      await apiFetch("/api/admin/homepage", {
        method: "POST",
        json: { action: "save_layout", restore: true, layout_id: layout.id },
      });
      toast({ title: "Configuration restaurée", description: `« ${layout.name} » a été appliquée.` });
      await load();
    } catch (error) {
      toast({ title: "Restauration impossible", description: errorMessage(error), variant: "destructive" });
    } finally {
      setRestoringId(null);
    }
  };

  const activeBlocks = useMemo(() => blocks.filter((b) => b.is_active), [blocks]);
  const manualCandidateIds = useMemo(() => new Set(manualCandidates.map((c) => c.id)), [manualCandidates]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kicker text-brand-red">Page d&apos;accueil</p>
          <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight">Composeur de la page d&apos;accueil</h1>
          <p className="mt-1 text-sm text-ink-faint">
            Glissez-déposez les blocs pour les réordonner, modifiez leur configuration, puis enregistrez.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty && (
            <Badge className="border-amber-200 bg-amber-50 text-amber-800" aria-live="polite">
              Modifications non enregistrées
            </Badge>
          )}
          <Button type="button" variant="outline" onClick={openLayoutDialog} disabled={saving}>
            <BookmarkPlus className="size-4" aria-hidden />
            Enregistrer la configuration sous…
          </Button>
          <Button type="button" onClick={() => void saveAll()} disabled={!dirty || saving} aria-label="Enregistrer l'ordre et la configuration des blocs">
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
            Enregistrer
          </Button>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {/* ── Liste des blocs (glisser-déposer) ─────────────────────── */}
          <section aria-label="Blocs de la page d'accueil" className="border border-rule bg-paper">
            <div className="flex items-center justify-between gap-2 border-b border-rule px-4 py-3">
              <div>
                <p className="kicker text-ink-faint">Blocs</p>
                <p className="text-xs text-ink-faint">
                  {loading ? "" : `${blocks.length} bloc${blocks.length > 1 ? "s" : ""} · ${activeBlocks.length} actif${activeBlocks.length > 1 ? "s" : ""}`}
                </p>
              </div>
              <LayoutTemplate className="size-4 text-ink-faint" aria-hidden />
            </div>

            <div className="p-3">
              {loading ? (
                <div className="space-y-2" aria-hidden>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full bg-paper-alt" />
                  ))}
                </div>
              ) : blocks.length === 0 ? (
                <div className="border border-dashed border-rule bg-paper-alt p-10 text-center">
                  <LayoutTemplate className="mx-auto size-6 text-ink-faint" aria-hidden />
                  <p className="mt-2 text-sm font-medium text-ink-soft">Aucun bloc sur la page d&apos;accueil</p>
                  <p className="mt-1 text-xs text-ink-faint">
                    Les blocs sont créés depuis le référentiel éditorial (§09.1) — réexécutez le référentiel ou contactez l&apos;administrateur.
                  </p>
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis]}>
                  <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                    <ul className="space-y-2">
                      {blocks.map((block, index) => (
                        <SortableRow
                          key={block.id}
                          block={block}
                          index={index}
                          sourceLabel={sourceLabelFor(block)}
                          duplicating={duplicatingId === block.id}
                          onEdit={() => editBlock(block)}
                          onToggleActive={(checked) => toggleActive(block.id, checked)}
                          onDuplicate={() => void duplicate(block)}
                        />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </section>

          {/* ── Configurations nommées ────────────────────────────────── */}
          <section aria-label="Configurations nommées" className="border border-rule bg-paper">
            <div className="flex items-center justify-between gap-2 border-b border-rule px-4 py-3">
              <div>
                <p className="kicker text-ink-faint">Configurations nommées</p>
                <p className="text-xs text-ink-faint">Instantanés de l&apos;ordre et de l&apos;état des blocs, restaurables en un clic.</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={openLayoutDialog} aria-label="Enregistrer la configuration actuelle sous un nom">
                <BookmarkPlus className="size-4" aria-hidden />
                Enregistrer sous…
              </Button>
            </div>
            <div className="max-h-56 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
              {layouts.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-ink-faint">
                  Aucune configuration enregistrée. Utilisez « Enregistrer sous… » pour créer un instantané.
                </p>
              ) : (
                <ul>
                  {layouts.map((layout) => (
                    <li key={layout.id} className="flex items-center gap-3 border-b border-rule px-4 py-2.5 last:border-0">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink" title={layout.name}>
                          {layout.name}
                          {layout.is_current && (
                            <Badge className="ml-2 border-brand-red bg-red-wash text-brand-red">Actuelle</Badge>
                          )}
                        </p>
                        <p className="text-xs text-ink-faint">Créée le {fmtDateTime(layout.created_at)}</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void restoreLayout(layout)}
                        disabled={restoringId === layout.id}
                        aria-label={`Restaurer la configuration « ${layout.name} »`}
                      >
                        {restoringId === layout.id ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <RotateCcw className="size-4" aria-hidden />
                        )}
                        Restaurer
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        {/* ── Prévisualisation structurelle ──────────────────────────── */}
        <aside aria-label="Prévisualisation de la structure" className="h-fit border border-rule bg-paper xl:sticky xl:top-20">
          <div className="border-b border-rule px-4 py-3">
            <p className="kicker text-ink-faint">Prévisualisation de la structure</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-faint">
              <Eye className="size-3.5" aria-hidden />
              Blocs actifs, dans l&apos;ordre d&apos;affichage
            </p>
          </div>
          <div className="max-h-[70vh] overflow-y-auto p-3" style={{ scrollbarWidth: "thin" }}>
            {loading ? (
              <div className="space-y-2" aria-hidden>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full bg-paper-alt" />
                ))}
              </div>
            ) : activeBlocks.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-faint">
                Aucun bloc actif. Activez au moins un bloc pour qu&apos;il apparaisse sur la page d&apos;accueil.
              </p>
            ) : (
              <ol className="space-y-2">
                {activeBlocks.map((block, index) => (
                  <li key={block.id} className="border border-rule bg-paper-alt p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-ink-faint">{String(index + 1).padStart(2, "0")}</span>
                      <span className="kicker text-[10px] text-brand-red">{TYPE_LABELS[block.type] ?? block.type}</span>
                    </div>
                    <p className="mt-1 truncate font-serif text-sm font-semibold text-ink" title={block.title ?? block.code}>
                      {block.title ?? block.code}
                    </p>
                    <p className="truncate text-xs text-ink-faint" title={sourceLabelFor(block)}>
                      {sourceLabelFor(block)}
                    </p>
                    <p className="text-xs text-ink-faint">
                      {block.item_count} élément{block.item_count > 1 ? "s" : ""}
                    </p>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-3 border-t border-rule pt-2 text-xs text-ink-faint">
              Le rendu visuel de la page d&apos;accueil est livré en phase 4.
            </p>
          </div>
        </aside>
      </div>

      {/* ── Éditeur de bloc ──────────────────────────────────────────── */}
      <Dialog open={draft !== null} onOpenChange={(open) => { if (!open) setDraft(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto bg-paper sm:max-w-2xl" style={{ scrollbarWidth: "thin" }}>
          <DialogHeader>
            <DialogTitle className="font-serif">
              Modifier le bloc {blocks.find((b) => b.id === draft?.id)?.code ?? ""}
            </DialogTitle>
            <DialogDescription>
              Les modifications sont appliquées localement — cliquez sur « Enregistrer » pour les publier.
            </DialogDescription>
          </DialogHeader>

          {draft && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="block-title" className="text-xs font-semibold text-ink-soft">
                    Titre
                  </Label>
                  <Input
                    id="block-title"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    aria-label="Titre du bloc"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="block-subtitle" className="text-xs font-semibold text-ink-soft">
                    Sous-titre
                  </Label>
                  <Input
                    id="block-subtitle"
                    value={draft.subtitle}
                    onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
                    aria-label="Sous-titre du bloc"
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="block-variant" className="text-xs font-semibold text-ink-soft">
                  Variante du gabarit
                </Label>
                <Input
                  id="block-variant"
                  value={draft.variant}
                  onChange={(e) => setDraft({ ...draft, variant: e.target.value })}
                  placeholder="ex. liste, grille, carrousel…"
                  aria-label="Variante du gabarit du bloc"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-ink-soft">Type de source</Label>
                <Select
                  value={draft.source_type === "" ? "none" : draft.source_type}
                  onValueChange={(value) =>
                    setDraft((d) => (d ? { ...d, source_type: value === "none" ? "" : value, source_id: "" } : d))
                  }
                >
                  <SelectTrigger aria-label="Type de source du bloc">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune (bloc statique)</SelectItem>
                    {SOURCE_TYPES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {draft.source_type === "category" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-ink-soft">Rubrique source</Label>
                  <Select value={draft.source_id} onValueChange={(value) => setDraft({ ...draft, source_id: value })}>
                    <SelectTrigger aria-label="Rubrique source">
                      <SelectValue placeholder="Choisir une rubrique…" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {"—".repeat(c.depth)} {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {draft.source_type === "dossier" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-ink-soft">Dossier source</Label>
                  <Select value={draft.source_id} onValueChange={(value) => setDraft({ ...draft, source_id: value })}>
                    <SelectTrigger aria-label="Dossier source">
                      <SelectValue placeholder="Choisir un dossier…" />
                    </SelectTrigger>
                    <SelectContent>
                      {dossiers.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {draft.source_type === "tag" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-ink-soft">Mot-clé source</Label>
                  <Select value={draft.source_id} onValueChange={(value) => setDraft({ ...draft, source_id: value })}>
                    <SelectTrigger aria-label="Mot-clé source">
                      <SelectValue placeholder="Choisir un mot-clé…" />
                    </SelectTrigger>
                    <SelectContent>
                      {tags.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {draft.source_type === "format" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-ink-soft">Format éditorial</Label>
                  <Select value={draft.source_id} onValueChange={(value) => setDraft({ ...draft, source_id: value })}>
                    <SelectTrigger aria-label="Format éditorial source">
                      <SelectValue placeholder="Choisir un format…" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(FORMAT_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {draft.source_type === "auto" && (
                <p className="rounded-sm border border-rule bg-paper-alt p-3 text-xs text-ink-soft">
                  La source est choisie automatiquement par le moteur (dernières publications). Le nombre d&apos;éléments et la
                  fenêtre de publication ci-dessous s&apos;appliquent.
                </p>
              )}

              {draft.source_type === "manual" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-ink-soft">
                    Sélection manuelle — {draft.manualIds.length} article{draft.manualIds.length > 1 ? "s" : ""} sélectionné
                    {draft.manualIds.length > 1 ? "s" : ""}
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 size-4 text-ink-faint" aria-hidden />
                    <Input
                      value={manualQ}
                      onChange={(e) => setManualQ(e.target.value)}
                      placeholder="Rechercher un article publié…"
                      aria-label="Rechercher un article pour la sélection manuelle"
                      className="pl-8"
                      autoComplete="off"
                    />
                  </div>

                  <div className="max-h-56 overflow-y-auto border border-rule" style={{ scrollbarWidth: "thin" }}>
                    {manualLoading ? (
                      <div className="space-y-2 p-3" aria-hidden>
                        {Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton key={i} className="h-8 w-full bg-paper-alt" />
                        ))}
                      </div>
                    ) : manualCandidates.length === 0 ? (
                      <p className="px-3 py-6 text-center text-xs text-ink-faint">
                        {manualQ.trim() === "" ? "Aucun article publié disponible." : "Aucun résultat pour cette recherche."}
                      </p>
                    ) : (
                      <ul>
                        {manualCandidates.map((candidate) => (
                          <li key={candidate.id} className="border-b border-rule last:border-0">
                            <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-paper-alt">
                              <Checkbox
                                checked={draft.manualIds.includes(candidate.id)}
                                onCheckedChange={(checked) => toggleManual(candidate.id, checked === true)}
                                aria-label={`Inclure l'article « ${candidate.title} » dans la sélection`}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm text-ink" title={candidate.title}>
                                  {candidate.title}
                                </span>
                                {candidate.category && (
                                  <span className="text-xs text-ink-faint">{candidate.category.name}</span>
                                )}
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {draft.manualIds.some((id) => !manualCandidateIds.has(id)) && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-ink-faint">Hors résultats :</span>
                      {draft.manualIds
                        .filter((id) => !manualCandidateIds.has(id))
                        .map((id) => (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 border border-rule bg-paper-alt px-1.5 py-0.5 font-mono text-xs text-ink-soft"
                          >
                            {id.slice(0, 8)}…
                            <button
                              type="button"
                              onClick={() => toggleManual(id, false)}
                              className="text-ink-faint hover:text-brand-red"
                              aria-label="Retirer cet article de la sélection"
                            >
                              <X className="size-3" aria-hidden />
                            </button>
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="block-count" className="text-xs font-semibold text-ink-soft">
                    Nombre d&apos;éléments
                  </Label>
                  <Input
                    id="block-count"
                    type="number"
                    min={1}
                    max={20}
                    value={draft.item_count}
                    onChange={(e) =>
                      setDraft({ ...draft, item_count: Math.min(20, Math.max(1, Math.round(Number(e.target.value)) || 1)) })
                    }
                    aria-label="Nombre d'éléments affichés par le bloc (1 à 20)"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="block-starts" className="text-xs font-semibold text-ink-soft">
                    Début d&apos;affichage
                  </Label>
                  <Input
                    id="block-starts"
                    type="datetime-local"
                    value={toLocalInput(draft.starts_at)}
                    onChange={(e) => setDraft({ ...draft, starts_at: isoOrNull(e.target.value) })}
                    aria-label="Début de la fenêtre d'affichage du bloc"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="block-ends" className="text-xs font-semibold text-ink-soft">
                    Fin d&apos;affichage
                  </Label>
                  <Input
                    id="block-ends"
                    type="datetime-local"
                    value={toLocalInput(draft.ends_at)}
                    onChange={(e) => setDraft({ ...draft, ends_at: isoOrNull(e.target.value) })}
                    aria-label="Fin de la fenêtre d'affichage du bloc"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
              Annuler
            </Button>
            <Button type="button" onClick={applyDraft}>
              <Save className="size-4" aria-hidden />
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Enregistrer la configuration sous… ───────────────────────── */}
      <Dialog open={layoutDialogOpen} onOpenChange={setLayoutDialogOpen}>
        <DialogContent className="bg-paper sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Enregistrer la configuration sous…</DialogTitle>
            <DialogDescription>
              L&apos;ordre et l&apos;état des blocs actuellement enregistrés côté serveur seront instantanés sous ce nom.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={layoutName}
            onChange={(e) => setLayoutName(e.target.value)}
            placeholder="Ex. Une électorale — nuit"
            aria-label="Nom de la configuration"
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void saveLayout();
              }
            }}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setLayoutDialogOpen(false)}>
              Annuler
            </Button>
            <Button type="button" onClick={() => void saveLayout()} disabled={!layoutName.trim() || savingLayout}>
              {savingLayout ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <BookmarkPlus className="size-4" aria-hidden />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Ligne de bloc triable (dnd-kit) ───────────────────────────────────

interface SortableRowProps {
  block: HomepageBlock;
  index: number;
  sourceLabel: string;
  duplicating: boolean;
  onEdit: () => void;
  onToggleActive: (checked: boolean) => void;
  onDuplicate: () => void;
}

function SortableRow({ block, index, sourceLabel, duplicating, onEdit, onToggleActive, onDuplicate }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  const schedule: string[] = [];
  if (block.starts_at) schedule.push(`du ${fmtDateTime(block.starts_at)}`);
  if (block.ends_at) schedule.push(`au ${fmtDateTime(block.ends_at)}`);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "border bg-paper",
        isDragging ? "relative z-10 border-brand-red shadow-sm" : "border-rule",
        !block.is_active && "opacity-70"
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none rounded-sm p-1 text-ink-faint hover:bg-paper-alt hover:text-ink active:cursor-grabbing"
          aria-label={`Déplacer le bloc ${block.code}`}
          title="Glisser pour déplacer"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold text-ink-faint" aria-label={`Position ${index + 1}`}>
              #{index + 1}
            </span>
            <span className="font-mono text-xs font-bold text-ink-soft">{block.code}</span>
            <Badge variant="outline" className="border-rule text-ink-faint">
              {TYPE_LABELS[block.type] ?? block.type}
            </Badge>
            {!block.is_active && (
              <Badge variant="outline" className="border-rule bg-paper-alt text-ink-faint">
                Inactif
              </Badge>
            )}
            <span className="truncate text-sm font-medium text-ink" title={block.title ?? undefined}>
              {block.title ?? "Sans titre"}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-ink-faint">
            {sourceLabel} · {block.item_count} élément{block.item_count > 1 ? "s" : ""}
            {block.variant ? ` · variante : ${block.variant}` : ""}
            {schedule.length > 0 ? ` · ${schedule.join(" ")}` : ""}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Switch
            checked={block.is_active}
            onCheckedChange={onToggleActive}
            aria-label={`Bloc ${block.code} ${block.is_active ? "actif" : "inactif"}`}
          />
          <Button type="button" variant="ghost" size="sm" onClick={onEdit} aria-label={`Modifier le bloc ${block.code}`} title="Modifier">
            <Pencil className="size-4" aria-hidden />
            <span className="hidden md:inline">Modifier</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDuplicate}
            disabled={duplicating}
            aria-label={`Dupliquer le bloc ${block.code}`}
            title="Dupliquer"
          >
            {duplicating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            <span className="sr-only">Dupliquer</span>
          </Button>
        </div>
      </div>
    </li>
  );
}
