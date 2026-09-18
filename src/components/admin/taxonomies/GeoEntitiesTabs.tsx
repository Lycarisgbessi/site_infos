"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Flag,
  Globe2,
  Map as MapIcon,
  MapPin,
  Pencil,
  Plus,
  Search,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
 * Onglets Zones géographiques et Entités (§11.2) — référentiels annexes
 * servis par /api/admin/taxonomies/annexes (kind=geo|entities). Les zones
 * sont regroupées par type ; les entités portent un type personne /
 * organisation / lieu. Les points de terminaison PATCH n'exposent que
 * certains champs (nom + type pour les zones, nom + description pour les
 * entités) : les dialogues d'édition s'y conforment.
 */

const ANNEXES_URL = "/api/admin/taxonomies/annexes";

/** Slugification locale (accents → lettres brutes, non alphanumériques → tiret). */
function slugify(input: string): string {
  const lowered = input.toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae");
  return lowered
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatCoord(value: number | null, unit: string): string {
  if (value === null) return "—";
  return `${value.toFixed(4)} ${unit}`;
}

// ═══════════════════════════════════════════════════════════════════════
// Onglet Zones géographiques
// ═══════════════════════════════════════════════════════════════════════

type GeoType = "continent" | "region" | "country" | "city";

interface GeoZoneRow {
  id: string;
  parent_id: string | null;
  type: GeoType;
  slug: string;
  name: string;
  iso_code: string | null;
  latitude: number | null;
  longitude: number | null;
}

const GEO_TYPES: { value: GeoType; label: string }[] = [
  { value: "continent", label: "Continent" },
  { value: "region", label: "Région" },
  { value: "country", label: "Pays" },
  { value: "city", label: "Ville" },
];

const GEO_TYPE_LABELS: Record<GeoType, string> = {
  continent: "Continents",
  region: "Régions",
  country: "Pays",
  city: "Villes",
};

export function GeoZonesTab() {
  const { toast } = useToast();

  const [zones, setZones] = useState<GeoZoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<GeoZoneRow | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiFetch<GeoZoneRow[]>(`${ANNEXES_URL}?kind=geo`);
      setZones(data);
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

  const grouped = useMemo(() => {
    const map = new Map<GeoType, GeoZoneRow[]>();
    for (const zone of zones) {
      const list = map.get(zone.type) ?? [];
      list.push(zone);
      map.set(zone.type, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    }
    return map;
  }, [zones]);

  return (
    <section aria-label="Zones géographiques">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold">Zones géographiques</h2>
          <p className="text-sm text-ink-soft">
            {loading
              ? "Chargement…"
              : `${zones.length} zone(s) — continents, régions, pays, villes`}
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Nouvelle zone
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : zones.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-rule-strong bg-paper-alt px-6 py-14 text-center">
          <Globe2 className="size-8 text-ink-faint" aria-hidden="true" />
          <p className="font-serif text-lg font-semibold">Aucune zone géographique</p>
          <p className="max-w-sm text-sm text-ink-soft">
            Les zones alimentent la rubrique Monde et la géolocalisation des
            articles : commencez par les continents, puis les pays.
          </p>
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Nouvelle zone
          </Button>
        </div>
      ) : (
        <div className="rounded-md border border-rule bg-paper">
          <div className="max-h-[560px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
            {GEO_TYPES.map((group) => {
              const list = grouped.get(group.value) ?? [];
              if (list.length === 0) return null;
              return (
                <div key={group.value} className="border-b border-rule last:border-b-0">
                  <div className="flex items-center justify-between gap-2 bg-paper-alt px-4 py-2">
                    <p className="kicker text-ink-soft">{GEO_TYPE_LABELS[group.value]}</p>
                    <span className="text-xs tabular-nums text-ink-faint">
                      {list.length}
                    </span>
                  </div>
                  <ul>
                    {list.map((zone) => (
                      <li
                        key={zone.id}
                        className="flex items-center gap-3 border-t border-rule px-4 py-2 first:border-t-0"
                      >
                        {group.value === "continent" ? (
                          <Globe2 className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
                        ) : group.value === "region" ? (
                          <MapIcon className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
                        ) : group.value === "country" ? (
                          <Flag className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
                        ) : (
                          <Building2 className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
                        )}
                        <span className="truncate text-sm font-medium">{zone.name}</span>
                        {zone.iso_code ? (
                          <Badge
                            variant="outline"
                            className="shrink-0 border-rule bg-paper-alt font-mono text-[11px] text-ink-soft"
                          >
                            {zone.iso_code}
                          </Badge>
                        ) : null}
                        <span className="hidden font-mono text-xs text-ink-faint lg:inline">
                          /monde/{zone.slug}
                        </span>
                        <span className="ml-auto hidden text-xs tabular-nums text-ink-faint md:inline">
                          {formatCoord(zone.latitude, "lat")} · {formatCoord(zone.longitude, "lon")}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 text-ink-faint hover:text-ink"
                          onClick={() => setEditing(zone)}
                          aria-label={`Modifier la zone ${zone.name}`}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="mt-3 text-xs leading-relaxed text-ink-faint">
        Les coordonnées et codes ISO servent à la carte du Monde et aux pages
        météo ; ils se définissent à la création de la zone.
      </p>

      {creating ? (
        <GeoZoneDialog
          key="geo-create"
          open
          zone={null}
          onOpenChange={(open) => {
            if (!open) setCreating(false);
          }}
          onSaved={reload}
        />
      ) : null}
      {editing ? (
        <GeoZoneDialog
          key={`geo-edit-${editing.id}`}
          open
          zone={editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          onSaved={reload}
        />
      ) : null}
    </section>
  );
}

// ─── Dialogue zone géo (création / édition) ────────────────────────────

interface GeoZoneDialogProps {
  open: boolean;
  zone: GeoZoneRow | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}

function GeoZoneDialog({ open, zone, onOpenChange, onSaved }: GeoZoneDialogProps) {
  const { toast } = useToast();

  const [name, setName] = useState(zone?.name ?? "");
  const [type, setType] = useState<GeoType>(zone?.type ?? "country");
  const [isoCode, setIsoCode] = useState(zone?.iso_code ?? "");
  const [latitude, setLatitude] = useState(
    zone?.latitude !== null && zone?.latitude !== undefined ? String(zone.latitude) : ""
  );
  const [longitude, setLongitude] = useState(
    zone?.longitude !== null && zone?.longitude !== undefined ? String(zone.longitude) : ""
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) {
      setError("Le nom de la zone est obligatoire.");
      return;
    }
    setError(null);
    const lat = latitude.trim() ? Number(latitude.replace(",", ".")) : undefined;
    const lng = longitude.trim() ? Number(longitude.replace(",", ".")) : undefined;
    if (lat !== undefined && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
      setError("Latitude invalide (entre -90 et 90).");
      return;
    }
    if (lng !== undefined && (!Number.isFinite(lng) || lng < -180 || lng > 180)) {
      setError("Longitude invalide (entre -180 et 180).");
      return;
    }
    setPending(true);
    try {
      if (zone) {
        await apiFetch(ANNEXES_URL, {
          method: "PATCH",
          json: { kind: "geo", id: zone.id, name: name.trim(), type },
        });
        toast({ title: "Zone mise à jour", description: name.trim() });
      } else {
        await apiFetch(ANNEXES_URL, {
          method: "POST",
          json: {
            kind: "geo",
            name: name.trim(),
            type,
            ...(isoCode.trim() ? { iso_code: isoCode.trim().toUpperCase() } : {}),
            ...(lat !== undefined ? { latitude: lat } : {}),
            ...(lng !== undefined ? { longitude: lng } : {}),
          },
        });
        toast({ title: "Zone créée", description: name.trim() });
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
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            {zone ? `Modifier « ${zone.name} »` : "Nouvelle zone géographique"}
          </DialogTitle>
          <DialogDescription>
            {zone
              ? "Seuls le nom et le type sont modifiables après création."
              : "La zone est aussitôt disponible pour géolocaliser les articles."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="geo-name">Nom *</Label>
            <Input
              id="geo-name"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. France"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="geo-type">Type *</Label>
              <Select value={type} onValueChange={(value) => setType(value as GeoType)}>
                <SelectTrigger id="geo-type" aria-label="Type de zone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GEO_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="geo-iso">Code ISO</Label>
              <Input
                id="geo-iso"
                value={isoCode}
                maxLength={10}
                onChange={(e) => setIsoCode(e.target.value)}
                placeholder="Ex. FR"
                className="font-mono text-sm uppercase"
                disabled={zone !== null}
              />
            </div>
          </div>
          {zone ? null : (
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="geo-lat">Latitude</Label>
                <Input
                  id="geo-lat"
                  type="number"
                  step="any"
                  min={-90}
                  max={90}
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="48.8566"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="geo-lng">Longitude</Label>
                <Input
                  id="geo-lng"
                  type="number"
                  step="any"
                  min={-180}
                  max={180}
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="2.3522"
                />
              </div>
            </div>
          )}
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
            {pending ? "Enregistrement…" : zone ? "Enregistrer" : "Créer la zone"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Onglet Entités
// ═══════════════════════════════════════════════════════════════════════

type EntityType = "person" | "organization" | "place";

interface EntityRow {
  id: string;
  type: string;
  slug: string;
  name: string;
  description: string | null;
}

const ENTITY_TYPES: { value: EntityType; label: string }[] = [
  { value: "person", label: "Personne" },
  { value: "organization", label: "Organisation" },
  { value: "place", label: "Lieu" },
];

const ENTITY_TYPE_LABELS: Record<string, string> = {
  person: "Personne",
  organization: "Organisation",
  place: "Lieu",
};

function entityTypeLabel(type: string): string {
  return ENTITY_TYPE_LABELS[type] ?? type;
}

export function EntitiesTab() {
  const { toast } = useToast();

  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EntityRow | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiFetch<EntityRow[]>(`${ANNEXES_URL}?kind=entities`);
      setEntities(data);
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
    return entities.filter((entity) => {
      if (typeFilter !== "all" && entity.type !== typeFilter) return false;
      if (!q) return true;
      return (
        entity.name.toLowerCase().includes(q) ||
        entity.slug.toLowerCase().includes(q) ||
        (entity.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [entities, query, typeFilter]);

  return (
    <section aria-label="Entités de la rédaction">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold">Entités</h2>
          <p className="text-sm text-ink-soft">
            {loading
              ? "Chargement…"
              : `${entities.length} entité(s) — personnes, organisations, lieux`}
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
              placeholder="Rechercher une entité…"
              aria-label="Rechercher une entité"
              className="w-44 pl-8 sm:w-56"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger
              className="w-36"
              aria-label="Filtrer par type d'entité"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              {ENTITY_TYPES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Nouvelle entité
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-rule-strong bg-paper-alt px-6 py-14 text-center">
          <Users className="size-8 text-ink-faint" aria-hidden="true" />
          <p className="font-serif text-lg font-semibold">
            {query || typeFilter !== "all" ? "Aucune entité trouvée" : "Aucune entité"}
          </p>
          <p className="max-w-sm text-sm text-ink-soft">
            {query || typeFilter !== "all"
              ? "Modifiez la recherche ou le filtre de type."
              : "Les entités qualifient les articles : personnalités, organisations, lieux cités."}
          </p>
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Nouvelle entité
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-rule bg-paper">
          <div className="max-h-[520px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
            <Table aria-label="Liste des entités">
              <TableHeader className="sticky top-0 z-10 bg-paper-alt">
                <TableRow className="hover:bg-paper-alt">
                  <TableHead className="text-ink-soft">Nom</TableHead>
                  <TableHead className="text-ink-soft">Type</TableHead>
                  <TableHead className="hidden text-ink-soft md:table-cell">Slug</TableHead>
                  <TableHead className="w-14 text-right text-ink-soft">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((entity) => (
                  <TableRow key={entity.id} className="border-rule">
                    <TableCell className="max-w-72 py-2.5">
                      <p className="truncate font-medium">{entity.name}</p>
                      {entity.description ? (
                        <p className="truncate text-xs text-ink-faint">{entity.description}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <Badge
                        variant="outline"
                        className="gap-1 border-rule bg-paper-alt text-[11px] text-ink-soft"
                      >
                        {entity.type === "person" ? (
                          <User className="size-3" aria-hidden="true" />
                        ) : entity.type === "organization" ? (
                          <Building2 className="size-3" aria-hidden="true" />
                        ) : entity.type === "place" ? (
                          <MapPin className="size-3" aria-hidden="true" />
                        ) : null}
                        {entityTypeLabel(entity.type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden py-2.5 font-mono text-xs text-ink-faint md:table-cell">
                      {entity.slug}
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-ink-faint hover:text-ink"
                        onClick={() => setEditing(entity)}
                        aria-label={`Modifier l'entité ${entity.name}`}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {creating ? (
        <EntityDialog
          key="entity-create"
          open
          entity={null}
          onOpenChange={(open) => {
            if (!open) setCreating(false);
          }}
          onSaved={reload}
        />
      ) : null}
      {editing ? (
        <EntityDialog
          key={`entity-edit-${editing.id}`}
          open
          entity={editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          onSaved={reload}
        />
      ) : null}
    </section>
  );
}

// ─── Dialogue entité (création / édition) ──────────────────────────────

interface EntityDialogProps {
  open: boolean;
  entity: EntityRow | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}

function EntityDialog({ open, entity, onOpenChange, onSaved }: EntityDialogProps) {
  const { toast } = useToast();

  const [name, setName] = useState(entity?.name ?? "");
  const [type, setType] = useState<EntityType>("person");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState(entity?.description ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const save = async () => {
    if (!name.trim()) {
      setError("Le nom de l'entité est obligatoire.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (entity) {
        await apiFetch(ANNEXES_URL, {
          method: "PATCH",
          json: {
            kind: "entity",
            id: entity.id,
            name: name.trim(),
            description: description.trim() || null,
          },
        });
        toast({ title: "Entité mise à jour", description: name.trim() });
      } else {
        await apiFetch(ANNEXES_URL, {
          method: "POST",
          json: {
            kind: "entity",
            name: name.trim(),
            type,
            ...(slug.trim() ? { slug: slugify(slug) } : {}),
            ...(description.trim() ? { description: description.trim() } : {}),
          },
        });
        toast({ title: "Entité créée", description: name.trim() });
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
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            {entity ? `Modifier « ${entity.name} »` : "Nouvelle entité"}
          </DialogTitle>
          <DialogDescription>
            {entity
              ? "Seuls le nom et la description sont modifiables après création."
              : "Personnalités, organisations ou lieux cités dans les articles."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="entity-name">Nom *</Label>
            <Input
              id="entity-name"
              value={name}
              maxLength={300}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Ex. Banque centrale européenne"
              required
            />
          </div>
          {entity ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-soft">Type :</span>
              <Badge variant="outline" className="border-rule bg-paper-alt text-[11px] text-ink-soft">
                {entityTypeLabel(entity.type)}
              </Badge>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="entity-type">Type *</Label>
                <Select value={type} onValueChange={(value) => setType(value as EntityType)}>
                  <SelectTrigger id="entity-type" aria-label="Type d'entité">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="entity-slug">Slug</Label>
                <Input
                  id="entity-slug"
                  value={slug}
                  maxLength={300}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value);
                  }}
                  placeholder="banque-centrale-europeenne"
                  className="font-mono text-sm"
                />
              </div>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="entity-description">Description</Label>
            <Textarea
              id="entity-description"
              value={description}
              rows={3}
              maxLength={3000}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Rôle ou définition de l'entité"
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
            {pending ? "Enregistrement…" : entity ? "Enregistrer" : "Créer l'entité"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
