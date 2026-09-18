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
import {
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  EyeOff,
  GripVertical,
  FolderTree,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiFetch, errorMessage } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * Onglet Rubriques (§11.2) — arbre à 3 niveaux réordonnable au glisser-déposer
 * (dans un même parent), création/édition avec slug suggéré, déplacement de
 * parent via le point de terminaison de réordonnancement, suppression avec
 * réaffectation obligatoire des articles (critère d'acceptation Phase 2).
 */

interface CategoryRow {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  short_name: string | null;
  description: string | null;
  intro_html: string | null;
  color_accent: string | null;
  icon: string | null;
  position: number;
  depth: number;
  is_visible: boolean;
  show_in_nav: boolean;
  article_count: number;
  live_article_count: number;
  cover: { id: string; url: string } | null;
}

interface ReorderItem {
  id: string;
  parent_id: string | null;
  position: number;
}

const CATEGORIES_URL = "/api/admin/taxonomies/categories";

/** Slugification locale (accents → lettres brutes, non alphanumériques → tiret). */
function slugify(input: string): string {
  const lowered = input.toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae");
  return lowered
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const isHexColor = (value: string): boolean => /^#[0-9a-fA-F]{6}$/.test(value);

function readParentId(data: Record<string, unknown> | undefined): string | null {
  const value = data?.parentId;
  return typeof value === "string" ? value : null;
}

/** Ordre d'affichage d'un groupe : le reste trié par position, l'élément déplacé en dernier. */
function orderedGroup(group: CategoryRow[], moveId: string | null): CategoryRow[] {
  const rest = group
    .filter((r) => r.id !== moveId)
    .sort((a, b) => a.position - b.position);
  if (!moveId) return rest;
  const moved = group.find((r) => r.id === moveId);
  return moved ? [...rest, moved] : rest;
}

/** Liste plate {id, parent_id, position} de TOUTES les rubriques, groupe par groupe. */
function buildFlatItems(rows: CategoryRow[]): ReorderItem[] {
  const items: ReorderItem[] = [];
  const parents = orderedGroup(
    rows.filter((r) => r.parent_id === null),
    null
  );
  parents.forEach((p, idx) => items.push({ id: p.id, parent_id: null, position: idx }));
  for (const parent of parents) {
    const children = orderedGroup(
      rows.filter((r) => r.parent_id === parent.id),
      null
    );
    children.forEach((c, idx) => items.push({ id: c.id, parent_id: parent.id, position: idx }));
  }
  return items;
}

/** Idem, avec déplacement d'une rubrique vers un nouveau parent (placée en fin de groupe). */
function buildMoveItems(
  rows: CategoryRow[],
  moveId: string,
  newParentId: string | null
): ReorderItem[] {
  const copy = rows.map((r) =>
    r.id === moveId ? { ...r, parent_id: newParentId } : r
  );
  const items: ReorderItem[] = [];
  const parents = orderedGroup(
    copy.filter((r) => r.parent_id === null),
    moveId
  );
  parents.forEach((p, idx) => items.push({ id: p.id, parent_id: null, position: idx }));
  for (const parent of parents) {
    const children = orderedGroup(
      copy.filter((r) => r.parent_id === parent.id),
      moveId
    );
    children.forEach((c, idx) => items.push({ id: c.id, parent_id: parent.id, position: idx }));
  }
  return items;
}

export function CategoriesTab() {
  const { toast } = useToast();

  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingOrder, setSavingOrder] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Dialogues
  const [dialog, setDialog] = useState<
    | { mode: "create"; parentId: string | null }
    | { mode: "edit"; category: CategoryRow }
    | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiFetch<CategoryRow[]>(CATEGORIES_URL);
      setRows(data);
      setExpanded(
        (prev) =>
          new Set(
            data
              .filter((r) => r.parent_id === null)
              .map((r) => r.id)
              .filter((id) => prev.size === 0 || prev.has(id))
          )
      );
    } catch (error) {
      toast({
        title: "Chargement impossible",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const persistOrder = useCallback(
    async (nextRows: CategoryRow[]) => {
      setSavingOrder(true);
      try {
        await apiFetch(CATEGORIES_URL, {
          method: "POST",
          json: { action: "reorder", items: buildFlatItems(nextRows) },
        });
        toast({ title: "Ordre des rubriques enregistré" });
      } catch (error) {
        toast({
          title: "Réordonnancement refusé",
          description: errorMessage(error),
          variant: "destructive",
        });
        await reload();
      } finally {
        setSavingOrder(false);
      }
    },
    [toast, reload]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const rowName = useCallback(
    (id: string | number) => rows.find((r) => r.id === id)?.name ?? "rubrique",
    [rows]
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeParent = readParentId(active.data.current);
    const overParent = readParentId(over.data.current);
    if (activeParent !== overParent) {
      toast({
        title: "Déplacement limité au même niveau",
        description:
          "Pour changer une rubrique de parent, utilisez « Déplacer » dans sa fiche d'édition.",
      });
      return;
    }

    const group = orderedGroup(
      rows.filter((r) => r.parent_id === activeParent),
      null
    );
    const from = group.findIndex((r) => r.id === active.id);
    const to = group.findIndex((r) => r.id === over.id);
    if (from < 0 || to < 0) return;

    const moved = arrayMove(group, from, to);
    const nextRows = rows.map((row) => {
      const idx = moved.findIndex((m) => m.id === row.id);
      return idx >= 0 ? { ...row, position: idx } : row;
    });
    setRows(nextRows);
    await persistOrder(nextRows);
  };

  const parents = useMemo(
    () =>
      rows
        .filter((r) => r.parent_id === null)
        .sort((a, b) => a.position - b.position),
    [rows]
  );
  const childrenOf = useCallback(
    (parentId: string): CategoryRow[] =>
      rows
        .filter((r) => r.parent_id === parentId)
        .sort((a, b) => a.position - b.position),
    [rows]
  );

  const confirmDelete = async (reassignTo: string | null) => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const query = reassignTo
      ? `?id=${encodeURIComponent(target.id)}&reassign_to=${encodeURIComponent(reassignTo)}`
      : `?id=${encodeURIComponent(target.id)}`;
    try {
      const { data } = await apiFetch<{ ok: boolean; moved: number }>(
        `${CATEGORIES_URL}${query}`,
        { method: "DELETE" }
      );
      setDeleteTarget(null);
      toast({
        title:
          data.moved > 0
            ? `Rubrique supprimée, ${data.moved} article(s) réaffecté(s)`
            : "Rubrique supprimée",
      });
      await reload();
    } catch (error) {
      // 422 attendu si des articles restent rattachés : message affiché dans le dialogue
      toast({
        title: `Suppression de « ${target.name} » refusée`,
        description: errorMessage(error),
        variant: "destructive",
      });
    }
  };

  return (
    <section aria-label="Rubriques de la rédaction">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold">Arborescence des rubriques</h2>
          <p className="text-sm text-ink-soft">
            {loading
              ? "Chargement…"
              : `${rows.length} rubrique(s) — 3 niveaux maximum`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {savingOrder ? (
            <span className="text-xs text-ink-faint" role="status">
              Enregistrement de l&apos;ordre…
            </span>
          ) : null}
          <Button onClick={() => setDialog({ mode: "create", parentId: null })}>
            <Plus className="size-4" aria-hidden="true" />
            Nouvelle rubrique
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="overflow-hidden rounded-md border border-rule bg-paper" aria-hidden="true">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-rule px-3 py-3 last:border-b-0"
            >
              <Skeleton className="size-4" />
              <Skeleton className="size-4" />
              <Skeleton className="h-4" />
              <Skeleton className="ml-auto h-4 w-14" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-rule-strong bg-paper-alt px-6 py-14 text-center">
          <FolderTree className="size-8 text-ink-faint" aria-hidden="true" />
          <p className="font-serif text-lg font-semibold">Aucune rubrique</p>
          <p className="max-w-sm text-sm text-ink-soft">
            Créez votre première rubrique pour structurer le journal :
            International, Économie, Culture…
          </p>
          <Button onClick={() => setDialog({ mode: "create", parentId: null })}>
            <Plus className="size-4" aria-hidden="true" />
            Nouvelle rubrique
          </Button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={(event) => void handleDragEnd(event)}
          accessibility={{
            announcements: {
              onDragStart: ({ active }) => `Rubrique saisie : ${rowName(active.id)}`,
              onDragOver: ({ over }) =>
                over ? `Au-dessus de ${rowName(over.id)}.` : "Aucune cible.",
              onDragEnd: ({ over }) =>
                over
                  ? `Rubrique déposée après ${rowName(over.id)}.`
                  : "Déplacement annulé.",
              onDragCancel: () => "Déplacement annulé.",
            },
          }}
        >
          <div className="overflow-hidden rounded-md border border-rule bg-paper">
            <div
              className="max-h-[600px] overflow-y-auto"
              style={{ scrollbarWidth: "thin" }}
            >
              <SortableContext
                items={parents.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                {parents.map((parent) => {
                  const children = childrenOf(parent.id);
                  const isOpen = expanded.has(parent.id);
                  return (
                    <div key={parent.id}>
                      <SortableCategoryRow
                        row={parent}
                        depth={0}
                        childCount={children.length}
                        expanded={isOpen}
                        onToggle={() => toggleExpanded(parent.id)}
                        onAddChild={() => setDialog({ mode: "create", parentId: parent.id })}
                        onEdit={() => setDialog({ mode: "edit", category: parent })}
                        onDelete={() => setDeleteTarget(parent)}
                      />
                      {isOpen && children.length > 0 ? (
                        <SortableContext
                          items={children.map((c) => c.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {children.map((child) => (
                            <SortableCategoryRow
                              key={child.id}
                              row={child}
                              depth={1}
                              childCount={0}
                              expanded={false}
                              onToggle={() => undefined}
                              onAddChild={() => undefined}
                              onEdit={() => setDialog({ mode: "edit", category: child })}
                              onDelete={() => setDeleteTarget(child)}
                            />
                          ))}
                        </SortableContext>
                      ) : null}
                    </div>
                  );
                })}
              </SortableContext>
            </div>
          </div>
        </DndContext>
      )}

      <p className="mt-3 text-xs leading-relaxed text-ink-faint">
        Glissez la poignée d&apos;une rubrique pour la réordonner au sein de son
        niveau. Pour changer une rubrique de parent, ouvrez sa fiche et
        utilisez le sélecteur « Déplacer ».
      </p>

      {dialog ? (
        <CategoryDialog
          key={dialog.mode === "edit" ? dialog.category.id : `create-${dialog.parentId ?? "root"}`}
          open
          mode={dialog.mode}
          category={dialog.mode === "edit" ? dialog.category : null}
          presetParentId={dialog.mode === "create" ? dialog.parentId : null}
          rows={rows}
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          onSaved={reload}
        />
      ) : null}

      <DeleteCategoryDialog
        key={deleteTarget?.id ?? "none"}
        target={deleteTarget}
        rows={rows}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={(reassignTo) => void confirmDelete(reassignTo)}
      />
    </section>
  );
}

// ─── Ligne triable de l'arbre ──────────────────────────────────────────

interface SortableCategoryRowProps {
  row: CategoryRow;
  depth: 0 | 1;
  childCount: number;
  expanded: boolean;
  onToggle: () => void;
  onAddChild: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableCategoryRow({
  row,
  depth,
  childCount,
  expanded,
  onToggle,
  onAddChild,
  onEdit,
  onDelete,
}: SortableCategoryRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: row.id, data: { parentId: row.parent_id } });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 border-b border-rule bg-paper px-3 py-2 last:border-b-0",
        depth === 1 && "border-l-2 border-l-rule bg-paper-alt/50 pl-8",
        isDragging && "relative z-10 bg-paper opacity-70"
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none rounded-sm p-0.5 text-ink-faint hover:bg-paper-sunk hover:text-ink"
        aria-label={`Réordonner la rubrique ${row.name}`}
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>

      {depth === 0 ? (
        childCount > 0 ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={expanded ? `Replier ${row.name}` : `Déplier ${row.name}`}
            className="rounded-sm p-0.5 text-ink-soft hover:bg-paper-sunk"
          >
            {expanded ? (
              <ChevronDown className="size-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-4" aria-hidden="true" />
            )}
          </button>
        ) : (
          <span className="inline-block size-5" aria-hidden="true" />
        )
      ) : (
        <CornerDownRight className="size-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
      )}

      <span
        className="size-2.5 shrink-0 rounded-full border border-rule-strong"
        style={{ backgroundColor: isHexColor(row.color_accent ?? "") ? (row.color_accent as string) : "transparent" }}
        aria-hidden="true"
      />

      <span
        className={cn(
          "truncate text-sm",
          depth === 0 ? "font-medium" : "text-ink-soft",
          !row.is_visible && "text-ink-faint"
        )}
      >
        {row.name}
      </span>
      {row.short_name ? (
        <span className="hidden text-xs text-ink-faint sm:inline">({row.short_name})</span>
      ) : null}
      <span className="hidden font-mono text-xs text-ink-faint md:inline">/{row.slug}</span>

      {!row.is_visible ? (
        <span className="inline-flex items-center gap-1 text-xs text-ink-faint">
          <EyeOff className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Rubrique masquée</span>
        </span>
      ) : null}
      {!row.show_in_nav ? (
        <Badge variant="outline" className="hidden border-rule bg-paper-alt text-[11px] font-normal text-ink-faint lg:inline-flex">
          hors menu
        </Badge>
      ) : null}

      <Badge
        variant="outline"
        className="ml-auto shrink-0 border-rule bg-paper-alt text-[11px] tabular-nums text-ink-soft"
        aria-label={`${row.article_count} article(s) rattaché(s)`}
      >
        {row.article_count} art.
      </Badge>

      <div className="flex shrink-0 items-center gap-0.5">
        {depth === 0 ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-ink-faint hover:text-ink"
            onClick={onAddChild}
            aria-label={`Ajouter une sous-rubrique à ${row.name}`}
          >
            <Plus className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-ink-faint hover:text-ink"
          onClick={onEdit}
          aria-label={`Modifier la rubrique ${row.name}`}
        >
          <Pencil className="size-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-ink-faint hover:bg-red-wash hover:text-brand-red"
          onClick={onDelete}
          aria-label={`Supprimer la rubrique ${row.name}`}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

// ─── Dialogue création / édition ───────────────────────────────────────

interface CategoryDialogProps {
  open: boolean;
  mode: "create" | "edit";
  category: CategoryRow | null;
  presetParentId: string | null;
  rows: CategoryRow[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}

function CategoryDialog({
  open,
  mode,
  category,
  presetParentId,
  rows,
  onOpenChange,
  onSaved,
}: CategoryDialogProps) {
  const { toast } = useToast();

  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [shortName, setShortName] = useState(category?.short_name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [introHtml, setIntroHtml] = useState(category?.intro_html ?? "");
  const [colorAccent, setColorAccent] = useState(category?.color_accent ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "");
  const [isVisible, setIsVisible] = useState(category?.is_visible ?? true);
  const [showInNav, setShowInNav] = useState(category?.show_in_nav ?? true);
  const [parentId, setParentId] = useState<string>(
    mode === "edit" ? (category?.parent_id ?? "") : (presetParentId ?? "")
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parentChanged = mode === "edit" && (category?.parent_id ?? "") !== parentId;

  /** Options de parent : profondeur ≤ 1, hors rubrique elle-même et sa descendance. */
  const parentOptions = useMemo(() => {
    if (!category) return rows.filter((r) => r.depth <= 1);
    const childIds = new Set(rows.filter((r) => r.parent_id === category.id).map((r) => r.id));
    const grandChildIds = new Set(
      rows.filter((r) => r.parent_id && childIds.has(r.parent_id)).map((r) => r.id)
    );
    return rows.filter(
      (r) => r.depth <= 1 && r.id !== category.id && !childIds.has(r.id) && !grandChildIds.has(r.id)
    );
  }, [rows, category]);

  const hasChildren = category ? rows.some((r) => r.parent_id === category.id) : false;

  const onNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const optValue = (value: string): string | null =>
    value.trim() ? value.trim() : null;

  const save = async () => {
    if (!name.trim()) {
      setError("Le nom de la rubrique est obligatoire.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (mode === "create") {
        await apiFetch(CATEGORIES_URL, {
          method: "POST",
          json: {
            name: name.trim(),
            ...(slug.trim() ? { slug: slugify(slug) } : {}),
            ...(parentId ? { parent_id: parentId } : {}),
            ...(optValue(shortName) ? { short_name: optValue(shortName) } : {}),
            ...(optValue(description) ? { description: optValue(description) } : {}),
            ...(optValue(introHtml) ? { intro_html: optValue(introHtml) } : {}),
            ...(optValue(colorAccent) ? { color_accent: optValue(colorAccent) } : {}),
            ...(optValue(icon) ? { icon: optValue(icon) } : {}),
            is_visible: isVisible,
            show_in_nav: showInNav,
          },
        });
        toast({ title: "Rubrique créée" });
      } else if (category) {
        await apiFetch(`${CATEGORIES_URL}?id=${encodeURIComponent(category.id)}`, {
          method: "PATCH",
          json: {
            name: name.trim(),
            ...(slug.trim() ? { slug: slugify(slug) } : {}),
            short_name: optValue(shortName),
            description: optValue(description),
            intro_html: optValue(introHtml),
            color_accent: optValue(colorAccent),
            icon: optValue(icon),
            is_visible: isVisible,
            show_in_nav: showInNav,
          },
        });
        if (parentChanged) {
          const items = buildMoveItems(rows, category.id, parentId || null);
          await apiFetch(CATEGORIES_URL, {
            method: "POST",
            json: { action: "reorder", items },
          });
          // 2ᵉ passe : les profondeurs des sous-rubriques sont recalculées
          // avec la nouvelle profondeur du parent déplacé.
          if (hasChildren) {
            await apiFetch(CATEGORIES_URL, {
              method: "POST",
              json: { action: "reorder", items },
            });
          }
        }
        toast({
          title: parentChanged
            ? "Rubrique mise à jour et déplacée"
            : "Rubrique mise à jour",
          description:
            parentChanged && hasChildren
              ? "Les sous-rubriques suivent leur parent."
              : undefined,
        });
      }
      onOpenChange(false);
      await onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-md sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            {mode === "create" ? "Nouvelle rubrique" : `Modifier « ${category?.name} »`}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "La rubrique est immédiatement disponible pour classer les articles."
              : "Le renommage du slug crée automatiquement une redirection 301."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="cat-name">Nom *</Label>
            <Input
              id="cat-name"
              value={name}
              maxLength={120}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Ex. International"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cat-slug">Slug</Label>
            <Input
              id="cat-slug"
              value={slug}
              maxLength={120}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="international"
              className="font-mono text-sm"
            />
            <p className="text-xs text-ink-faint">
              Suggéré d&apos;après le nom — modifiable (minuscules, tirets).
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cat-short">Nom court</Label>
            <Input
              id="cat-short"
              value={shortName}
              maxLength={60}
              onChange={(e) => setShortName(e.target.value)}
              placeholder="Ex. Monde"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cat-parent">
              {mode === "edit" ? "Déplacer sous" : "Rubrique parente"}
            </Label>
            <Select
              value={parentId || "ROOT"}
              onValueChange={(value) => setParentId(value === "ROOT" ? "" : value)}
            >
              <SelectTrigger id="cat-parent" aria-label="Rubrique parente">
                <SelectValue placeholder="Choisir un parent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ROOT">— Racine (rubrique de premier niveau) —</SelectItem>
                {parentOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.depth === 1 ? "— " : ""}
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {mode === "edit" && parentChanged && hasChildren ? (
              <p className="text-xs text-ink-soft">
                Les sous-rubriques suivront ce déplacement.
              </p>
            ) : null}
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="cat-description">Description</Label>
            <Textarea
              id="cat-description"
              value={description}
              rows={2}
              maxLength={1000}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Résumé éditorial de la rubrique"
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="cat-intro">Introduction (HTML de page rubrique)</Label>
            <Textarea
              id="cat-intro"
              value={introHtml}
              rows={4}
              maxLength={20000}
              onChange={(e) => setIntroHtml(e.target.value)}
              placeholder="Texte d'introduction affiché en tête de la page publique de la rubrique."
              className="font-mono text-xs"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cat-color">Couleur d&apos;accent</Label>
            <div className="flex items-center gap-2">
              <span
                className="size-8 shrink-0 rounded-sm border border-rule"
                style={{ backgroundColor: isHexColor(colorAccent) ? colorAccent : "transparent" }}
                aria-hidden="true"
              />
              <Input
                id="cat-color"
                value={colorAccent}
                maxLength={20}
                onChange={(e) => setColorAccent(e.target.value)}
                placeholder="#C8102E"
                className="font-mono text-sm"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cat-icon">Icône (nom Lucide)</Label>
            <Input
              id="cat-icon"
              value={icon}
              maxLength={60}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="Ex. Globe2"
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-sm border border-rule bg-paper-alt px-3 py-2.5">
            <Label htmlFor="cat-visible" className="cursor-pointer">
              Visible sur le site
            </Label>
            <Switch
              id="cat-visible"
              checked={isVisible}
              onCheckedChange={setIsVisible}
              aria-label="Rubrique visible sur le site"
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-sm border border-rule bg-paper-alt px-3 py-2.5">
            <Label htmlFor="cat-nav" className="cursor-pointer">
              Afficher dans le menu
            </Label>
            <Switch
              id="cat-nav"
              checked={showInNav}
              onCheckedChange={setShowInNav}
              aria-label="Afficher la rubrique dans le menu de navigation"
            />
          </div>
        </div>

        {error ? (
          <p role="alert" className="rounded-sm border border-brand-red bg-red-wash px-3 py-2 text-sm text-brand-red">
            {error}
          </p>
        ) : null}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Annuler
          </Button>
          <Button onClick={() => void save()} disabled={pending}>
            {pending ? "Enregistrement…" : mode === "create" ? "Créer la rubrique" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialogue suppression (réaffectation obligatoire) ──────────────────

interface DeleteCategoryDialogProps {
  target: CategoryRow | null;
  rows: CategoryRow[];
  onOpenChange: (open: boolean) => void;
  onConfirm: (reassignTo: string | null) => void;
}

function DeleteCategoryDialog({ target, rows, onOpenChange, onConfirm }: DeleteCategoryDialogProps) {
  // Réinitialisation garantie par le `key` du parent (remontage par cible) :
  // pas de setState dans un effet (règle React Compiler).
  const [reassignTo, setReassignTo] = useState("");

  const articleCount = target ? Math.max(target.article_count, target.live_article_count) : 0;
  const childCount = target ? rows.filter((r) => r.parent_id === target.id).length : 0;
  const otherCategories = target ? rows.filter((r) => r.id !== target.id) : [];

  if (!target) return null;

  const needsReassign = articleCount > 0;
  const blocked = childCount > 0;

  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif text-xl">
            Supprimer la rubrique « {target.name} » ?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {blocked ? (
                <p className="font-medium text-brand-red">
                  Suppression impossible : {childCount} sous-rubrique(s) à déplacer d&apos;abord.
                </p>
              ) : needsReassign ? (
                <>
                  <p>
                    Suppression bloquée : {articleCount} article(s) rattaché(s).
                    Choisissez la rubrique de réaffectation :
                  </p>
                  <Select value={reassignTo} onValueChange={setReassignTo}>
                    <SelectTrigger aria-label="Rubrique de réaffectation des articles">
                      <SelectValue placeholder="Sélectionner une rubrique cible…" />
                    </SelectTrigger>
                    <SelectContent>
                      {otherCategories.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name} ({option.article_count} art.)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-ink-faint">
                    L&apos;ancienne adresse de la rubrique redirigera vers la cible choisie.
                  </p>
                </>
              ) : (
                <p>
                  Cette rubrique ne contient aucun article. Cette action est
                  définitive et l&apos;adresse /{target.slug} cessera d&apos;être servie.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              if (blocked || (needsReassign && !reassignTo)) return;
              onConfirm(needsReassign ? reassignTo : null);
            }}
            disabled={blocked || (needsReassign && !reassignTo)}
            className="bg-brand-red text-white hover:bg-red-deep"
          >
            {needsReassign ? "Supprimer et réaffecter" : "Supprimer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
