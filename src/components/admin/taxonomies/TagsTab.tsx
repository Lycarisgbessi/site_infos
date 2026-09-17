"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GitMerge, Pencil, Plus, Search, Star, Tags, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch, errorMessage } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Onglet Mots-clés (§11.2) — gestion des tags avec fusion journalisée et
 * réversible 30 jours (règle 3 §11.2) : les liens article↔tag du mot-clé
 * source sont réattribués au mot-clé cible, l'annulation relit l'instantané
 * d'audit tant que le délai de réversibilité n'est pas dépassé.
 */

interface TagRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  /** Synonymes sérialisés en JSON par le serveur (text[] adapté, D-01). */
  synonyms: string;
  is_featured: boolean;
  usage_count: number;
}

interface MergeResult {
  ok: boolean;
  moved_links: number;
  audit_id: number | null;
  reversible_until: string;
}

interface LastMerge {
  audit_id: number | null;
  moved_links: number;
  reversible_until: string;
  source_name: string;
  target_name: string;
}

const TAGS_URL = "/api/admin/taxonomies/tags";

/** Slugification locale (accents → lettres brutes, non alphanumériques → tiret). */
function slugify(input: string): string {
  const lowered = input.toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae");
  return lowered
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseSynonyms(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === "string");
  } catch {
    return [];
  }
}

function formatDateFr(iso: string): string {
  const formatter = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : formatter.format(date);
}

