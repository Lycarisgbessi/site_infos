"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MediaPicker, type MediaItem } from "@/components/admin/MediaPicker";
import { RichTextEditor } from "./RichTextEditor";
import { apiFetch, errorMessage } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import {
  GripVertical, Plus, Copy, Trash2, ChevronUp, ChevronDown, Image as ImageIcon, Wrench,
} from "lucide-react";
import type { Block, RichText } from "@/types/blocks";
import { newBlockId } from "@/lib/blocks";

/**
 * Éditeur de blocs (§06.4 + §11.2) : liste réordonnable (glisser-déposer),
 * insertion par menu (toujours accessible) ou « / » en tête de paragraphe,
 * duplication, verrouillage de bloc, suppression.
 * Chaque type de bloc dispose de son éditeur dédié.
 */

const BLOCK_LABELS: Record<Block["type"], string> = {
  paragraph: "Paragraphe",
  heading: "Titre intermédiaire",
  list: "Liste",
  quote: "Citation",
  pullquote: "Citation mise en exergue",
  keypoints: "À retenir",
  image: "Image",
  gallery: "Galerie",
  video: "Vidéo",
  audio: "Audio",
  table: "Tableau",
  embed: "Intégration (réseaux)",
  chart: "Graphique",
  map: "Carte",
  timeline: "Chronologie",
  beforeafter: "Avant / Après",
  definition: "Définition",
  readmore: "À lire aussi",
  qa: "Question / Réponse",
  factcheck: "Vérification des faits",
  divider: "Séparateur",
  code: "Code",
  newsletter: "Bloc newsletter",
  ad: "Emplacement publicitaire",
};

const INSERTABLE: Block["type"][] = [
  "paragraph", "heading", "list", "quote", "pullquote", "keypoints",
  "image", "gallery", "video", "audio", "table", "embed", "chart",
  "map", "timeline", "beforeafter", "definition", "readmore", "qa",
  "factcheck", "divider", "code", "newsletter", "ad",
];

export function createEmptyBlock(type: Block["type"]): Block {
  const id = newBlockId();
  switch (type) {
    case "paragraph": return { id, type, text: [{ text: "" }] };
    case "heading": return { id, type, level: 2, text: "" };
    case "list": return { id, type, style: "bullet", items: [[{ text: "" }]] };
    case "quote": return { id, type, text: "", author: "", role: "" };
    case "pullquote": return { id, type, text: "", author: "" };
    case "keypoints": return { id, type, title: "À retenir", items: [""] };
    case "image": return { id, type, mediaId: "", size: "inline", caption: "" };
    case "gallery": return { id, type, mediaIds: [], layout: "grid" };
    case "video": return { id, type, provider: "youtube", playbackId: "", caption: "" };
    case "audio": return { id, type, mediaId: "", title: "" };
    case "table": return { id, type, headers: ["", ""], rows: [["", ""]], caption: "", source: "" };
    case "embed": return { id, type, provider: "youtube", url: "" };
    case "chart": return { id, type, chartType: "bar", data: [], source: "", updatedAt: new Date().toISOString().slice(0, 10) };
    case "map": return { id, type, lat: 9.6412, lng: -13.5784, zoom: 12 };
    case "timeline": return { id, type, events: [{ date: "", title: "" }] };
    case "beforeafter": return { id, type, beforeMediaId: "", afterMediaId: "", labels: ["Avant", "Après"] };
    case "definition": return { id, type, term: "", definition: "" };
    case "readmore": return { id, type, articleIds: [] };
    case "qa": return { id, type, question: "", answer: [{ text: "" }] };
    case "factcheck": return { id, type, claim: "", verdict: "unverifiable", explanation: "", sources: [] };
    case "divider": return { id, type };
    case "code": return { id, type, language: "text", code: "" };
    case "newsletter": return { id, type, listKey: "daily" };
    case "ad": return { id, type, slotCode: "AD-04" };
  }
}

export interface BlockEditorProps {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  lockedBlocks?: Set<string>;
  onToggleLock?: (blockId: string) => void;
}

