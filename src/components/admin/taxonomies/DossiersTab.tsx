"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderOpen, Newspaper, Pencil, Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch, errorMessage } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * Onglet Dossiers (§11.2) — grands sujets de la rédaction : création et
 * édition via le point de terminaison /annexes (kind=dossier, l'inclusion
 * du champ id déclenche la mise à jour), période de publication et compte
 * d'articles rattachés.
 */

interface DossierRow {
  id: string;
  slug: string;
  title: string;
  lede: string | null;
  description: string | null;
  is_active: boolean;
  is_featured: boolean;
  started_at: string | null;
  ended_at: string | null;
  _count: { articles: number };
  cover?: { id: string; url: string } | null;
  coverMedia?: { id: string; url: string } | null;
}

const ANNEXES_URL = "/api/admin/taxonomies/annexes?kind=dossiers";

/** Slugification locale (accents → lettres brutes, non alphanumériques → tiret). */
function slugify(input: string): string {
  const lowered = input.toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae");
  return lowered
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** ISO → valeur compatible <input type="datetime-local"> (heure locale). */
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

/** datetime-local → RFC 3339 (le schéma serveur exige un offset explicite). */
function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatDateFr(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(date);
}

export function DossiersTab() {
  const { toast } = useToast();

  const [dossiers, setDossiers] = useState<DossierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DossierRow | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiFetch<DossierRow[]>(ANNEXES_URL);
      setDossiers(data);
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

  const activeCount = useMemo(() => dossiers.filter((d) => d.is_active).length, [dossiers]);

  return (
    <section aria-label="Dossiers de la rédaction">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold">Dossiers</h2>
          <p className="text-sm text-ink-soft">
            {loading
              ? "Chargement…"
              : `${dossiers.length} dossier(s), dont ${activeCount} actif(s)`}
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Nouveau dossier
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : dossiers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-rule-strong bg-paper-alt px-6 py-14 text-center">
          <FolderOpen className="size-8 text-ink-faint" aria-hidden="true" />
          <p className="font-serif text-lg font-semibold">Aucun dossier</p>
          <p className="max-w-sm text-sm text-ink-soft">
            Un dossier rassemble plusieurs articles sous un même grand sujet :
            élections, COP, dossier économique…
          </p>
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Nouveau dossier
          </Button>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-md border border-rule bg-paper">
          {dossiers.map((dossier) => {
            const cover = dossier.cover ?? dossier.coverMedia ?? null;
            return (
              <li
                key={dossier.id}
                className="flex items-center gap-4 border-b border-rule px-4 py-3 last:border-b-0"
              >
                {cover ? (
                   
                  <img
                    src={cover.url}
                    alt=""
                    className="hidden h-14 w-24 shrink-0 rounded-sm border border-rule object-cover sm:block"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="hidden h-14 w-24 shrink-0 items-center justify-center rounded-sm border border-dashed border-rule bg-paper-alt sm:flex"
                    aria-hidden="true"
                  >
                    <Newspaper className="size-5 text-ink-faint" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-serif text-base font-semibold">
                      {dossier.title}
                    </p>
                    {dossier.is_featured ? (
                      <Badge className="bg-brand-red text-white">
                        <Star className="size-3" aria-hidden="true" />
                        À la une
                      </Badge>
                    ) : null}
                    <Badge
                      variant="outline"
                      className={cn(
                        "border-rule text-[11px]",
                        dossier.is_active
                          ? "bg-paper-alt text-ink-soft"
                          : "bg-paper-sunk text-ink-faint"
                      )}
                    >
                      {dossier.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </div>
                  {dossier.lede ? (
                    <p className="mt-0.5 line-clamp-1 text-sm text-ink-soft">{dossier.lede}</p>
                  ) : null}
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-faint">
                    <span className="font-mono">/dossiers/{dossier.slug}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Du {formatDateFr(dossier.started_at)} au {formatDateFr(dossier.ended_at)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{dossier._count.articles} article(s)</span>
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setEditing(dossier)}
                  aria-label={`Modifier le dossier ${dossier.title}`}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                  Modifier
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {creating || editing ? (
        <DossierDialog
          key={editing?.id ?? "create"}
          open
          dossier={editing}
          onOpenChange={(open) => {
            if (!open) {
              setCreating(false);
              setEditing(null);
            }
          }}
          onSaved={reload}
        />
      ) : null}
    </section>
  );
}

// ─── Dialogue création / édition ───────────────────────────────────────

interface DossierDialogProps {
  open: boolean;
  dossier: DossierRow | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}

function DossierDialog({ open, dossier, onOpenChange, onSaved }: DossierDialogProps) {
  const { toast } = useToast();

  const [title, setTitle] = useState(dossier?.title ?? "");
  const [slug, setSlug] = useState(dossier?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(dossier !== null);
  const [lede, setLede] = useState(dossier?.lede ?? "");
  const [description, setDescription] = useState(dossier?.description ?? "");
  const [isActive, setIsActive] = useState(dossier?.is_active ?? true);
  const [isFeatured, setIsFeatured] = useState(dossier?.is_featured ?? false);
  const [startedAt, setStartedAt] = useState(toDatetimeLocal(dossier?.started_at ?? null));
  const [endedAt, setEndedAt] = useState(toDatetimeLocal(dossier?.ended_at ?? null));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onTitleChange = (value: string) => {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const save = async () => {
    if (!title.trim()) {
      setError("Le titre du dossier est obligatoire.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      // Même point de terminaison pour créer et mettre à jour : l'inclusion
      // du champ id déclenche la mise à jour côté service (§11.2).
      await apiFetch("/api/admin/taxonomies/annexes", {
        method: "POST",
        json: {
          kind: "dossier",
          ...(dossier ? { id: dossier.id } : {}),
          title: title.trim(),
          ...(slug.trim() ? { slug: slugify(slug) } : {}),
          lede: lede.trim() || null,
          description: description.trim() || null,
          is_active: isActive,
          is_featured: isFeatured,
          started_at: fromDatetimeLocal(startedAt),
          ended_at: fromDatetimeLocal(endedAt),
        },
      });
      toast({
        title: dossier ? "Dossier mis à jour" : "Dossier créé",
        description: title.trim(),
      });
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
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-md sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            {dossier ? `Modifier « ${dossier.title} »` : "Nouveau dossier"}
          </DialogTitle>
          <DialogDescription>
            Un dossier regroupe des articles autour d&apos;un même grand sujet,
            avec sa page dédiée /dossiers/{"{slug}"}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="dossier-title">Titre *</Label>
              <Input
                id="dossier-title"
                value={title}
                maxLength={300}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="Ex. Élection présidentielle 2027"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="dossier-slug">Slug</Label>
              <Input
                id="dossier-slug"
                value={slug}
                maxLength={220}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                placeholder="election-presidentielle-2027"
                className="font-mono text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="dossier-lede">Chapô</Label>
              <Input
                id="dossier-lede"
                value={lede}
                maxLength={1000}
                onChange={(e) => setLede(e.target.value)}
                placeholder="Phrase d'accroche affichée en tête de page"
              />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="dossier-description">Description</Label>
              <Textarea
                id="dossier-description"
                value={description}
                rows={4}
                maxLength={5000}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Objet du dossier, angle éditorial, articulation des articles…"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="dossier-started">Début de la période</Label>
              <Input
                id="dossier-started"
                type="datetime-local"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="dossier-ended">Fin de la période</Label>
              <Input
                id="dossier-ended"
                type="datetime-local"
                value={endedAt}
                onChange={(e) => setEndedAt(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-sm border border-rule bg-paper-alt px-3 py-2.5">
              <Label htmlFor="dossier-active" className="cursor-pointer">
                Dossier actif
              </Label>
              <Switch
                id="dossier-active"
                checked={isActive}
                onCheckedChange={setIsActive}
                aria-label="Dossier actif"
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-sm border border-rule bg-paper-alt px-3 py-2.5">
              <Label htmlFor="dossier-featured" className="cursor-pointer">
                Mettre à la une
              </Label>
              <Switch
                id="dossier-featured"
                checked={isFeatured}
                onCheckedChange={setIsFeatured}
                aria-label="Dossier mis à la une"
              />
            </div>
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
            {pending ? "Enregistrement…" : dossier ? "Enregistrer" : "Créer le dossier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
