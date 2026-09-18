"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  Eye,
  EyeOff,
  ExternalLink,
  GripVertical,
  Info,
  ListTree,
  Loader2,
  Pencil,
  Plus,
  RotateCw,
  Save,
  Trash2,
} from "lucide-react";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { apiFetch, errorMessage } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/**
 * Écran « Menus & redirections » (§11.2, Phase 2) :
 * - onglet Menus : sélection d'une zone (main, secondary, footer_1..4,
 *   mobile, utility), arborescence deux niveaux réordonnçable par
 *   glisser-déposer @dnd-kit (bords de ligne = même niveau, centre =
 *   sous-élément, fantôme DragOverlay, annonces lecteurs d'écran) ou par
 *   flèches (clavier, §18.1), visibilité, CTA rouge ; l'enregistrement
 *   envoie la liste plate complète (sans id) et le serveur reconstruit
 *   l'arbre ;
 * - onglet Redirections : création 301/302 (chemins commençant par « / »),
 *   compteur d'accès, badge « Auto » pour les redirections de renommage.
 */

interface MenuItem {
  id: string;
  parent_id: string | null;
  label: string;
  target_type: string;
  target_id: string | null;
  target_url: string | null;
  icon: string | null;
  open_new_tab: boolean;
  highlight: boolean;
  position: number;
  is_visible: boolean;
  locale?: string;
}

interface MenuRow {
  id: string;
  key: string;
  label: string;
  items: MenuItem[];
}

/** Élément envoyé au serveur : sans id (l'arbre est reconstruit côté API). */
interface MenuItemPayload {
  parent_id: string | null;
  label: string;
  target_type: string;
  target_id: string | null;
  target_url: string | null;
  icon: string | null;
  open_new_tab: boolean;
  highlight: boolean;
  position: number;
  is_visible: boolean;
}

interface RedirectRow {
  id: string;
  source_path: string;
  target_path: string;
  status_code: number;
  hit_count: number;
  is_auto: boolean;
  created_at: string;
}

interface RefItem {
  id: string;
  label: string;
  hint?: string;
}

type RefKind = "categories" | "pages" | "dossiers" | "tags";

interface RefState {
  status: "idle" | "loading" | "ready" | "error";
  items: RefItem[];
}

interface ItemFormState {
  label: string;
  target_type: TargetType;
  target_id: string;
  target_url: string;
  icon: string;
  open_new_tab: boolean;
  highlight: boolean;
  is_visible: boolean;
  /** "root" = racine du menu (sentinelle, SelectItem n'accepte pas ""). */
  parent_id: string;
}

interface FlatRow {
  item: MenuItem;
  depth: 0 | 1;
  sibIndex: number;
  sibCount: number;
}

const TARGET_TYPES = [
  { value: "category", label: "Rubrique" },
  { value: "page", label: "Page" },
  { value: "dossier", label: "Dossier" },
  { value: "tag", label: "Tag" },
  { value: "url", label: "URL externe / lien" },
  { value: "home", label: "Accueil" },
  { value: "section", label: "Section" },
] as const;

type TargetType = (typeof TARGET_TYPES)[number]["value"];

type RefTarget = "category" | "page" | "dossier" | "tag";

const REF_SOURCES: Record<RefTarget, { kind: RefKind; url: string }> = {
  category: { kind: "categories", url: "/api/admin/taxonomies/categories" },
  page: { kind: "pages", url: "/api/admin/pages" },
  dossier: {
    kind: "dossiers",
    url: "/api/admin/taxonomies/annexes?kind=dossiers",
  },
  tag: { kind: "tags", url: "/api/admin/taxonomies/tags" },
};

const REF_TARGET_LABELS: Record<RefTarget, string> = {
  category: "rubrique",
  page: "page",
  dossier: "dossier",
  tag: "tag",
};

function isRefTarget(value: TargetType): value is RefTarget {
  return (
    value === "category" ||
    value === "page" ||
    value === "dossier" ||
    value === "tag"
  );
}

const EMPTY_ITEM_FORM: ItemFormState = {
  label: "",
  target_type: "category",
  target_id: "",
  target_url: "",
  icon: "",
  open_new_tab: false,
  highlight: false,
  is_visible: true,
  parent_id: "root",
};

const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : DATE_FORMAT.format(date);
}

function genId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function firstString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

/** Normalise une liste de référentiel (rubriques, pages, dossiers, tags). */
function toRefList(raw: unknown, kind: RefKind): RefItem[] {
  if (!Array.isArray(raw)) return [];
  const out: RefItem[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const id = firstString(record, ["id", "key", "slug", "code"]);
    if (!id) continue;
    const label = firstString(
      record,
      kind === "pages" ? ["title", "name", "label"] : ["name", "title", "label"]
    );
    if (!label) continue;
    const slug = firstString(record, ["slug"]);
    out.push({
      id,
      label,
      hint: slug && slug !== label ? slug : undefined,
    });
  }
  return out;
}

const positionOf = (item: MenuItem): number =>
  Number.isFinite(item.position) ? item.position : 0;

/**
 * Remet l'arbre à plat dans un ordre canonique : racines triées par
 * position puis enfants triés par position ; les orphelins (parent supprimé)
 * sont remontés à la racine ; les positions sont renumérotées par groupe.
 */
function normalizeItems(raw: MenuItem[]): MenuItem[] {
  const ids = new Set(raw.map((item) => item.id));
  const roots = raw
    .filter((item) => !item.parent_id || !ids.has(item.parent_id))
    .sort((a, b) => positionOf(a) - positionOf(b));

  const seen = new Set<string>();
  const out: MenuItem[] = [];
  roots.forEach((root, ri) => {
    seen.add(root.id);
    out.push({ ...root, parent_id: null, position: ri });
    raw
      .filter((item) => item.parent_id === root.id)
      .sort((a, b) => positionOf(a) - positionOf(b))
      .forEach((child, ci) => {
        seen.add(child.id);
        out.push({ ...child, position: ci });
      });
  });
  raw
    .filter((item) => !seen.has(item.id))
    .sort((a, b) => positionOf(a) - positionOf(b))
    .forEach((lost, li) => {
      out.push({ ...lost, parent_id: null, position: roots.length + li });
    });
  return out;
}