export function BlockEditor({ blocks, onChange, lockedBlocks, onToggleLock }: BlockEditorProps) {
  const { toast } = useToast();
  const [pickerState, setPickerState] = useState<
    | null
    | { kind: "image"; blockId: string }
    | { kind: "gallery"; blockId: string }
    | { kind: "video"; blockId: string }
    | { kind: "audio"; blockId: string }
    | { kind: "beforeafter"; blockId: string; side: "before" | "after" }
  >(null);
  const [insertOpen, setInsertOpen] = useState(false);

  // ── Collage intelligent Word / Google Docs (§11.2, §20 Phase 2 tâche 10)
  const importingRef = useRef(false);
  const [importing, setImporting] = useState(false);
  const importClipboardHtml = useCallback(
    async (html: string) => {
      importingRef.current = true;
      setImporting(true);
      try {
        const { data } = await apiFetch<{ blocks: Block[]; warnings: string[] }>(
          "/api/admin/articles/import",
          { method: "POST", json: { html } }
        );
        if (data.blocks.length === 0) {
          toast({ title: "Rien à importer", description: "Le presse-papiers ne contient pas de contenu exploitable." });
          return;
        }
        onChange([...blocks, ...data.blocks]);
        toast({
          title: `${data.blocks.length} bloc(s) importé(s) depuis le presse-papiers`,
          description:
            data.warnings.length > 0
              ? `${data.warnings.length} avertissement(s) — ${data.warnings[0]}`
              : "Collage converti proprement en blocs.",
        });
      } catch (error) {
        toast({ title: "Collage impossible", description: errorMessage(error), variant: "destructive" });
      } finally {
        importingRef.current = false;
        setImporting(false);
      }
    },
    [blocks, onChange, toast]
  );
  const onRootPaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      if (importingRef.current) {
        event.preventDefault();
        return;
      }
      const html = event.clipboardData?.getData("text/html");
      if (!html) return; // collage simple : comportement par défaut
      const isOfficeHtml =
        /urn:schemas-microsoft-com:office|<!--StartFragment-->|class="?Mso|docs-internal-guid/i.test(html);
      if (!isOfficeHtml) return; // HTML hors Word/Docs : comportement par défaut
      event.preventDefault();
      void importClipboardHtml(html);
    },
    [importClipboardHtml]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const update = useCallback(
    (blockId: string, patch: Partial<Block>) => {
      onChange(blocks.map((b) => (b.id === blockId ? ({ ...b, ...patch } as Block) : b)));
    },
    [blocks, onChange]
  );

  const insert = useCallback(
    (type: Block["type"], afterIndex?: number) => {
      const block = createEmptyBlock(type);
      const idx = afterIndex === undefined ? blocks.length : afterIndex + 1;
      const next = [...blocks.slice(0, idx), block, ...blocks.slice(idx)];
      onChange(next);
      setInsertOpen(false);
    },
    [blocks, onChange]
  );

  const remove = useCallback(
    (blockId: string) => onChange(blocks.filter((b) => b.id !== blockId)),
    [blocks, onChange]
  );

  const duplicate = useCallback(
    (blockId: string) => {
      const idx = blocks.findIndex((b) => b.id === blockId);
      if (idx === -1) return;
      const source = blocks[idx];
      const copy: Block = JSON.parse(JSON.stringify(source));
      copy.id = newBlockId();
      onChange([...blocks.slice(0, idx + 1), copy, ...blocks.slice(idx + 1)]);
    },
    [blocks, onChange]
  );

  const move = useCallback(
    (blockId: string, dir: -1 | 1) => {
      const idx = blocks.findIndex((b) => b.id === blockId);
      const target = idx + dir;
      if (idx === -1 || target < 0 || target >= blocks.length) return;
      const next = [...blocks];
      [next[idx], next[target]] = [next[target], next[idx]];
      onChange(next);
    },
    [blocks, onChange]
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const from = blocks.findIndex((b) => b.id === active.id);
      const to = blocks.findIndex((b) => b.id === over.id);
      if (from === -1 || to === -1) return;
      const next = [...blocks];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      onChange(next);
    },
    [blocks, onChange]
  );

  const picker = useMemo(() => {
    if (!pickerState) return null;
    const target = blocks.find((b) => b.id === pickerState.blockId);
    return (
      <MediaPicker
        open
        onOpenChange={(open) => !open && setPickerState(null)}
        onSelect={(media: MediaItem) => {
          if (!target) return;
          if (pickerState.kind === "image") update(target.id, { mediaId: media.id } as Partial<Block>);
          if (pickerState.kind === "audio") update(target.id, { mediaId: media.id } as Partial<Block>);
          if (pickerState.kind === "video") update(target.id, { mediaId: media.id } as Partial<Block>);
          if (pickerState.kind === "beforeafter") {
            update(target.id, {
              [pickerState.side === "before" ? "beforeMediaId" : "afterMediaId"]: media.id,
            } as Partial<Block>);
          }
          setPickerState(null);
        }}
        filterType={pickerState.kind === "gallery" ? undefined : pickerState.kind === "audio" ? "audio" : pickerState.kind === "video" ? "video" : "image"}
        title={pickerState.kind === "gallery" ? "Sélection multiple — composez la galerie" : "Choisir un média"}
      />
    );
  }, [pickerState, blocks, update]);

  const handleGallerySelect = (blockId: string, media: MediaItem) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block || block.type !== "gallery") return;
    if (!block.mediaIds.includes(media.id)) {
      update(blockId, { mediaIds: [...block.mediaIds, media.id] });
    }
  };
  void handleGallerySelect;

  return (
    <div className="space-y-3" onPaste={onRootPaste}>
      {importing && (
        <p className="flex items-center gap-2 text-xs text-ink-soft" role="status">
          <span className="inline-block size-2 animate-pulse rounded-full bg-brand-red" aria-hidden />
          Conversion du collage en blocs…
        </p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis]}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {blocks.map((block, index) => (
            <SortableBlockRow
              key={block.id}
              block={block}
              index={index}
              locked={lockedBlocks?.has(block.id) ?? false}
              onToggleLock={onToggleLock}
              onUpdate={(patch) => update(block.id, patch)}
              onRemove={() => remove(block.id)}
              onDuplicate={() => duplicate(block.id)}
              onMove={(dir) => move(block.id, dir)}
              onOpenPicker={(kind, side) => setPickerState({ kind, blockId: block.id, ...(side ? { side } : {}) } as typeof pickerState)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {blocks.length === 0 && (
        <p className="rounded-sm border border-dashed border-rule p-6 text-center text-sm text-ink-faint">
          Corps vide — insérez votre premier bloc ci-dessous.
        </p>
      )}

      <div className="flex items-center gap-2">
        <Popover open={insertOpen} onOpenChange={setInsertOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Plus className="mr-1 size-4" aria-hidden /> Insérer un bloc
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-1" align="start">
            <div className="max-h-80 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
              {INSERTABLE.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => insert(type)}
                  className="block w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-paper-alt"
                >
                  {BLOCK_LABELS[type]}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <span className="text-xs text-ink-faint">
          Astuce : tapez « / » en début de paragraphe pour ouvrir ce menu.
        </span>
      </div>

      {picker}
    </div>
  );
}

// ─── Ligne de bloc triable ─────────────────────────────────────────────

interface SortableBlockRowProps {
  block: Block;
  index: number;
  locked: boolean;
  onToggleLock?: (blockId: string) => void;
  onUpdate: (patch: Partial<Block>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (dir: -1 | 1) => void;
  onOpenPicker: (
    kind: "image" | "gallery" | "video" | "audio" | "beforeafter",
    side?: "before" | "after"
  ) => void;
}

function SortableBlockRow({
  block, index, locked, onToggleLock, onUpdate, onRemove, onDuplicate, onMove, onOpenPicker,
}: SortableBlockRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id, disabled: locked });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative rounded-sm border border-rule bg-paper ${isDragging ? "z-20 shadow-lg" : ""} ${locked ? "opacity-90 ring-1 ring-brand-red" : ""}`}
    >
      <div className="flex items-center justify-between border-b border-rule bg-paper-alt px-2 py-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            {...attributes}
            {...listeners}
            disabled={locked}
            aria-label="Réordonner le bloc"
            className="cursor-grab rounded-sm p-1 text-ink-faint hover:bg-rule active:cursor-grabbing"
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
          <span className="text-xs font-semibold tracking-wide text-ink-soft">
            {index + 1}. {BLOCK_LABELS[block.type]}
          </span>
        </div>
        <div className="flex items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
          <button type="button" onClick={() => onMove(-1)} aria-label="Monter" className="rounded-sm p-1 hover:bg-rule"><ChevronUp className="size-3.5" aria-hidden /></button>
          <button type="button" onClick={() => onMove(1)} aria-label="Descendre" className="rounded-sm p-1 hover:bg-rule"><ChevronDown className="size-3.5" aria-hidden /></button>
          <button type="button" onClick={() => onDuplicate()} aria-label="Dupliquer" className="rounded-sm p-1 hover:bg-rule"><Copy className="size-3.5" aria-hidden /></button>
          {onToggleLock && (
            <button
              type="button"
              onClick={() => onToggleLock(block.id)}
              aria-label={locked ? "Déverrouiller le bloc" : "Verrouiller le bloc"}
              aria-pressed={locked}
              className="rounded-sm p-1 hover:bg-rule"
            >
              <Wrench className={`size-3.5 ${locked ? "text-brand-red" : ""}`} aria-hidden />
            </button>
          )}
          <button type="button" onClick={onRemove} aria-label="Supprimer le bloc" className="rounded-sm p-1 hover:bg-rule hover:text-brand-red">
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>
      <div className="p-3">
        {block.type === "paragraph" && (
          <ParagraphEditor
            value={block.text}
            onChange={(text) => onUpdate({ text })}
            onSlashCommand={() => {
              const trigger = document.querySelector<HTMLButtonElement>("[data-insert-menu]");
              trigger?.click();
            }}
          />
        )}
        {block.type === "heading" && (
          <div className="flex gap-2">
            <Select value={String(block.level)} onValueChange={(v) => onUpdate({ level: Number(v) as 2 | 3 | 4 } as Partial<Block>)}>
              <SelectTrigger className="w-24" aria-label="Niveau de titre"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2">H2</SelectItem>
                <SelectItem value="3">H3</SelectItem>
                <SelectItem value="4">H4</SelectItem>
              </SelectContent>
            </Select>
            <Input value={block.text} onChange={(e) => onUpdate({ text: e.target.value } as Partial<Block>)} placeholder="Titre de section" aria-label="Texte du titre" />
          </div>
        )}
        {block.type === "list" && <ListEditor block={block} onUpdate={onUpdate} />}
        {block.type === "quote" && (
          <div className="space-y-2">
            <Textarea value={block.text} onChange={(e) => onUpdate({ text: e.target.value } as Partial<Block>)} placeholder="Texte de la citation" aria-label="Citation" rows={3} />
            <div className="flex gap-2">
              <Input value={block.author ?? ""} onChange={(e) => onUpdate({ author: e.target.value } as Partial<Block>)} placeholder="Auteur" aria-label="Auteur cité" />
              <Input value={block.role ?? ""} onChange={(e) => onUpdate({ role: e.target.value } as Partial<Block>)} placeholder="Fonction" aria-label="Fonction" />
            </div>
          </div>
        )}
        {block.type === "pullquote" && (
          <div className="space-y-2">
            <Textarea value={block.text} onChange={(e) => onUpdate({ text: e.target.value } as Partial<Block>)} placeholder="Phrase forte de l'article" aria-label="Citation en exergue" rows={2} />
            <Input value={block.author ?? ""} onChange={(e) => onUpdate({ author: e.target.value } as Partial<Block>)} placeholder="Auteur" aria-label="Auteur" />
          </div>
        )}
        {block.type === "keypoints" && (
          <div className="space-y-2">
            <Input value={block.title ?? ""} onChange={(e) => onUpdate({ title: e.target.value } as Partial<Block>)} placeholder="Titre (défaut : À retenir)" aria-label="Titre du bloc" />
            {block.items.map((item, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={item}
                  onChange={(e) => {
                    const items = [...block.items];
                    items[i] = e.target.value;
                    onUpdate({ items } as Partial<Block>);
                  }}
                  placeholder={`Point clé ${i + 1}`}
                  aria-label={`Point clé ${i + 1}`}
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => onUpdate({ items: block.items.filter((_, j) => j !== i) } as Partial<Block>)} aria-label="Retirer ce point">✕</Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => onUpdate({ items: [...block.items, ""] } as Partial<Block>)}>+ Point</Button>
          </div>
        )}
        {block.type === "image" && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenPicker("image")}>
                <ImageIcon className="mr-1 size-4" aria-hidden /> {block.mediaId ? "Changer d'image" : "Choisir une image"}
              </Button>
              <Select value={block.size} onValueChange={(v) => onUpdate({ size: v as "inline" | "wide" | "full" } as Partial<Block>)}>
                <SelectTrigger className="w-36" aria-label="Taille d'affichage"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inline">Dans le texte</SelectItem>
                  <SelectItem value="wide">Large</SelectItem>
                  <SelectItem value="full">Pleine largeur</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input value={block.caption ?? ""} onChange={(e) => onUpdate({ caption: e.target.value } as Partial<Block>)} placeholder="Légende" aria-label="Légende de l'image" />
            <p className="text-xs text-ink-faint">Le texte alternatif (obligatoire à la publication) se règle sur le média, panneau « Médias ».</p>
          </div>
        )}
        {block.type === "gallery" && <GalleryEditor block={block} onUpdate={onUpdate} onOpenPicker={onOpenPicker} />}
        {block.type === "video" && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Select value={block.provider ?? "youtube"} onValueChange={(v) => onUpdate({ provider: v as "mux" | "youtube" } as Partial<Block>)}>
                <SelectTrigger className="w-32" aria-label="Hébergeur vidéo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="mux">Mux</SelectItem>
                </SelectContent>
              </Select>
              <Input value={block.playbackId ?? ""} onChange={(e) => onUpdate({ playbackId: e.target.value } as Partial<Block>)} placeholder="Identifiant de lecture (YouTube : id de la vidéo)" aria-label="Identifiant vidéo" />
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenPicker("video")}>Média local</Button>
            </div>
            <Input value={block.caption ?? ""} onChange={(e) => onUpdate({ caption: e.target.value } as Partial<Block>)} placeholder="Légende" aria-label="Légende vidéo" />
          </div>
        )}
        {block.type === "audio" && (
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenPicker("audio")}>
              {block.mediaId ? "Changer de son" : "Choisir un son"}
            </Button>
            <Input value={block.title ?? ""} onChange={(e) => onUpdate({ title: e.target.value } as Partial<Block>)} placeholder="Titre du podcast" aria-label="Titre audio" />
          </div>
        )}
        {block.type === "table" && <TableEditor block={block} onUpdate={onUpdate} />}
        {block.type === "embed" && (
          <div className="flex gap-2">
            <Select value={block.provider} onValueChange={(v) => onUpdate({ provider: v as "x" | "facebook" | "instagram" | "youtube" | "tiktok" | "iframe" } as Partial<Block>)}>
              <SelectTrigger className="w-36" aria-label="Plateforme"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="youtube">YouTube</SelectItem>
                <SelectItem value="x">X (Twitter)</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="iframe">Iframe générique</SelectItem>
              </SelectContent>
            </Select>
            <Input value={block.url} onChange={(e) => onUpdate({ url: e.target.value } as Partial<Block>)} placeholder="URL du contenu" aria-label="URL d'intégration" />
          </div>
        )}
        {block.type === "chart" && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Select value={block.chartType} onValueChange={(v) => onUpdate({ chartType: v as "line" | "bar" | "pie" | "area" } as Partial<Block>)}>
              <SelectTrigger aria-label="Type de graphique"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Barres</SelectItem>
                <SelectItem value="line">Ligne</SelectItem>
                <SelectItem value="area">Aire</SelectItem>
                <SelectItem value="pie">Circulaire</SelectItem>
              </SelectContent>
            </Select>
            <Input value={block.source} onChange={(e) => onUpdate({ source: e.target.value } as Partial<Block>)} placeholder="Source (obligatoire)" aria-label="Source du graphique" />
            <Textarea
              className="sm:col-span-2 font-mono text-xs"
              rows={3}
              value={JSON.stringify(block.data ?? [], null, 1)}
              onChange={(e) => {
                try {
                  onUpdate({ data: JSON.parse(e.target.value || "[]") } as Partial<Block>);
                } catch {
                  // JSON en cours de frappe : ignoré
                }
              }}
              aria-label="Données JSON du graphique"
            />
          </div>
        )}
        {block.type === "map" && (
          <div className="grid grid-cols-3 gap-2">
            <Input type="number" step="0.0001" value={block.lat} onChange={(e) => onUpdate({ lat: Number(e.target.value) } as Partial<Block>)} aria-label="Latitude" placeholder="Latitude" />
            <Input type="number" step="0.0001" value={block.lng} onChange={(e) => onUpdate({ lng: Number(e.target.value) } as Partial<Block>)} aria-label="Longitude" placeholder="Longitude" />
            <Input type="number" min={1} max={20} value={block.zoom} onChange={(e) => onUpdate({ zoom: Number(e.target.value) } as Partial<Block>)} aria-label="Zoom" placeholder="Zoom" />
          </div>
        )}
        {block.type === "timeline" && (
          <div className="space-y-2">
            {block.events.map((ev, i) => (
              <div key={i} className="flex gap-2">
                <Input className="w-28" value={ev.date} onChange={(e) => { const events = [...block.events]; events[i] = { ...ev, date: e.target.value }; onUpdate({ events } as Partial<Block>); }} placeholder="Date" aria-label="Date de l'événement" />
                <Input value={ev.title} onChange={(e) => { const events = [...block.events]; events[i] = { ...ev, title: e.target.value }; onUpdate({ events } as Partial<Block>); }} placeholder="Événement" aria-label="Titre de l'événement" />
                <Button type="button" variant="ghost" size="sm" onClick={() => onUpdate({ events: block.events.filter((_, j) => j !== i) } as Partial<Block>)} aria-label="Retirer">✕</Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => onUpdate({ events: [...block.events, { date: "", title: "" }] } as Partial<Block>)}>+ Événement</Button>
          </div>
        )}
        {block.type === "beforeafter" && (
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenPicker("beforeafter", "before")}>
              {block.beforeMediaId ? "Changer l'avant" : "Image avant"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenPicker("beforeafter", "after")}>
              {block.afterMediaId ? "Changer l'après" : "Image après"}
            </Button>
          </div>
        )}
        {block.type === "definition" && (
          <div className="space-y-2">
            <Input value={block.term} onChange={(e) => onUpdate({ term: e.target.value } as Partial<Block>)} placeholder="Terme" aria-label="Terme défini" />
            <Textarea value={block.definition} onChange={(e) => onUpdate({ definition: e.target.value } as Partial<Block>)} placeholder="Définition" aria-label="Définition" rows={2} />
          </div>
        )}
        {block.type === "readmore" && <ReadMoreEditor block={block} onUpdate={onUpdate} />}
        {block.type === "qa" && (
          <div className="space-y-2">
            <Input value={block.question} onChange={(e) => onUpdate({ question: e.target.value } as Partial<Block>)} placeholder="Question de l'interview" aria-label="Question" />
            <RichTextEditor value={block.answer} onChange={(answer) => onUpdate({ answer } as Partial<Block>)} placeholder="Réponse…" ariaLabel="Réponse" />
          </div>
        )}
        {block.type === "factcheck" && (
          <div className="space-y-2">
            <Textarea value={block.claim} onChange={(e) => onUpdate({ claim: e.target.value } as Partial<Block>)} placeholder="Allégation à vérifier" aria-label="Allégation" rows={2} />
            <div className="flex gap-2">
              <Select value={block.verdict} onValueChange={(v) => onUpdate({ verdict: v as "true" | "misleading" | "false" | "unverifiable" } as Partial<Block>)}>
                <SelectTrigger className="w-44" aria-label="Verdict"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Vrai</SelectItem>
                  <SelectItem value="misleading">Trompeur</SelectItem>
                  <SelectItem value="false">Faux</SelectItem>
                  <SelectItem value="unverifiable">Invérifiable</SelectItem>
                </SelectContent>
              </Select>
              <Input value={block.explanation} onChange={(e) => onUpdate({ explanation: e.target.value } as Partial<Block>)} placeholder="Explication" aria-label="Explication du verdict" />
            </div>
          </div>
        )}
        {block.type === "divider" && <p className="text-xs text-ink-faint">Ligne séparatrice horizontale.</p>}
        {block.type === "code" && (
          <div className="space-y-2">
            <Input value={block.language} onChange={(e) => onUpdate({ language: e.target.value } as Partial<Block>)} placeholder="Langage" aria-label="Langage du code" />
            <Textarea className="font-mono text-xs" value={block.code} onChange={(e) => onUpdate({ code: e.target.value } as Partial<Block>)} rows={4} aria-label="Code source" />
          </div>
        )}
        {block.type === "newsletter" && (
          <Input value={block.listKey} onChange={(e) => onUpdate({ listKey: e.target.value } as Partial<Block>)} placeholder="Clé de la liste (ex. daily)" aria-label="Liste newsletter" />
        )}
        {block.type === "ad" && (
          <Input value={block.slotCode} onChange={(e) => onUpdate({ slotCode: e.target.value } as Partial<Block>)} placeholder="Code d'emplacement (ex. AD-04)" aria-label="Emplacement publicitaire" />
        )}
      </div>
    </div>
  );
}

// ─── Éditeurs spécifiques ──────────────────────────────────────────────

function ParagraphEditor({
  value, onChange, onSlashCommand,
}: {
  value: RichText;
  onChange: (text: RichText) => void;
  onSlashCommand: () => void;
}) {
  const [slashHandled, setSlashHandled] = useState(false);
  return (
    <RichTextEditor
      value={value}
      onChange={(next) => {
        const joined = next.map((f) => f.text).join("");
        if (!slashHandled && joined === "/") {
          setSlashHandled(true);
          onSlashCommand();
          onChange([{ text: "" }]);
          return;
        }
        if (joined !== "/" && slashHandled) setSlashHandled(false);
        onChange(next);
      }}
      placeholder="Paragraphe… (« / » pour insérer un bloc)"
      ariaLabel="Paragraphe"
    />
  );
}

function ListEditor({ block, onUpdate }: { block: Extract<Block, { type: "list" }>; onUpdate: (patch: Partial<Block>) => void }) {
  return (
    <div className="space-y-2">
      <Select value={block.style} onValueChange={(v) => onUpdate({ style: v as "bullet" | "number" } as Partial<Block>)}>
        <SelectTrigger className="w-40" aria-label="Style de liste"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="bullet">À puces</SelectItem>
          <SelectItem value="number">Numérotée</SelectItem>
        </SelectContent>
      </Select>
      {block.items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="pt-3 text-xs text-ink-faint">{i + 1}.</span>
          <div className="flex-1">
            <RichTextEditor
              value={item}
              onChange={(next) => {
                const items = [...block.items];
                items[i] = next;
                onUpdate({ items } as Partial<Block>);
              }}
              placeholder={`Élément ${i + 1}`}
              ariaLabel={`Élément de liste ${i + 1}`}
            />
          </div>
          <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => onUpdate({ items: block.items.filter((_, j) => j !== i) } as Partial<Block>)} aria-label="Retirer l'élément">✕</Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onUpdate({ items: [...block.items, [{ text: "" }]] } as Partial<Block>)}>+ Élément</Button>
    </div>
  );
}

function GalleryEditor({
  block, onUpdate,
}: {
  block: Extract<Block, { type: "gallery" }>;
  onUpdate: (patch: Partial<Block>) => void;
  onOpenPicker?: (kind: "gallery") => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>+ Ajouter des images</Button>
        <Select value={block.layout} onValueChange={(v) => onUpdate({ layout: v as "grid" | "carousel" | "mosaic" } as Partial<Block>)}>
          <SelectTrigger className="w-36" aria-label="Disposition"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="grid">Grille</SelectItem>
            <SelectItem value="carousel">Carrousel</SelectItem>
            <SelectItem value="mosaic">Mosaïque</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-ink-faint">{block.mediaIds.length} image(s) sélectionnée(s)</p>
      {pickerOpen && (
        <MediaPicker
          open
          onOpenChange={setPickerOpen}
          onSelect={(media) => {
            if (!block.mediaIds.includes(media.id)) {
              onUpdate({ mediaIds: [...block.mediaIds, media.id] } as Partial<Block>);
            }
            setPickerOpen(false);
          }}
          title="Composer la galerie"
        />
      )}
    </div>
  );
}

function TableEditor({ block, onUpdate }: { block: Extract<Block, { type: "table" }>; onUpdate: (patch: Partial<Block>) => void }) {
  const updateCell = (i: number, j: number, value: string, header: boolean) => {
    if (header) {
      const headers = [...block.headers];
      headers[i] = value;
      onUpdate({ headers } as Partial<Block>);
    } else {
      const rows = block.rows.map((r) => [...r]);
      rows[i][j] = value;
      onUpdate({ rows } as Partial<Block>);
    }
  };
  const colCount = block.headers.length;
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {block.headers.map((h, i) => (
                <th key={i} className="p-1">
                  <Input value={h} onChange={(e) => updateCell(i, 0, e.target.value, true)} placeholder={`Colonne ${i + 1}`} aria-label={`En-tête colonne ${i + 1}`} className="font-semibold" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className="p-1">
                    <Input value={cell} onChange={(e) => updateCell(i, j, e.target.value, false)} aria-label={`Cellule ${i + 1}-${j + 1}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onUpdate({ headers: [...block.headers, ""], rows: block.rows.map((r) => [...r, ""]) } as Partial<Block>)}>+ Colonne</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onUpdate({ rows: [...block.rows, Array(colCount).fill("")] } as Partial<Block>)}>+ Ligne</Button>
      </div>
      <div className="flex gap-2">
        <Input value={block.caption ?? ""} onChange={(e) => onUpdate({ caption: e.target.value } as Partial<Block>)} placeholder="Légende" aria-label="Légende du tableau" />
        <Input value={block.source ?? ""} onChange={(e) => onUpdate({ source: e.target.value } as Partial<Block>)} placeholder="Source" aria-label="Source du tableau" />
      </div>
    </div>
  );
}