export function TagsTab() {
  const { toast } = useToast();

  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const [dialog, setDialog] = useState<
    { mode: "create" } | { mode: "edit"; tag: TagRow } | null
  >(null);
  const [mergeTarget, setMergeTarget] = useState<TagRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TagRow | null>(null);
  const [lastMerge, setLastMerge] = useState<LastMerge | null>(null);
  const [unmerging, setUnmerging] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiFetch<TagRow[]>(TAGS_URL);
      setTags(data);
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        parseSynonyms(t.synonyms).some((s) => s.toLowerCase().includes(q))
    );
  }, [tags, query]);

  const unmerge = async () => {
    if (!lastMerge?.audit_id) return;
    setUnmerging(true);
    try {
      await apiFetch(TAGS_URL, {
        method: "POST",
        json: { action: "unmerge", audit_id: lastMerge.audit_id },
      });
      toast({
        title: "Fusion annulée",
        description: `« ${lastMerge.source_name} » a été restauré avec ses liens.`,
      });
      setLastMerge(null);
      await reload();
    } catch (error) {
      toast({
        title: "Annulation impossible",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setUnmerging(false);
    }
  };

  return (
    <section aria-label="Mots-clés de la rédaction">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold">Mots-clés</h2>
          <p className="text-sm text-ink-soft">
            {loading ? "Chargement…" : `${tags.length} mot(s)-clé(s), triés par usage`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un mot-clé…"
              aria-label="Rechercher un mot-clé"
              className="w-48 pl-8 sm:w-64"
            />
          </div>
          <Button onClick={() => setDialog({ mode: "create" })}>
            <Plus className="size-4" aria-hidden="true" />
            Nouveau mot-clé
          </Button>
        </div>
      </div>

      {lastMerge ? (
        <div
          role="status"
          className="mb-4 flex flex-col gap-2 rounded-md border border-rule bg-paper-alt px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="text-sm">
            <p className="font-medium">
              Fusion effectuée — {lastMerge.moved_links} lien(s) déplacé(s) de «{" "}
              {lastMerge.source_name} » vers « {lastMerge.target_name} ».
            </p>
            <p className="text-ink-soft">
              Réversible jusqu&apos;au {formatDateFr(lastMerge.reversible_until)}.
            </p>
          </div>
          {lastMerge.audit_id !== null ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void unmerge()}
              disabled={unmerging}
              className="shrink-0"
            >
              <Undo2 className="size-4" aria-hidden="true" />
              {unmerging ? "Annulation…" : "Annuler la fusion"}
            </Button>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-2" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-rule-strong bg-paper-alt px-6 py-14 text-center">
          <Tags className="size-8 text-ink-faint" aria-hidden="true" />
          <p className="font-serif text-lg font-semibold">
            {query ? "Aucun mot-clé trouvé" : "Aucun mot-clé"}
          </p>
          <p className="max-w-sm text-sm text-ink-soft">
            {query
              ? "Essayez un autre terme ou créez ce nouveau mot-clé."
              : "Les mots-clés relient les articles entre eux et alimentent les pages /tags."}
          </p>
          <Button onClick={() => setDialog({ mode: "create" })}>
            <Plus className="size-4" aria-hidden="true" />
            Nouveau mot-clé
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-rule bg-paper">
          <div className="max-h-[520px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
            <Table aria-label="Liste des mots-clés">
              <TableHeader className="sticky top-0 z-10 bg-paper-alt">
                <TableRow className="hover:bg-paper-alt">
                  <TableHead className="text-ink-soft">Mot-clé</TableHead>
                  <TableHead className="hidden text-ink-soft md:table-cell">Slug</TableHead>
                  <TableHead className="text-right text-ink-soft">Usage</TableHead>
                  <TableHead className="hidden text-ink-soft sm:table-cell">Statut</TableHead>
                  <TableHead className="w-28 text-right text-ink-soft">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((tag) => (
                  <TableRow key={tag.id} className="border-rule">
                    <TableCell className="max-w-56 py-2.5">
                      <p className="truncate font-medium">{tag.name}</p>
                      {tag.description ? (
                        <p className="truncate text-xs text-ink-faint">{tag.description}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden py-2.5 font-mono text-xs text-ink-faint md:table-cell">
                      /tags/{tag.slug}
                    </TableCell>
                    <TableCell className="py-2.5 text-right tabular-nums">
                      {tag.usage_count}
                    </TableCell>
                    <TableCell className="hidden py-2.5 sm:table-cell">
                      {tag.is_featured ? (
                        <Badge className="bg-brand-red text-white">
                          <Star className="size-3" aria-hidden="true" />
                          À la une
                        </Badge>
                      ) : (
                        <span className="text-xs text-ink-faint">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-ink-faint hover:text-ink"
                          onClick={() => setMergeTarget(tag)}
                          aria-label={`Fusionner le mot-clé ${tag.name}`}
                          title="Fusionner dans un autre mot-clé"
                        >
                          <GitMerge className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-ink-faint hover:text-ink"
                          onClick={() => setDialog({ mode: "edit", tag })}
                          aria-label={`Modifier le mot-clé ${tag.name}`}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-ink-faint hover:bg-red-wash hover:text-brand-red"
                          onClick={() => setDeleteTarget(tag)}
                          aria-label={`Supprimer le mot-clé ${tag.name}`}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs leading-relaxed text-ink-faint">
        La fusion réattribue les liens article↔tag au mot-clé cible et archive
        le mot-clé source ; elle reste réversible pendant 30 jours.
      </p>

      {dialog ? (
        <TagDialog
          key={dialog.mode === "edit" ? dialog.tag.id : "create"}
          open
          mode={dialog.mode}
          tag={dialog.mode === "edit" ? dialog.tag : null}
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          onSaved={reload}
        />
      ) : null}

      {mergeTarget ? (
        <MergeTagDialog
          key={mergeTarget.id}
          source={mergeTarget}
          tags={tags}
          onOpenChange={(open) => {
            if (!open) setMergeTarget(null);
          }}
          onMerged={(result, source, target) => {
            setMergeTarget(null);
            setLastMerge({
              audit_id: result.audit_id,
              moved_links: result.moved_links,
              reversible_until: result.reversible_until,
              source_name: source.name,
              target_name: target.name,
            });
            toast({
              title: `Fusion effectuée — ${result.moved_links} lien(s) déplacés`,
              description: `Réversible jusqu'au ${formatDateFr(result.reversible_until)}.`,
            });
            void reload();
          }}
        />
      ) : null}

      <DeleteTagDialog
        target={deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onDeleted={() => {
          setDeleteTarget(null);
          void reload();
        }}
      />
    </section>
  );
}

// ─── Dialogue création / édition ───────────────────────────────────────

interface TagDialogProps {
  open: boolean;
  mode: "create" | "edit";
  tag: TagRow | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}

function TagDialog({ open, mode, tag, onOpenChange, onSaved }: TagDialogProps) {
  const { toast } = useToast();

  const [name, setName] = useState(tag?.name ?? "");
  const [slug, setSlug] = useState(tag?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [description, setDescription] = useState(tag?.description ?? "");
  const [synonyms, setSynonyms] = useState(
    tag ? parseSynonyms(tag.synonyms).join(", ") : ""
  );
  const [isFeatured, setIsFeatured] = useState(tag?.is_featured ?? false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const save = async () => {
    if (!name.trim()) {
      setError("Le nom du mot-clé est obligatoire.");
      return;
    }
    setPending(true);
    setError(null);
    const synonymList = synonyms
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    try {
      if (mode === "create") {
        await apiFetch(TAGS_URL, {
          method: "POST",
          json: {
            name: name.trim(),
            ...(slug.trim() ? { slug: slugify(slug) } : {}),
            ...(description.trim() ? { description: description.trim() } : {}),
            ...(synonymList.length > 0 ? { synonyms: synonymList } : {}),
            is_featured: isFeatured,
          },
        });
        toast({ title: "Mot-clé créé" });
      } else if (tag) {
        await apiFetch(`${TAGS_URL}?id=${encodeURIComponent(tag.id)}`, {
          method: "PATCH",
          json: {
            name: name.trim(),
            ...(slug.trim() ? { slug: slugify(slug) } : {}),
            description: description.trim() || null,
            synonyms: synonymList,
            is_featured: isFeatured,
          },
        });
        toast({ title: "Mot-clé mis à jour" });
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
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            {mode === "create" ? "Nouveau mot-clé" : `Modifier « ${tag?.name} »`}
          </DialogTitle>
          <DialogDescription>
            Les synonymes renforcent la recherche interne et les pages de tags.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="tag-name">Nom *</Label>
              <Input
                id="tag-name"
                value={name}
                maxLength={120}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="Ex. Union européenne"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tag-slug">Slug</Label>
              <Input
                id="tag-slug"
                value={slug}
                maxLength={120}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                placeholder="union-europeenne"
                className="font-mono text-sm"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tag-synonyms">Synonymes (séparés par des virgules)</Label>
            <Input
              id="tag-synonyms"
              value={synonyms}
              onChange={(e) => setSynonyms(e.target.value)}
              placeholder="Ex. UE, Europe, Union euro"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tag-description">Description</Label>
            <Textarea
              id="tag-description"
              value={description}
              rows={3}
              maxLength={1000}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contexte éditorial du mot-clé"
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-sm border border-rule bg-paper-alt px-3 py-2.5">
            <Label htmlFor="tag-featured" className="cursor-pointer">
              Mettre à la une (page tags)
            </Label>
            <Switch
              id="tag-featured"
              checked={isFeatured}
              onCheckedChange={setIsFeatured}
              aria-label="Mot-clé mis à la une"
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
            {pending ? "Enregistrement…" : mode === "create" ? "Créer le mot-clé" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialogue fusion (réversible 30 j) ─────────────────────────────────

interface MergeTagDialogProps {
  source: TagRow;
  tags: TagRow[];
  onOpenChange: (open: boolean) => void;
  onMerged: (result: MergeResult, source: TagRow, target: TagRow) => void;
}

function MergeTagDialog({ source, tags, onOpenChange, onMerged }: MergeTagDialogProps) {
  const [targetId, setTargetId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const others = tags.filter((t) => t.id !== source.id);
  const target = others.find((t) => t.id === targetId) ?? null;

  const merge = async () => {
    if (!target) {
      setError(`Choisissez le mot-clé cible qui absorbera « ${source.name} ».`);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const { data } = await apiFetch<MergeResult>(TAGS_URL, {
        method: "POST",
        json: { action: "merge", source_id: source.id, target_id: target.id },
      });
      onMerged(data, source, target);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="rounded-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            Fusionner « {source.name} »
          </DialogTitle>
          <DialogDescription>
            Les liens article↔tag du mot-clé source seront réattribués au
            mot-clé cible. Le mot-clé source sera archivé — l&apos;opération
            est journalisée et réversible pendant 30 jours.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <Label htmlFor="merge-target">Mot-clé cible *</Label>
          <Select value={targetId} onValueChange={setTargetId}>
            <SelectTrigger id="merge-target" aria-label="Mot-clé cible de la fusion">
              <SelectValue placeholder="Sélectionner le mot-clé qui absorbe…" />
            </SelectTrigger>
            <SelectContent>
              {others.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name} ({t.usage_count} usage)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-ink-faint">
            {source.usage_count} lien(s) seront déplacés vers le mot-clé cible.
          </p>
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
          <Button onClick={() => void merge()} disabled={pending || !target}>
            <GitMerge className="size-4" aria-hidden="true" />
            {pending ? "Fusion…" : "Fusionner"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialogue suppression ──────────────────────────────────────────────

interface DeleteTagDialogProps {
  target: TagRow | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

function DeleteTagDialog({ target, onOpenChange, onDeleted }: DeleteTagDialogProps) {
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  if (!target) return null;

  const confirm = async () => {
    setPending(true);
    try {
      await apiFetch(`${TAGS_URL}?id=${encodeURIComponent(target.id)}`, {
        method: "DELETE",
      });
      toast({ title: `Mot-clé « ${target.name} » supprimé` });
      onDeleted();
    } catch (error) {
      toast({
        title: "Suppression impossible",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif text-xl">
            Supprimer le mot-clé « {target.name} » ?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Ses {target.usage_count} lien(s) avec les articles seront détachés.
            Si vous souhaitez conserver ces liens, utilisez plutôt la fusion
            vers un autre mot-clé.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void confirm();
            }}
            disabled={pending}
            className="bg-brand-red text-white hover:bg-red-deep"
          >
            {pending ? "Suppression…" : "Supprimer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