/** Aplatit pour l'affichage avec index/compte de fratrie (flèches). */
function flattenItems(items: MenuItem[]): FlatRow[] {
  const normalized = normalizeItems(items);
  const roots = normalized.filter((item) => !item.parent_id);
  const rows: FlatRow[] = [];
  roots.forEach((root, ri) => {
    rows.push({ item: root, depth: 0, sibIndex: ri, sibCount: roots.length });
    const children = normalized.filter((item) => item.parent_id === root.id);
    children.forEach((child, ci) => {
      rows.push({
        item: child,
        depth: 1,
        sibIndex: ci,
        sibCount: children.length,
      });
    });
  });
  return rows;
}

/** Liste plate à envoyer au serveur (sans id, positions par fratrie). */
function buildPayload(items: MenuItem[]): MenuItemPayload[] {
  return normalizeItems(items).map((item) => ({
    parent_id: item.parent_id,
    label: item.label,
    target_type: item.target_type,
    target_id: item.target_id,
    target_url: item.target_url,
    icon: item.icon,
    open_new_tab: item.open_new_tab,
    highlight: item.highlight,
    position: item.position,
    is_visible: item.is_visible,
  }));
}

// ── Glisser-déposer (@dnd-kit, §11.2) ───────────────────────────────────

/** Mode de dépôt : bords de ligne = même niveau, centre = enfant. */
type DropMode = "before" | "after" | "child";

interface DropHint {
  id: string;
  mode: DropMode;
}

/** Position verticale du pointeur pendant le déplacement (null au clavier). */
function pointerYOf(event: {
  activatorEvent: Event;
  delta: { y: number };
}): number | null {
  const clientY = (event.activatorEvent as Partial<PointerEvent>).clientY;
  return typeof clientY === "number" ? clientY + event.delta.y : null;
}

/**
 * Détermine l'effet d'un dépôt : « before »/« after » = insérer au même
 * niveau que la cible (cible racine → niveau racine, cible enfant → parmi
 * les enfants de son parent, ce qui couvre le ré-attachement) ; « child » =
 * imbriquer sous la cible (zone centrale de la ligne). Renvoie null si le
 * dépôt est interdit : dans son propre descendant, ou création d'une
 * profondeur 3 (un élément déjà parent ne peut pas devenir enfant).
 */
function resolveDrop(
  activeId: string,
  overId: string | undefined,
  pointerY: number | null,
  overRect: { top: number; height: number } | null,
  order: string[],
  items: MenuItem[]
): DropHint | null {
  if (!overId || overId === activeId) return null;
  const active = items.find((item) => item.id === activeId);
  const over = items.find((item) => item.id === overId);
  if (!active || !over) return null;
  // Interdiction de déposer un élément dans son propre descendant.
  if (over.parent_id === active.id) return null;

  const activeHasChildren = items.some((item) => item.parent_id === active.id);
  const relative =
    pointerY !== null && overRect && overRect.height > 0
      ? (pointerY - overRect.top) / overRect.height
      : null;

  let mode: DropMode;
  if (relative === null) {
    // Capteur clavier : insertion au même niveau que la cible survolée,
    // avant ou après selon l'ordre courant des lignes.
    mode =
      order.indexOf(activeId) < order.indexOf(overId) ? "after" : "before";
  } else if (relative < 1 / 3) {
    mode = "before";
  } else if (relative > 2 / 3) {
    mode = "after";
  } else {
    mode = "child";
  }

  if (mode === "child") {
    // Imbrication : cible racine uniquement (profondeur max : 2 niveaux) et
    // élément déplacé sans enfants (sinon profondeur 3).
    if (over.parent_id === null && !activeHasChildren) {
      return { id: overId, mode: "child" };
    }
    mode = relative !== null && relative < 0.5 ? "before" : "after";
  }

  // Même niveau que la cible : la cible est racine → niveau racine ; la
  // cible est un enfant → parmi les enfants de son parent.
  if (over.parent_id !== null && activeHasChildren) {
    // L'élément déplacé (déjà parent) deviendrait un enfant : interdit.
    return null;
  }
  return { id: overId, mode };
}

/**
 * Applique un dépôt : renvoie la nouvelle liste plate (normalisée, positions
 * renumérotées par fratrie) ou null si l'opération est impossible.
 */
function applyDrop(
  items: MenuItem[],
  activeId: string,
  hint: DropHint
): MenuItem[] | null {
  const active = items.find((item) => item.id === activeId);
  const over = items.find((item) => item.id === hint.id);
  if (!active || !over) return null;

  if (hint.mode === "child") {
    // Devient dernier enfant de la cible (normalizeItems renumérote).
    return normalizeItems(
      items.map((item) =>
        item.id === activeId
          ? { ...item, parent_id: over.id, position: 9999 }
          : item
      )
    );
  }

  const parentId = over.parent_id;
  const others = items.filter((item) => item.id !== activeId);
  const siblings = others
    .filter((item) => item.parent_id === parentId)
    .sort((a, b) => positionOf(a) - positionOf(b));
  const overIndex = siblings.findIndex((item) => item.id === over.id);
  if (overIndex === -1) return null;
  const insertAt = hint.mode === "before" ? overIndex : overIndex + 1;
  siblings.splice(insertAt, 0, { ...active, parent_id: parentId });
  const rest = others.filter((item) => item.parent_id !== parentId);
  const rebuilt = siblings.map((sibling, index) => ({
    ...sibling,
    position: index,
  }));
  return normalizeItems([...rest, ...rebuilt]);
}

function ListSkeleton() {
  return (
    <div className="space-y-0" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-rule px-4 py-3.5"
        >
          <Skeleton className="h-8 w-8" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-1/4 max-w-48" />
            <Skeleton className="h-3 w-1/3 max-w-64" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}

function LoadErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <p className="text-sm text-ink-soft">
        Chargement impossible. Vérifiez votre connexion puis réessayez.
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RotateCw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
        Réessayer
      </Button>
    </div>
  );
}