function ReadMoreEditor({ block, onUpdate }: { block: Extract<Block, { type: "readmore" }>; onUpdate: (patch: Partial<Block>) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; title: string }[]>([]);
  const [searching, setSearching] = useState(false);

  const search = useCallback(async () => {
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/articles?q=${encodeURIComponent(q)}&per_page=8`, { cache: "no-store" });
      const payload = (await res.json()) as { data?: { id: string; title: string }[] };
      setResults(payload.data ?? []);
    } finally {
      setSearching(false);
    }
  }, [q]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un article interne…" aria-label="Recherche d'article" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void search())} />
        <Button type="button" variant="outline" size="sm" onClick={() => void search()} disabled={searching}>Chercher</Button>
      </div>
      {results.length > 0 && (
        <ul className="max-h-40 overflow-y-auto rounded-sm border border-rule" style={{ scrollbarWidth: "thin" }}>
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="w-full truncate px-3 py-2 text-left text-sm hover:bg-paper-alt"
                onClick={() => {
                  if (!block.articleIds.includes(r.id)) {
                    onUpdate({ articleIds: [...block.articleIds, r.id] } as Partial<Block>);
                  }
                }}
              >
                {r.title}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-ink-faint">{block.articleIds.length} article(s) lié(s)</p>
    </div>
  );
}