export function MenusClient() {
  const { toast } = useToast();

  const [tab, setTab] = useState("menus");

  // ── Menus ────────────────────────────────────────────────────────────────
  const [menus, setMenus] = useState<MenuRow[] | null>(null);
  const [menusError, setMenusError] = useState(false);
  const [selectedKey, setSelectedKey] = useState("");
  const [items, setItems] = useState<MenuItem[]>([]);
  const [snapshot, setSnapshot] = useState("");
  const [saving, setSaving] = useState(false);

  // Glisser-déposer (@dnd-kit).
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<DropHint | null>(null);

  // Référentiels (chargés en arrière-plan, sans id bloquant).
  const [refs, setRefs] = useState<Record<RefKind, RefState>>({
    categories: { status: "idle", items: [] },
    pages: { status: "idle", items: [] },
    dossiers: { status: "idle", items: [] },
    tags: { status: "idle", items: [] },
  });
  const refsRequested = useRef<Set<RefKind>>(new Set());

  // Dialogue d'édition d'élément.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [dialogItemId, setDialogItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormState>(EMPTY_ITEM_FORM);
  const [itemError, setItemError] = useState("");

  // ── Redirections ─────────────────────────────────────────────────────────
  const [redirects, setRedirects] = useState<RedirectRow[] | null>(null);
  const [redirectsError, setRedirectsError] = useState(false);
  const redirectsRequested = useRef(false);
  const [redirectForm, setRedirectForm] = useState({
    source_path: "",
    target_path: "",
    status_code: "301",
  });
  const [redirectError, setRedirectError] = useState("");
  const [redirectSaving, setRedirectSaving] = useState(false);
  const [redirectDeleting, setRedirectDeleting] = useState<RedirectRow | null>(
    null
  );
  const [redirectDeleteBusy, setRedirectDeleteBusy] = useState(false);

  const selectedMenu = useMemo(
    () => menus?.find((menu) => menu.key === selectedKey) ?? null,
    [menus, selectedKey]
  );

  const currentPayload = useMemo(() => JSON.stringify(buildPayload(items)), [items]);
  const dirty = currentPayload !== snapshot;

  const ensureRef = useCallback(async (target: RefTarget) => {
    const source = REF_SOURCES[target];
    if (refsRequested.current.has(source.kind)) return;
    refsRequested.current.add(source.kind);
    setRefs((prev) => ({
      ...prev,
      [source.kind]: { ...prev[source.kind], status: "loading" },
    }));
    try {
      const { data } = await apiFetch<unknown>(source.url);
      setRefs((prev) => ({
        ...prev,
        [source.kind]: { status: "ready", items: toRefList(data, source.kind) },
      }));
    } catch {
      setRefs((prev) => ({
        ...prev,
        [source.kind]: { ...prev[source.kind], status: "error" },
      }));
    }
  }, []);

  const applyMenu = useCallback((menu: MenuRow | null) => {
    const normalized = normalizeItems(menu?.items ?? []);
    setSelectedKey(menu?.key ?? "");
    setItems(normalized);
    setSnapshot(JSON.stringify(buildPayload(normalized)));
  }, []);

  const loadMenus = useCallback(
    async (selectKey?: string) => {
      setMenusError(false);
      try {
        const { data } = await apiFetch<MenuRow[]>("/api/admin/menus");
        const list = Array.isArray(data) ? data : [];
        setMenus(list);
        const next =
          list.find((menu) => menu.key === (selectKey ?? selectedKey)) ??
          list[0] ??
          null;
        applyMenu(next);
      } catch (error) {
        setMenusError(true);
        toast({
          title: "Chargement des menus impossible",
          description: errorMessage(error),
          variant: "destructive",
        });
      }
    },
    [applyMenu, selectedKey, toast]
  );

  useEffect(() => {
    void loadMenus();
  }, []);

  // Préchargement des référentiels pour les résumés de cible des lignes.
  useEffect(() => {
    if (menus !== null) {
      void ensureRef("category");
      void ensureRef("page");
      void ensureRef("dossier");
      void ensureRef("tag");
    }
  }, [menus, ensureRef]);

  function selectMenu(key: string) {
    const menu = menus?.find((m) => m.key === key) ?? null;
    applyMenu(menu);
  }

  async function saveMenu() {
    const menu = selectedMenu;
    if (!menu) return;
    setSaving(true);
    try {
      await apiFetch(`/api/admin/menus?id=${encodeURIComponent(menu.id)}`, {
        method: "PUT",
        json: { items: buildPayload(items) },
      });
      toast({ title: "Menu enregistré." });
      await loadMenus(menu.key);
    } catch (error) {
      toast({
        title: "Enregistrement impossible",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  /**
   * Persiste immédiatement l'ordre après un glisser-déposer : même requête
   * PUT que le bouton « Enregistrer », mise à jour optimiste avec rollback
   * de la liste précédente si le serveur refuse.
   */
  async function persistOrder(next: MenuItem[], previous: MenuItem[]) {
    const menu = selectedMenu;
    if (!menu) return;
    setSaving(true);
    try {
      await apiFetch(`/api/admin/menus?id=${encodeURIComponent(menu.id)}`, {
        method: "PUT",
        json: { items: buildPayload(next) },
      });
      toast({ title: "Ordre enregistré." });
      await loadMenus(menu.key);
    } catch (error) {
      setItems(previous); // Rollback de la mise à jour optimiste.
      toast({
        title: "Enregistrement impossible",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  // ── Édition d'élément ────────────────────────────────────────────────────

  function preloadRefs() {
    void ensureRef("category");
    void ensureRef("page");
    void ensureRef("dossier");
    void ensureRef("tag");
  }

  function openItemCreate() {
    setDialogMode("create");
    setDialogItemId(null);
    setItemForm(EMPTY_ITEM_FORM);
    setItemError("");
    setDialogOpen(true);
    preloadRefs();
  }

  function openItemEdit(item: MenuItem) {
    setDialogMode("edit");
    setDialogItemId(item.id);
    setItemForm({
      label: item.label,
      target_type: (TARGET_TYPES.find((t) => t.value === item.target_type)
        ?.value ?? "url") as TargetType,
      target_id: item.target_id ?? "",
      target_url: item.target_url ?? "",
      icon: item.icon ?? "",
      open_new_tab: Boolean(item.open_new_tab),
      highlight: Boolean(item.highlight),
      is_visible: Boolean(item.is_visible),
      parent_id: item.parent_id ?? "root",
    });
    setItemError("");
    setDialogOpen(true);
    preloadRefs();
  }

  const editingHasChildren =
    dialogMode === "edit" &&
    dialogItemId !== null &&
    items.some((candidate) => candidate.parent_id === dialogItemId);

  const parentOptions = useMemo(() => {
    const roots = normalizeItems(items).filter((item) => !item.parent_id);
    if (dialogMode === "edit" && dialogItemId !== null) {
      return roots.filter((root) => root.id !== dialogItemId);
    }
    return roots;
  }, [items, dialogMode, dialogItemId]);

  function saveItem() {
    const label = itemForm.label.trim();
    if (!label) {
      setItemError("Le libellé est obligatoire.");
      return;
    }
    if (itemForm.target_type === "url" && itemForm.target_url.trim().length === 0) {
      setItemError("L'URL de destination est obligatoire pour un lien.");
      return;
    }
    if (isRefTarget(itemForm.target_type) && !itemForm.target_id) {
      setItemError(
        `Sélectionnez une ${REF_TARGET_LABELS[itemForm.target_type]} de destination.`
      );
      return;
    }

    const common = {
      parent_id: itemForm.parent_id === "root" ? null : itemForm.parent_id,
      label,
      target_type: itemForm.target_type,
      target_id: isRefTarget(itemForm.target_type) ? itemForm.target_id : null,
      target_url:
        itemForm.target_type === "url" ? itemForm.target_url.trim() : null,
      icon: itemForm.icon.trim() || null,
      open_new_tab: itemForm.open_new_tab,
      highlight: itemForm.highlight,
      is_visible: itemForm.is_visible,
    };

    if (dialogMode === "edit" && dialogItemId !== null) {
      setItems((prev) =>
        normalizeItems(
          prev.map((item) =>
            item.id === dialogItemId ? { ...item, ...common } : item
          )
        )
      );
    } else {
      setItems((prev) =>
        normalizeItems([...prev, { id: genId(), position: 9999, ...common }])
      );
    }
    setDialogOpen(false);
  }

  function moveItem(id: string, direction: -1 | 1) {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (!target) return prev;
      const siblings = prev
        .filter((item) => item.parent_id === target.parent_id)
        .sort((a, b) => positionOf(a) - positionOf(b));
      const index = siblings.findIndex((item) => item.id === id);
      const other = siblings[index + direction];
      if (!other) return prev;
      return normalizeItems(
        prev.map((item) => {
          if (item.id === id) return { ...item, position: other.position };
          if (item.id === other.id) return { ...item, position: target.position };
          return item;
        })
      );
    });
  }

  function toggleVisible(id: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, is_visible: !item.is_visible } : item
      )
    );
  }

  function removeItem(id: string) {
    const hasChildren = items.some((item) => item.parent_id === id);
    setItems((prev) => normalizeItems(prev.filter((item) => item.id !== id)));
    toast({
      title: "Élément retiré.",
      description: hasChildren
        ? "Ses sous-éléments ont été remontés à la racine. Cliquez sur « Enregistrer » pour confirmer."
        : "Cliquez sur « Enregistrer » pour confirmer la suppression.",
    });
  }

  // ── Résumé de cible (ligne) ──────────────────────────────────────────────

  function refLabel(kind: RefKind, id: string | null, fallback: string): string {
    if (!id) return fallback;
    const found = refs[kind].items.find((option) => option.id === id);
    return found ? found.label : `${fallback} (${id.slice(0, 8)}…)`;
  }

  function targetSummary(item: MenuItem): string {
    const type = item.target_type;
    if (type === "home") return "Page d'accueil";
    if (type === "section") return "Section de page";
    if (type === "url") return item.target_url ?? "Lien";
    if (type === "category") return refLabel("categories", item.target_id, "Rubrique");
    if (type === "page") return refLabel("pages", item.target_id, "Page");
    if (type === "dossier") return refLabel("dossiers", item.target_id, "Dossier");
    if (type === "tag") return refLabel("tags", item.target_id, "Tag");
    return type;
  }

  // ── Redirections ─────────────────────────────────────────────────────────

  const loadRedirects = useCallback(async () => {
    setRedirectsError(false);
    try {
      const { data } = await apiFetch<RedirectRow[]>(
        "/api/admin/banners?kind=redirects"
      );
      setRedirects(Array.isArray(data) ? data : []);
    } catch (error) {
      setRedirectsError(true);
      toast({
        title: "Chargement des redirections impossible",
        description: errorMessage(error),
        variant: "destructive",
      });
    }
  }, [toast]);

  function handleTabChange(value: string) {
    setTab(value);
    if (value === "redirects" && !redirectsRequested.current) {
      redirectsRequested.current = true;
      void loadRedirects();
    }
  }

  function submitRedirect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const source = redirectForm.source_path.trim();
    const target = redirectForm.target_path.trim();
    if (!source.startsWith("/") || source.length < 2) {
      setRedirectError("Le chemin source doit commencer par « / ».");
      return;
    }
    if (!target.startsWith("/") || target.length < 2) {
      setRedirectError("Le chemin cible doit commencer par « / ».");
      return;
    }
    if (source === target) {
      setRedirectError("Le chemin cible doit différer du chemin source.");
      return;
    }
    setRedirectError("");
    void createRedirect(source, target);
  }

  async function createRedirect(source: string, target: string) {
    setRedirectSaving(true);
    try {
      await apiFetch("/api/admin/banners", {
        method: "POST",
        json: {
          kind: "redirect",
          source_path: source,
          target_path: target,
          status_code: Number(redirectForm.status_code),
        },
      });
      toast({ title: "Redirection créée." });
      setRedirectForm((f) => ({
        ...f,
        source_path: "",
        target_path: "",
      }));
      await loadRedirects();
    } catch (error) {
      toast({
        title: "Création impossible",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setRedirectSaving(false);
    }
  }

  async function confirmDeleteRedirect() {
    if (!redirectDeleting) return;
    setRedirectDeleteBusy(true);
    try {
      await apiFetch(
        `/api/admin/banners?kind=redirect&id=${encodeURIComponent(redirectDeleting.id)}`,
        { method: "DELETE" }
      );
      toast({ title: "Redirection supprimée." });
      setRedirectDeleting(null);
      await loadRedirects();
    } catch (error) {
      toast({
        title: "Suppression impossible",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setRedirectDeleteBusy(false);
    }
  }

  // ── Rendu ────────────────────────────────────────────────────────────────

  const refTarget: RefTarget | null = isRefTarget(itemForm.target_type)
    ? itemForm.target_type
    : null;
  const refState = refTarget ? refs[REF_SOURCES[refTarget].kind] : null;
  const refOptions = useMemo<RefItem[]>(() => {
    if (!refState) return [];
    const options = [...refState.items];
    if (
      itemForm.target_id &&
      !options.some((option) => option.id === itemForm.target_id)
    ) {
      options.unshift({ id: itemForm.target_id, label: "Valeur actuelle" });
    }
    return options;
  }, [refState, itemForm.target_id]);

  const rows = useMemo(() => flattenItems(items), [items]);

  // ── Glisser-déposer (@dnd-kit, §11.2) ──────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const rowIds = useMemo(() => rows.map(({ item }) => item.id), [rows]);
  const activeDragItem = activeDragId
    ? (items.find((item) => item.id === activeDragId) ?? null)
    : null;
  const hintOverItem = dropHint
    ? (items.find((item) => item.id === dropHint.id) ?? null)
    : null;
  const dragIntent =
    dropHint && hintOverItem
      ? dropHint.mode === "child"
        ? `Sera imbriqué sous « ${hintOverItem.label} »`
        : dropHint.mode === "before"
          ? `Sera placé avant « ${hintOverItem.label} »`
          : `Sera placé après « ${hintOverItem.label} »`
      : null;

  function itemLabel(id: unknown): string {
    return items.find((item) => item.id === String(id))?.label ?? "élément";
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
    setDropHint(null);
  }

  function handleDragOver(event: DragOverEvent) {
    const next = resolveDrop(
      String(event.active.id),
      event.over ? String(event.over.id) : undefined,
      pointerYOf(event),
      event.over
        ? { top: event.over.rect.top, height: event.over.rect.height }
        : null,
      rowIds,
      items
    );
    setDropHint((prev) =>
      prev?.id === next?.id && prev?.mode === next?.mode ? prev : next
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const hint = resolveDrop(
      String(event.active.id),
      event.over ? String(event.over.id) : undefined,
      pointerYOf(event),
      event.over
        ? { top: event.over.rect.top, height: event.over.rect.height }
        : null,
      rowIds,
      items
    );
    setActiveDragId(null);
    setDropHint(null);
    if (!hint || saving) return;
    const activeId = String(event.active.id);
    const next = applyDrop(items, activeId, hint);
    if (!next || JSON.stringify(buildPayload(next)) === currentPayload) return;
    const previous = items;
    setItems(next);
    void persistOrder(next, previous);
  }

  function handleDragCancel() {
    setActiveDragId(null);
    setDropHint(null);
  }

  return (
    <>
      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList aria-label="Sections de l'écran">
          <TabsTrigger value="menus">Menus</TabsTrigger>
          <TabsTrigger value="redirects">Redirections</TabsTrigger>
        </TabsList>

        {/* ── Onglet Menus ─────────────────────────────────────────────── */}
        <TabsContent value="menus" className="space-y-4">
          {menus === null ? (
            menusError ? (
              <section className="border border-rule bg-paper">
                <LoadErrorCard onRetry={() => void loadMenus()} />
              </section>
            ) : (
              <ListSkeleton />
            )
          ) : menus.length === 0 ? (
            <section className="border border-rule bg-paper">
              <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
                <ListTree className="h-8 w-8 text-ink-faint" aria-hidden />
                <p className="text-sm text-ink-soft">
                  Aucun menu configuré. Exécutez le jeu de données initial pour
                  créer les zones de navigation.
                </p>
              </div>
            </section>
          ) : (
            <section
              aria-label="Édition du menu"
              className="border border-rule bg-paper"
            >
              <div className="flex flex-col gap-3 border-b border-rule px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={selectedKey} onValueChange={selectMenu}>
                    <SelectTrigger
                      className="w-full sm:w-64"
                      aria-label="Menu à éditer"
                    >
                      <SelectValue placeholder="Choisir un menu" />
                    </SelectTrigger>
                    <SelectContent>
                      {menus.map((menu) => (
                        <SelectItem key={menu.key} value={menu.key}>
                          {menu.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <code className="font-mono text-xs text-ink-faint">
                    {selectedMenu?.key}
                  </code>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="inline-flex items-center gap-1.5 text-xs"
                    role="status"
                  >
                    {dirty ? (
                      <>
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-warning"
                          aria-hidden
                        />
                        <span className="font-medium text-warning">
                          Modifications non enregistrées
                        </span>
                      </>
                    ) : (
                      <span className="text-ink-faint">À jour</span>
                    )}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={openItemCreate}
                    disabled={saving}
                  >
                    <Plus aria-hidden />
                    Élément
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void saveMenu()}
                    disabled={saving || !dirty}
                  >
                    {saving ? (
                      <Loader2 className="animate-spin" aria-hidden />
                    ) : (
                      <Save aria-hidden />
                    )}
                    Enregistrer
                  </Button>
                </div>
              </div>

              {rows.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
                  <ListTree className="h-8 w-8 text-ink-faint" aria-hidden />
                  <p className="text-sm text-ink-soft">
                    Ce menu est vide. Ajoutez un premier élément de navigation.
                  </p>
                  <Button size="sm" variant="outline" onClick={openItemCreate}>
                    <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                    Élément
                  </Button>
                </div>
              ) : (
                <>
                  <p className="border-b border-rule bg-paper-alt/50 px-4 py-2 text-xs text-ink-faint">
                    <GripVertical
                      className="mr-1 inline h-3.5 w-3.5"
                      aria-hidden
                    />
                    Réorganisez par glisser-déposer : bords haut/bas = même
                    niveau, centre = sous-élément. Les flèches conservent les
                    mêmes actions au clavier.
                  </p>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                    accessibility={{
                      screenReaderInstructions: {
                        draggable:
                          "Pour déplacer un élément : appuyez sur Espace ou Entrée pour le saisir via sa poignée, déplacez-le avec les flèches, puis appuyez sur Espace ou Entrée pour le déposer, ou Échap pour annuler.",
                      },
                      announcements: {
                        onDragStart: ({ active }) =>
                          `Déplacement de « ${itemLabel(active.id)} ». Bords de ligne : même niveau. Centre : sous-élément.`,
                        onDragOver: ({ active, over }) => {
                          if (!over) {
                            return "Aucune destination valide.";
                          }
                          const hint =
                            dropHint?.id === String(over.id)
                              ? dropHint.mode
                              : null;
                          if (hint === "child") {
                            return `Relâchez pour imbriquer « ${itemLabel(active.id)} » sous « ${itemLabel(over.id)} ».`;
                          }
                          if (hint === "before") {
                            return `Relâchez pour placer « ${itemLabel(active.id)} » avant « ${itemLabel(over.id)} ».`;
                          }
                          if (hint === "after") {
                            return `Relâchez pour placer « ${itemLabel(active.id)} » après « ${itemLabel(over.id)} ».`;
                          }
                          return "Aucune destination valide.";
                        },
                        onDragEnd: ({ active, over }) =>
                          over
                            ? `« ${itemLabel(active.id)} » déposé.`
                            : "Déplacement terminé sans destination.",
                        onDragCancel: ({ active }) =>
                          `Déplacement de « ${itemLabel(active.id)} » annulé.`,
                      },
                    }}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                    onDragCancel={handleDragCancel}
                  >
                    <div className="max-h-[30rem] overflow-y-auto">
                      <SortableContext
                        items={rowIds}
                        strategy={verticalListSortingStrategy}
                      >
                        <ol className="divide-y divide-rule">
                          {rows.map(({ item, depth, sibIndex, sibCount }) => (
                            <SortableMenuRow
                              key={item.id}
                              item={item}
                              depth={depth}
                              sibIndex={sibIndex}
                              sibCount={sibCount}
                              summary={targetSummary(item)}
                              hint={dropHint?.id === item.id ? dropHint : null}
                              saving={saving}
                              onMove={moveItem}
                              onToggleVisible={toggleVisible}
                              onEdit={openItemEdit}
                              onRemove={removeItem}
                            />
                          ))}
                        </ol>
                      </SortableContext>
                    </div>
                    <DragOverlay>
                      {activeDragItem ? (
                        <DragGhost
                          item={activeDragItem}
                          summary={targetSummary(activeDragItem)}
                          intent={dragIntent}
                        />
                      ) : null}
                    </DragOverlay>
                  </DndContext>
                </>
              )}
            </section>
          )}
        </TabsContent>

        {/* ── Onglet Redirections ──────────────────────────────────────── */}
        <TabsContent value="redirects" className="space-y-4">
          <section
            aria-label="Créer une redirection"
            className="border border-rule bg-paper p-4 lg:p-6"
          >
            <h2 className="font-serif text-lg font-semibold">
              Nouvelle redirection
            </h2>
            <p className="mt-1 flex items-start gap-1.5 text-xs text-ink-faint">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Les renommages de rubriques créent automatiquement des
              redirections 301.
            </p>
            <form
              className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto]"
              onSubmit={submitRedirect}
              noValidate
            >
              <div className="space-y-1.5">
                <Label htmlFor="redirect-source">
                  Chemin source <span className="text-brand-red">*</span>
                </Label>
                <Input
                  id="redirect-source"
                  value={redirectForm.source_path}
                  onChange={(e) =>
                    setRedirectForm((f) => ({
                      ...f,
                      source_path: e.target.value,
                    }))
                  }
                  placeholder="/ancienne-adresse"
                  className="font-mono"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="redirect-target">
                  Chemin cible <span className="text-brand-red">*</span>
                </Label>
                <Input
                  id="redirect-target"
                  value={redirectForm.target_path}
                  onChange={(e) =>
                    setRedirectForm((f) => ({
                      ...f,
                      target_path: e.target.value,
                    }))
                  }
                  placeholder="/nouvelle-adresse"
                  className="font-mono"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="redirect-status">Type</Label>
                <Select
                  value={redirectForm.status_code}
                  onValueChange={(value) =>
                    setRedirectForm((f) => ({ ...f, status_code: value }))
                  }
                >
                  <SelectTrigger
                    id="redirect-status"
                    className="w-full lg:w-40"
                    aria-label="Type de redirection"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="301">301 — Permanente</SelectItem>
                    <SelectItem value="302">302 — Temporaire</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  type="submit"
                  disabled={redirectSaving}
                  className="w-full lg:w-auto"
                >
                  {redirectSaving ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <Plus aria-hidden />
                  )}
                  Créer
                </Button>
              </div>
            </form>
            {redirectError ? (
              <p role="alert" className="mt-2 text-sm text-danger">
                {redirectError}
              </p>
            ) : null}
          </section>

          <section
            aria-label="Liste des redirections"
            className="border border-rule bg-paper"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3">
              <div>
                <h2 className="font-serif text-lg font-semibold">
                  Redirections actives
                </h2>
                <p className="text-xs text-ink-faint">
                  {redirects === null
                    ? "Chargement…"
                    : `${redirects.length} redirection${redirects.length > 1 ? "s" : ""}`}
                </p>
              </div>
            </div>

            {redirects === null ? (
              redirectsError ? (
                <LoadErrorCard onRetry={() => void loadRedirects()} />
              ) : (
                <ListSkeleton />
              )
            ) : redirects.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
                <ArrowRight className="h-8 w-8 text-ink-faint" aria-hidden />
                <p className="text-sm text-ink-soft">
                  Aucune redirection. Créez-en une pour préserver le référencement
                  des adresses déplacées.
                </p>
              </div>
            ) : (
              <div className="max-h-[30rem] overflow-y-auto">
                <ul className="divide-y divide-rule">
                  {redirects.map((redirect) => (
                    <li
                      key={redirect.id}
                      className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-paper-alt sm:flex-row sm:items-center sm:gap-4"
                    >
                      <p className="min-w-0 flex-1 truncate font-mono text-sm">
                        <span>{redirect.source_path}</span>
                        <ArrowRight
                          className="mx-2 inline h-3.5 w-3.5 text-ink-faint"
                          aria-hidden
                        />
                        <span className="text-ink-soft">
                          {redirect.target_path}
                        </span>
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          {redirect.status_code}
                        </Badge>
                        <span className="text-xs tabular-nums text-ink-faint">
                          {Number(redirect.hit_count).toLocaleString("fr-FR")}{" "}
                          accès
                        </span>
                        {redirect.is_auto ? (
                          <Badge className="border-rule bg-paper-sunk text-ink-soft">
                            Auto
                          </Badge>
                        ) : null}
                        <span className="hidden text-xs text-ink-faint lg:inline">
                          {formatDate(redirect.created_at)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-danger hover:bg-red-wash hover:text-danger"
                          onClick={() => setRedirectDeleting(redirect)}
                          aria-label={`Supprimer la redirection ${redirect.source_path}`}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </TabsContent>
      </Tabs>

      {/* ── Dialogue élément de menu (création / édition) ─────────────── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) setDialogOpen(false);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create"
                ? "Ajouter un élément"
                : "Modifier l'élément"}
            </DialogTitle>
            <DialogDescription>
              Destination, apparence et visibilité dans le menu «{" "}
              {selectedMenu?.label ?? ""} ».
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="item-label">
                Libellé <span className="text-brand-red">*</span>
              </Label>
              <Input
                id="item-label"
                value={itemForm.label}
                onChange={(e) =>
                  setItemForm((f) => ({ ...f, label: e.target.value }))
                }
                placeholder="Ex. : Politique"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="item-target-type">Type de destination</Label>
              <Select
                value={itemForm.target_type}
                onValueChange={(value) =>
                  setItemForm((f) => ({
                    ...f,
                    target_type: value as TargetType,
                    target_id: "",
                    target_url: "",
                  }))
                }
              >
                <SelectTrigger
                  id="item-target-type"
                  aria-label="Type de destination"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {refTarget && refState ? (
              refState.status === "loading" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="item-target">Destination</Label>
                  <div
                    className="flex h-9 items-center gap-2 rounded-md border border-input px-3 text-sm text-ink-faint"
                    aria-live="polite"
                  >
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin"
                      aria-hidden
                    />
                    Chargement de la liste…
                  </div>
                </div>
              ) : refState.status === "error" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="item-target">Destination</Label>
                  <div className="flex items-center justify-between gap-2 rounded-md border border-input px-3 py-2 text-sm">
                    <span className="text-danger">
                      Liste indisponible.
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void ensureRef(refTarget)}
                    >
                      <RotateCw className="mr-1 h-3.5 w-3.5" aria-hidden />
                      Réessayer
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="item-target">
                    Destination{" "}
                    <span className="text-brand-red">*</span>
                  </Label>
                  <Select
                    value={itemForm.target_id}
                    onValueChange={(value) =>
                      setItemForm((f) => ({ ...f, target_id: value }))
                    }
                  >
                    <SelectTrigger
                      id="item-target"
                      aria-label={`Choisir la ${REF_TARGET_LABELS[refTarget]} de destination`}
                    >
                      <SelectValue placeholder="Sélectionner…" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {refOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                          {option.hint ? ` · /${option.hint}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {refOptions.length === 0 ? (
                    <p className="text-xs text-ink-faint">
                      Aucune {REF_TARGET_LABELS[refTarget]} disponible.
                    </p>
                  ) : null}
                </div>
              )
            ) : null}

            {itemForm.target_type === "url" ? (
              <div className="space-y-1.5">
                <Label htmlFor="item-url">
                  URL de destination <span className="text-brand-red">*</span>
                </Label>
                <Input
                  id="item-url"
                  value={itemForm.target_url}
                  onChange={(e) =>
                    setItemForm((f) => ({ ...f, target_url: e.target.value }))
                  }
                  placeholder="https://exemple.com ou /chemin-interne"
                  className="font-mono"
                />
              </div>
            ) : null}

            {itemForm.target_type === "section" ? (
              <p className="text-xs text-ink-faint">
                Cible gérée par le thème : section de la page d&apos;accueil.
                Aucun champ supplémentaire requis.
              </p>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="item-parent">Emplacement</Label>
              <Select
                value={itemForm.parent_id}
                onValueChange={(value) =>
                  setItemForm((f) => ({ ...f, parent_id: value }))
                }
                disabled={editingHasChildren}
              >
                <SelectTrigger id="item-parent" aria-label="Élément parent">
                  <SelectValue placeholder="Racine du menu" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">Racine du menu</SelectItem>
                  {parentOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editingHasChildren ? (
                <p className="text-xs text-ink-faint">
                  Cet élément contient des sous-éléments : il doit rester à la
                  racine (profondeur maximale : 2 niveaux).
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="item-icon">Icône (facultatif)</Label>
              <Input
                id="item-icon"
                value={itemForm.icon}
                onChange={(e) =>
                  setItemForm((f) => ({ ...f, icon: e.target.value }))
                }
                placeholder="Ex. : house, newspaper, flame"
              />
              <p className="text-xs text-ink-faint">
                Nom d&apos;icône Lucide, sans préfixe.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex items-center justify-between gap-2 rounded-md border border-rule p-3">
                <Label
                  htmlFor="item-new-tab"
                  className="text-xs font-normal leading-tight"
                >
                  Nouvel onglet
                </Label>
                <Switch
                  id="item-new-tab"
                  checked={itemForm.open_new_tab}
                  onCheckedChange={(checked) =>
                    setItemForm((f) => ({ ...f, open_new_tab: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border border-rule p-3">
                <Label
                  htmlFor="item-highlight"
                  className="text-xs font-normal leading-tight"
                >
                  Mise en avant (CTA rouge)
                </Label>
                <Switch
                  id="item-highlight"
                  checked={itemForm.highlight}
                  onCheckedChange={(checked) =>
                    setItemForm((f) => ({ ...f, highlight: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border border-rule p-3">
                <Label
                  htmlFor="item-visible"
                  className="text-xs font-normal leading-tight"
                >
                  Visible
                </Label>
                <Switch
                  id="item-visible"
                  checked={itemForm.is_visible}
                  onCheckedChange={(checked) =>
                    setItemForm((f) => ({ ...f, is_visible: checked }))
                  }
                />
              </div>
            </div>

            {itemError ? (
              <p role="alert" className="text-sm text-danger">
                {itemError}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button onClick={saveItem}>
              {dialogMode === "create" ? "Ajouter" : "Appliquer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirmation de suppression (redirection) ─────────────────── */}
      <AlertDialog
        open={redirectDeleting !== null}
        onOpenChange={(open) => {
          if (!open) setRedirectDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette redirection ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les visiteurs qui suivront le lien «{" "}
              {redirectDeleting?.source_path} » recevront à nouveau une erreur
              404. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={redirectDeleteBusy}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              disabled={redirectDeleteBusy}
              onClick={(e) => {
                e.preventDefault();
                void confirmDeleteRedirect();
              }}
            >
              {redirectDeleteBusy ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : null}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Ligne triable (dnd-kit) ────────────────────────────────────────────────

interface SortableMenuRowProps {
  item: MenuItem;
  depth: 0 | 1;
  sibIndex: number;
  sibCount: number;
  summary: string;
  /** Indicateur de dépôt actif sur cette ligne (survol du glissement). */
  hint: DropHint | null;
  saving: boolean;
  onMove: (id: string, direction: -1 | 1) => void;
  onToggleVisible: (id: string) => void;
  onEdit: (item: MenuItem) => void;
  onRemove: (id: string) => void;
}

function SortableMenuRow({
  item,
  depth,
  sibIndex,
  sibCount,
  summary,
  hint,
  saving,
  onMove,
  onToggleVisible,
  onEdit,
  onRemove,
}: SortableMenuRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } =
    useSortable({ id: item.id, disabled: saving });

  return (
    <li
      ref={setNodeRef}
      className={cn(
        "relative flex items-center gap-2 px-3 py-2.5 transition-colors hover:bg-paper-alt",
        depth === 1 && "bg-paper-alt/60",
        isDragging && "opacity-40"
      )}
    >
      {/* Zones de dépôt visibles au survol (§11.2 : tri + ré-attachement) */}
      {hint?.mode === "before" ? (
        <span
          aria-hidden
          className="absolute inset-x-2 top-0 z-10 h-0.5 rounded-full bg-brand-red"
        />
      ) : null}
      {hint?.mode === "after" ? (
        <span
          aria-hidden
          className="absolute inset-x-2 bottom-0 z-10 h-0.5 rounded-full bg-brand-red"
        />
      ) : null}
      {hint?.mode === "child" ? (
        <span
          aria-hidden
          className="absolute inset-x-2 inset-y-0.5 z-10 flex items-center justify-center rounded-md border-2 border-dashed border-brand-red bg-red-wash/80"
        >
          <span className="rounded-full bg-brand-red px-2 py-0.5 text-[10px] font-semibold text-white">
            Déposer ici : sous-élément de « {item.label} »
          </span>
        </span>
      ) : null}

      <span className="flex w-6 shrink-0 justify-center" aria-hidden>
        {depth === 1 ? (
          <CornerDownRight className="h-4 w-4 text-ink-faint" />
        ) : null}
      </span>
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        disabled={saving}
        className="cursor-grab touch-none rounded-sm p-1 text-ink-faint hover:bg-paper-sunk hover:text-ink active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={`Glisser pour déplacer « ${item.label} »`}
        title="Glisser pour déplacer — bords : même niveau · centre : sous-élément"
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "truncate text-sm",
              depth === 0 ? "font-semibold" : "font-normal text-ink-soft"
            )}
          >
            {item.label}
          </span>
          {item.highlight ? (
            <Badge className="border-red-bright/30 bg-red-wash text-brand-red">
              CTA
            </Badge>
          ) : null}
          {!item.is_visible ? (
            <Badge variant="outline" className="text-ink-faint">
              <EyeOff className="mr-1 h-3 w-3" aria-hidden />
              Masqué
            </Badge>
          ) : null}
          {item.icon ? (
            <code className="font-mono text-[10px] text-ink-faint">
              {item.icon}
            </code>
          ) : null}
        </div>
        <p className="truncate text-xs text-ink-faint">
          {summary}
          {item.open_new_tab ? " · nouvel onglet" : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onMove(item.id, -1)}
          disabled={sibIndex === 0}
          aria-label={`Monter « ${item.label} »`}
        >
          <ChevronUp aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onMove(item.id, 1)}
          disabled={sibIndex === sibCount - 1}
          aria-label={`Descendre « ${item.label} »`}
        >
          <ChevronDown aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onToggleVisible(item.id)}
          aria-label={
            item.is_visible
              ? `Masquer « ${item.label} »`
              : `Rendre visible « ${item.label} »`
          }
        >
          {item.is_visible ? (
            <Eye aria-hidden />
          ) : (
            <EyeOff className="text-ink-faint" aria-hidden />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onEdit(item)}
          aria-label={`Modifier « ${item.label} »`}
        >
          <Pencil aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-danger hover:bg-red-wash hover:text-danger"
          onClick={() => onRemove(item.id)}
          aria-label={`Supprimer « ${item.label} »`}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
    </li>
  );
}

// ─── Fantôme de glissement (DragOverlay) ───────────────────────────────────

function DragGhost({
  item,
  summary,
  intent,
}: {
  item: MenuItem;
  summary: string;
  intent: string | null;
}) {
  return (
    <div className="flex items-center gap-2 border border-rule bg-paper px-3 py-2.5 shadow-lg">
      <GripVertical className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold">{item.label}</span>
          {item.highlight ? (
            <Badge className="border-red-bright/30 bg-red-wash text-brand-red">
              CTA
            </Badge>
          ) : null}
          {!item.is_visible ? (
            <Badge variant="outline" className="text-ink-faint">
              <EyeOff className="mr-1 h-3 w-3" aria-hidden />
              Masqué
            </Badge>
          ) : null}
        </div>
        <p className="truncate text-xs text-ink-faint">{summary}</p>
        {intent ? (
          <p className="mt-0.5 text-xs font-medium text-brand-red">{intent}</p>
        ) : null}
      </div>
    </div>
  );
}
