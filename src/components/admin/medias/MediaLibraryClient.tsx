"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiFetch, errorMessage } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  ExternalLink,
  FileText,
  Film,
  Image as ImageIcon,
  Link2,
  Loader2,
  Music,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";

/**
 * Médiathèque (§11.2 /admin/medias) :
 * - téléversement multiple par glisser-déposer ou sélecteur, métadonnées
 *   de lot (crédit obligatoire, licence facultative, alt complémentable),
 *   détection de doublons par checksum (contournement volontaire possible) ;
 * - grille filtrable (recherche, type), corbeille, pagination 24/page ;
 * - fiche média : métadonnées éditables, point focal cliquable (normalisé
 *   0..1 envoyé en PATCH), usages consultables avant suppression ;
 * - mise à la corbeille (confirmation forcée si usages), restauration,
 *   purge des orphelins (> 30 jours).
 */

// ─── Types ─────────────────────────────────────────────────────────────

type MediaType = "image" | "video" | "audio" | "document";

interface MediaVariant {
  w: number;
  format: string;
  url: string;
  size: number;
}

interface MediaRow {
  id: string;
  type: MediaType;
  url: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  title: string | null;
  alt_text: string | null;
  credit: string | null;
  license: string | null;
  checksum: string | null;
  created_at: string;
  /** Prisma BigInt : peut arriver en number ou en string selon la sérialisation. */
  file_size: unknown;
  variants: string | null;
}

interface ListMeta {
  total: number;
  page: number;
  pages: number;
}

interface FocalPoint {
  x: number;
  y: number;
}

type MetaField =
  | "title"
  | "alt_text"
  | "caption"
  | "credit"
  | "license"
  | "shot_at"
  | "location";

interface MediaMetaPatch {
  title?: string | null;
  alt_text?: string | null;
  caption?: string | null;
  credit?: string;
  license?: string | null;
  shot_at?: string | null;
  location?: string | null;
  focal_point?: FocalPoint;
}

interface UploadResponse {
  media: { id: string; url: string; duplicate: boolean };
  warning?: string;
}

type UploadStatus = "pending" | "uploading" | "done" | "duplicate" | "error";

interface StagedFile {
  uid: string;
  file: File;
  status: UploadStatus;
  message?: string;
}

interface MediaUsage {
  cover: { id: string; title: string; status: string }[];
  social: { id: string; title: string }[];
  avatars: { id: string; display_name: string }[];
  categories: { id: string; name: string }[];
  dossiers: { id: string; title: string }[];
  entities: { id: string; name: string }[];
  blocks: { id: string; title: string }[];
  featured: { id: string }[];
  total: number;
}

interface UsageLine {
  id: string;
  label: string;
  detail?: string;
  href: string | null;
}

interface UsageGroupView {
  label: string;
  lines: UsageLine[];
}

const PER_PAGE = 24;
const CREDIT_KEY = "infospro:medias:credit";
const LICENSE_KEY = "infospro:medias:license";
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const TYPE_LABEL: Record<MediaType, string> = {
  image: "Image",
  video: "Vidéo",
  audio: "Audio",
  document: "Document",
};

// ─── Helpers ───────────────────────────────────────────────────────────

function toNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function formatBytes(value: unknown): string {
  const n = toNum(value);
  if (n === null || n < 0) return "—";
  const fmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
  if (n < 1024) return `${fmt.format(n)} o`;
  if (n < 1024 * 1024) return `${fmt.format(n / 1024)} Ko`;
  return `${fmt.format(n / (1024 * 1024))} Mo`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function parseVariants(raw: string | null): MediaVariant[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (v): v is MediaVariant =>
        typeof v === "object" &&
        v !== null &&
        typeof (v as { url?: unknown }).url === "string" &&
        typeof (v as { w?: unknown }).w === "number"
    );
  } catch {
    return [];
  }
}

/** Miniature de grille : plus petite variante ≥ 480 px, sinon la plus grande, sinon l'original. */
function bestThumb(row: MediaRow): string {
  const variants = parseVariants(row.variants).sort((a, b) => a.w - b.w);
  if (variants.length > 0) {
    const fit = variants.find((v) => v.w >= 480);
    if (fit) return fit.url;
    return variants[variants.length - 1]?.url ?? row.url;
  }
  return row.url;
}

/** Aperçu grand format dans la fiche : la plus large variante disponible. */
function bestPreview(row: MediaRow): string {
  const variants = parseVariants(row.variants).sort((a, b) => b.w - a.w);
  return variants[0]?.url ?? row.url;
}

function typeBadgeLabel(row: MediaRow): string {
  if (row.type === "document" && row.mime_type.includes("pdf")) return "PDF";
  return TYPE_LABEL[row.type] ?? row.type;
}

function usageGroups(u: MediaUsage): UsageGroupView[] {
  return (
    [
      {
        label: "Couvertures d'articles",
        lines: u.cover.map((a) => ({
          id: a.id,
          label: a.title || "Sans titre",
          detail: a.status,
          href: `/admin/articles/${a.id}`,
        })),
      },
      {
        label: "Images sociales",
        lines: u.social.map((a) => ({
          id: a.id,
          label: a.title || "Sans titre",
          href: `/admin/articles/${a.id}`,
        })),
      },
      {
        label: "Blocs d'articles",
        lines: u.blocks.map((b) => ({
          id: b.id,
          label: b.title || "Sans titre",
          href: `/admin/articles/${b.id}`,
        })),
      },
      {
        label: "Avatars (utilisateurs)",
        lines: u.avatars.map((v) => ({ id: v.id, label: v.display_name, href: null })),
      },
      {
        label: "Rubriques",
        lines: u.categories.map((c) => ({ id: c.id, label: c.name, href: null })),
      },
      {
        label: "Dossiers",
        lines: u.dossiers.map((d) => ({ id: d.id, label: d.title, href: null })),
      },
      {
        label: "Entités",
        lines: u.entities.map((e) => ({ id: e.id, label: e.name, href: null })),
      },
      {
        label: "À la une (emplacements)",
        lines: u.featured.map((f) => ({
          id: f.id,
          label: `Emplacement ${f.id.slice(0, 8)}`,
          href: null,
        })),
      },
    ] as UsageGroupView[]
  ).filter((g) => g.lines.length > 0);
}

function typeIcon(type: MediaType) {
  if (type === "video") return <Film className="size-10 text-ink-faint" aria-hidden />;
  if (type === "audio") return <Music className="size-10 text-ink-faint" aria-hidden />;
  return <FileText className="size-10 text-ink-faint" aria-hidden />;
}

// ─── Composant principal ───────────────────────────────────────────────

export function MediaLibraryClient() {
  const { toast } = useToast();

  // Liste + pagination
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [meta, setMeta] = useState<ListMeta>({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filtres
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [type, setType] = useState<"all" | MediaType>("all");
  const [trash, setTrash] = useState(false);

  // Téléversement
  const [uploadOpen, setUploadOpen] = useState(false);
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [batchCredit, setBatchCredit] = useState("");
  const [batchLicense, setBatchLicense] = useState("");
  const [batchAlt, setBatchAlt] = useState("");
  const [forceUpload, setForceUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadCurrent, setUploadCurrent] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fiche média
  const [detail, setDetail] = useState<MediaRow | null>(null);
  const [fTitle, setFTitle] = useState("");
  const [fAlt, setFAlt] = useState("");
  const [fCaption, setFCaption] = useState("");
  const [fCredit, setFCredit] = useState("");
  const [fLicense, setFLicense] = useState("");
  const [fShotAt, setFShotAt] = useState("");
  const [fLocation, setFLocation] = useState("");
  const [focal, setFocal] = useState<FocalPoint>({ x: 0.5, y: 0.5 });
  const [dirty, setDirty] = useState<Set<MetaField>>(new Set());
  const [saving, setSaving] = useState(false);
  const [focalSaving, setFocalSaving] = useState(false);
  const [trashing, setTrashing] = useState(false);

  // Usages
  const [usageOpen, setUsageOpen] = useState(false);
  const [usageFor, setUsageFor] = useState<MediaRow | null>(null);
  const [usage, setUsage] = useState<MediaUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  // Suppression forcée (média utilisé)
  const [forceOpen, setForceOpen] = useState(false);
  const [forceTarget, setForceTarget] = useState<MediaRow | null>(null);
  const [forceUsage, setForceUsage] = useState<MediaUsage | null>(null);
  const [forcing, setForcing] = useState(false);

  // Purge
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purging, setPurging] = useState(false);

  // Restauration en cours (corbeille)
  const [restoringId, setRestoringId] = useState<string | null>(null);

  // Recherche debouncée
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  // Préremplissage du crédit / licence du dernier lot (productivité rédaction)
  useEffect(() => {
    try {
      const lastCredit = window.localStorage.getItem(CREDIT_KEY);
      if (lastCredit) setBatchCredit(lastCredit);
      const lastLicense = window.localStorage.getItem(LICENSE_KEY);
      if (lastLicense) setBatchLicense(lastLicense);
    } catch {
      // localStorage indisponible : champs vides
    }
  }, []);

  const load = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      setLoadError(null);
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          per_page: String(PER_PAGE),
        });
        if (debouncedQ) params.set("q", debouncedQ);
        if (type !== "all") params.set("type", type);
        if (trash) params.set("trash", "1");
        const { data, meta: m } = await apiFetch<MediaRow[]>(`/api/admin/media?${params.toString()}`);
        setRows(Array.isArray(data) ? data : []);
        setMeta({
          total: Number(m?.total ?? 0),
          page: Number(m?.page ?? targetPage),
          pages: Number(m?.pages ?? 1),
        });
      } catch (error) {
        setRows([]);
        setMeta({ total: 0, page: 1, pages: 1 });
        setLoadError(errorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [debouncedQ, type, trash]
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  // ── Téléversement ────────────────────────────────────────────────────

  const stageFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    setStaged((prev) => [
      ...prev,
      ...files.map((file) => ({
        uid: `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
        file,
        status: file.size > MAX_UPLOAD_BYTES ? ("error" as const) : ("pending" as const),
        message:
          file.size > MAX_UPLOAD_BYTES
            ? "Trop volumineux (25 Mo maximum)."
            : undefined,
      })),
    ]);
    setUploadOpen(true);
  }, []);

  const runUpload = useCallback(async () => {
    const credit = batchCredit.trim();
    if (!credit) return;
    const queue = staged.filter((s) => s.status === "pending");
    if (queue.length === 0) return;

    setUploading(true);
    try {
      window.localStorage.setItem(CREDIT_KEY, credit);
      if (batchLicense.trim()) window.localStorage.setItem(LICENSE_KEY, batchLicense.trim());
    } catch {
      // localStorage indisponible : sans incidence
    }

    let done = 0;
    let duplicates = 0;
    let failures = 0;

    for (const item of queue) {
      setUploadCurrent(item.file.name);
      setStaged((prev) =>
        prev.map((s) => (s.uid === item.uid ? { ...s, status: "uploading", message: undefined } : s))
      );
      try {
        const form = new FormData();
        form.set("file", item.file);
        form.set("title", item.file.name.replace(/\.[a-z0-9]+$/i, ""));
        form.set("credit", credit);
        if (batchLicense.trim()) form.set("license", batchLicense.trim());
        if (batchAlt.trim()) form.set("alt_text", batchAlt.trim());
        if (forceUpload) form.set("force", "1");
        const { data } = await apiFetch<UploadResponse>("/api/admin/media", {
          method: "POST",
          body: form,
        });
        if (data.media?.duplicate) {
          duplicates += 1;
          setStaged((prev) =>
            prev.map((s) =>
              s.uid === item.uid
                ? { ...s, status: "duplicate", message: data.warning ?? "Ce média existe déjà." }
                : s
            )
          );
          toast({ title: "Doublon détecté", description: data.warning ?? "Ce média existe déjà dans la médiathèque." });
        } else {
          done += 1;
          setStaged((prev) =>
            prev.map((s) => (s.uid === item.uid ? { ...s, status: "done", message: undefined } : s))
          );
        }
      } catch (error) {
        failures += 1;
        setStaged((prev) =>
          prev.map((s) =>
            s.uid === item.uid ? { ...s, status: "error", message: errorMessage(error) } : s
          )
        );
      }
    }

    setUploading(false);
    setUploadCurrent("");
    if (done > 0) {
      const extra = [
        duplicates > 0 ? `${duplicates} doublon(s)` : null,
        failures > 0 ? `${failures} échec(s)` : null,
      ]
        .filter((x): x is string => x !== null)
        .join(", ");
      toast({
        title: "Téléversement terminé",
        description: `${done} média(s) ajouté(s)${extra ? ` · ${extra}` : ""}.`,
      });
      setBatchAlt("");
      await load(1);
    }
  }, [batchAlt, batchCredit, batchLicense, forceUpload, load, staged, toast]);

  const processedCount = staged.filter(
    (s) => s.status === "done" || s.status === "duplicate" || s.status === "error"
  ).length;
  const pendingCount = staged.filter((s) => s.status === "pending").length;
  const uploadProgress =
    staged.length > 0 ? Math.round((processedCount / staged.length) * 100) : 0;
  const stagedTotalSize = staged.reduce((acc, s) => acc + s.file.size, 0);

  // ── Fiche média (métadonnées + point focal) ──────────────────────────

  const openDetail = useCallback((row: MediaRow) => {
    setDetail(row);
    setFTitle(row.title ?? "");
    setFAlt(row.alt_text ?? "");
    setFCaption("");
    setFCredit(row.credit ?? "");
    setFLicense(row.license ?? "");
    setFShotAt("");
    setFLocation("");
    setFocal({ x: 0.5, y: 0.5 });
    setDirty(new Set());
  }, []);

  const markDirty = useCallback((field: MetaField) => {
    setDirty((prev) => {
      const next = new Set(prev);
      next.add(field);
      return next;
    });
  }, []);

  const saveMeta = useCallback(async () => {
    if (!detail || dirty.size === 0 || saving) return;
    if (dirty.has("credit") && !fCredit.trim()) {
      toast({
        title: "Crédit obligatoire",
        description: "Le crédit ne peut pas être vide.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const body: MediaMetaPatch = {};
    if (dirty.has("title")) body.title = fTitle.trim() || null;
    if (dirty.has("alt_text")) body.alt_text = fAlt.trim() || null;
    if (dirty.has("caption")) body.caption = fCaption.trim() || null;
    if (dirty.has("credit")) body.credit = fCredit.trim();
    if (dirty.has("license")) body.license = fLicense.trim() || null;
    if (dirty.has("shot_at")) {
      body.shot_at = fShotAt ? new Date(`${fShotAt}T12:00:00.000Z`).toISOString() : null;
    }
    if (dirty.has("location")) body.location = fLocation.trim() || null;
    try {
      await apiFetch<{ ok: boolean }>(`/api/admin/media/${detail.id}`, {
        method: "PATCH",
        json: body,
      });
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              title: body.title !== undefined ? body.title : prev.title,
              alt_text: body.alt_text !== undefined ? body.alt_text : prev.alt_text,
              credit: body.credit !== undefined ? body.credit : prev.credit,
              license: body.license !== undefined ? body.license : prev.license,
            }
          : prev
      );
      setRows((prev) =>
        prev.map((r) =>
          r.id === detail.id
            ? {
                ...r,
                title: body.title !== undefined ? body.title : r.title,
                alt_text: body.alt_text !== undefined ? body.alt_text : r.alt_text,
                credit: body.credit !== undefined ? body.credit : r.credit,
                license: body.license !== undefined ? body.license : r.license,
              }
            : r
        )
      );
      setDirty(new Set());
      toast({ title: "Métadonnées enregistrées" });
    } catch (error) {
      toast({
        title: "Enregistrement refusé",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [detail, dirty, fAlt, fCaption, fCredit, fLicense, fLocation, fShotAt, fTitle, saving, toast]);

  const saveFocal = useCallback(
    async (point: FocalPoint) => {
      if (!detail) return;
      setFocalSaving(true);
      try {
        await apiFetch<{ ok: boolean }>(`/api/admin/media/${detail.id}`, {
          method: "PATCH",
          json: { focal_point: point } satisfies MediaMetaPatch,
        });
        setFocal(point);
        toast({ title: "Point focal enregistré" });
      } catch (error) {
        toast({
          title: "Point focal refusé",
          description: errorMessage(error),
          variant: "destructive",
        });
      } finally {
        setFocalSaving(false);
      }
    },
    [detail, toast]
  );

  // ── Usages ───────────────────────────────────────────────────────────

  const fetchUsages = useCallback(
    async (id: string): Promise<MediaUsage | null> => {
      try {
        const { data } = await apiFetch<MediaUsage>(`/api/admin/media/${id}?usage=1`);
        return data;
      } catch (error) {
        toast({
          title: "Usages indisponibles",
          description: errorMessage(error),
          variant: "destructive",
        });
        return null;
      }
    },
    [toast]
  );

  const openUsages = useCallback(
    async (row: MediaRow) => {
      setUsageFor(row);
      setUsage(null);
      setUsageOpen(true);
      setUsageLoading(true);
      const u = await fetchUsages(row.id);
      setUsage(u);
      setUsageLoading(false);
    },
    [fetchUsages]
  );

  // ── Corbeille / restauration / purge ────────────────────────────────

  const closeDetail = useCallback(() => {
    setDetail(null);
    setDirty(new Set());
  }, []);

  const trashCurrent = useCallback(async () => {
    if (!detail || trashing) return;
    setTrashing(true);
    try {
      await apiFetch<{ ok: boolean }>(`/api/admin/media/${detail.id}`, { method: "DELETE" });
      toast({ title: "Média déplacé à la corbeille" });
      closeDetail();
      await load(meta.page);
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        const u = await fetchUsages(detail.id);
        setForceTarget(detail);
        setForceUsage(u);
        setForceOpen(true);
      } else {
        toast({
          title: "Suppression refusée",
          description: errorMessage(error),
          variant: "destructive",
        });
      }
    } finally {
      setTrashing(false);
    }
  }, [closeDetail, detail, fetchUsages, load, meta.page, toast, trashing]);

  const confirmForceTrash = useCallback(async () => {
    if (!forceTarget || forcing) return;
    setForcing(true);
    try {
      await apiFetch<{ ok: boolean }>(`/api/admin/media/${forceTarget.id}?force=1`, {
        method: "DELETE",
      });
      toast({
        title: "Média déplacé à la corbeille",
        description: "Les contenus qui l'utilisaient conservent leur référence.",
      });
      setForceOpen(false);
      setForceTarget(null);
      setForceUsage(null);
      closeDetail();
      await load(meta.page);
    } catch (error) {
      toast({
        title: "Suppression refusée",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setForcing(false);
    }
  }, [closeDetail, forceTarget, forcing, load, meta.page, toast]);

  const restoreRow = useCallback(
    async (row: MediaRow) => {
      setRestoringId(row.id);
      try {
        await apiFetch<{ ok: boolean }>(`/api/admin/media/${row.id}?restore=1`, {
          method: "DELETE",
        });
        toast({ title: "Média restauré", description: row.title ?? row.id });
        await load(meta.page);
      } catch (error) {
        toast({
          title: "Restauration impossible",
          description: errorMessage(error),
          variant: "destructive",
        });
      } finally {
        setRestoringId(null);
      }
    },
    [load, meta.page, toast]
  );

  const purgeOrphans = useCallback(async () => {
    setPurging(true);
    try {
      const { data } = await apiFetch<{ purged: number }>("/api/admin/media/purge", {
        method: "POST",
      });
      if (data.purged > 0) {
        toast({
          title: "Purge terminée",
          description: `${data.purged} média(s) définitivement supprimé(s).`,
        });
      } else {
        toast({
          title: "Aucun orphelin à purger",
          description: "Les médias de la corbeille ont moins de 30 jours.",
        });
      }
      setPurgeOpen(false);
      await load(meta.page);
    } catch (error) {
      toast({
        title: "Purge impossible",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setPurging(false);
    }
  }, [load, meta.page, toast]);

  const hasActiveFilters = debouncedQ !== "" || type !== "all";
  const creditInvalid = dirty.has("credit") && fCredit.trim() === "";

  // ─── Rendu ───────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      {/* En-tête */}
      <header className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div>
          <p className="kicker text-ink-faint">Back-office · Édition</p>
          <h1 className="font-serif text-2xl font-bold text-ink">Médiathèque</h1>
        </div>
        <p className="text-sm text-ink-faint" aria-live="polite">
          {trash
            ? `${meta.total} média(s) dans la corbeille`
            : `${meta.total} média(s)`}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {trash && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPurgeOpen(true)}
              aria-label="Purger les médias orphelins de plus de 30 jours"
            >
              <Trash2 className="mr-1 size-4" aria-hidden />
              Purger les orphelins (&gt; 30 j)
            </Button>
          )}
          <Button
            size="sm"
            className="bg-brand-red text-white hover:bg-red-deep"
            onClick={() => {
              if (trash) setTrash(false);
              setUploadOpen(true);
            }}
          >
            <Upload className="mr-1 size-4" aria-hidden />
            Téléverser
          </Button>
        </div>
      </header>

      {/* Onglets bibliothèque / corbeille + filtres */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-sm border border-rule bg-paper-alt p-3">
        <Tabs value={trash ? "trash" : "library"} onValueChange={(v) => setTrash(v === "trash")}>
          <TabsList className="rounded-sm bg-paper-sunk" aria-label="Vue bibliothèque ou corbeille">
            <TabsTrigger value="library" className="rounded-sm text-xs">Bibliothèque</TabsTrigger>
            <TabsTrigger value="trash" className="rounded-sm text-xs">
              Corbeille
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-ink-faint" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un titre, un alt, un crédit…"
            className="pl-8"
            aria-label="Rechercher un média"
          />
        </div>
        <Select value={type} onValueChange={(v) => setType(v as "all" | MediaType)}>
          <SelectTrigger className="w-40" aria-label="Type de média">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            <SelectItem value="image">Images</SelectItem>
            <SelectItem value="video">Vidéos</SelectItem>
            <SelectItem value="audio">Audios</SelectItem>
            <SelectItem value="document">Documents</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Zone de dépôt (bibliothèque uniquement) */}
      {!trash && (
        <div
          className={cn(
            "mt-3 rounded-sm border border-dashed border-rule bg-paper p-4 text-center transition-colors",
            dragActive && "border-brand-red bg-red-wash"
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            stageFiles(Array.from(e.dataTransfer.files));
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/mp4,video/quicktime,audio/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) stageFiles(Array.from(e.target.files));
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Sélectionner des fichiers à téléverser"
          >
            <Upload className="mr-2 size-4" aria-hidden />
            Sélectionner des fichiers
          </Button>
          <p className="mt-1 text-xs text-ink-faint">
            ou glissez-déposez ici · JPG, PNG, WebP, AVIF, GIF, MP4, MP3, PDF · 25 Mo max par fichier
          </p>
        </div>
      )}

      {/* Contenu */}
      {loading ? (
        <div
          className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
          role="status"
          aria-label="Chargement de la médiathèque"
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="aspect-square w-full rounded-sm" />
              <Skeleton className="mt-2 h-3.5 w-3/4 rounded-sm" />
              <Skeleton className="mt-1 h-3 w-1/2 rounded-sm" />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="mt-4 rounded-sm border border-rule bg-paper p-10 text-center">
          <AlertTriangle className="mx-auto size-8 text-brand-red" aria-hidden />
          <p className="mt-3 font-serif text-lg font-semibold text-ink">Chargement impossible</p>
          <p className="mt-1 text-sm text-ink-soft">{loadError}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => void load(1)}>
            Réessayer
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          trash={trash}
          hasFilters={hasActiveFilters}
          onUpload={() => setUploadOpen(true)}
          onClearFilters={() => {
            setQ("");
            setType("all");
          }}
        />
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {rows.map((row) => (
            <li key={row.id}>
              {trash ? (
                <TrashCard row={row} restoring={restoringId === row.id} onRestore={() => void restoreRow(row)} />
              ) : (
                <MediaCard row={row} onOpen={() => openDetail(row)} />
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Pagination */}
      {!loading && !loadError && meta.pages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Pagination de la médiathèque">
          <Button
            variant="outline"
            size="sm"
            disabled={meta.page <= 1}
            onClick={() => void load(meta.page - 1)}
            aria-label="Page précédente"
          >
            <ChevronLeft className="mr-1 size-4" aria-hidden />
            Précédent
          </Button>
          <span className="text-sm text-ink-soft">
            Page {meta.page} sur {meta.pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={meta.page >= meta.pages}
            onClick={() => void load(meta.page + 1)}
            aria-label="Page suivante"
          >
            Suivant
            <ChevronRight className="ml-1 size-4" aria-hidden />
          </Button>
        </nav>
      )}

      {/* ── Dialogue de téléversement (lot) ─────────────────────────── */}
      <Dialog
        open={uploadOpen}
        onOpenChange={(o) => {
          if (!o && uploading) return; // verrouille la fermeture pendant l'envoi
          if (!o) {
            setStaged([]);
            setBatchAlt("");
          }
          setUploadOpen(o);
        }}
      >
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden bg-paper sm:max-w-lg">
          <DialogHeader className="shrink-0">
            <DialogTitle className="font-serif">Téléverser des médias</DialogTitle>
            <DialogDescription>
              {staged.length} fichier(s) · {formatBytes(stagedTotalSize)} · métadonnées appliquées au lot
            </DialogDescription>
          </DialogHeader>

          <div
            className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1"
            style={{ scrollbarWidth: "thin" }}
          >
            {/* Liste des fichiers du lot */}
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded-sm border border-rule bg-paper-alt p-2" style={{ scrollbarWidth: "thin" }}>
              {staged.map((s) => (
                <li key={s.uid} className="flex items-center gap-2 text-sm">
                  <StagedStatusIcon status={s.status} />
                  <span className="min-w-0 flex-1 truncate text-ink" title={s.file.name}>
                    {s.file.name}
                  </span>
                  <span className="shrink-0 text-xs text-ink-faint">{formatBytes(s.file.size)}</span>
                  <span
                    className={cn(
                      "w-16 shrink-0 text-right text-xs font-medium",
                      s.status === "done" && "text-success",
                      s.status === "duplicate" && "text-warning",
                      s.status === "error" && "text-brand-red",
                      (s.status === "pending" || s.status === "uploading") && "text-ink-faint"
                    )}
                  >
                    {s.status === "done" && "Ajouté"}
                    {s.status === "duplicate" && "Doublon"}
                    {s.status === "error" && "Échec"}
                    {s.status === "uploading" && "Envoi…"}
                    {s.status === "pending" && "En attente"}
                  </span>
                  <button
                    type="button"
                    className="rounded-sm p-1 text-ink-faint transition-colors hover:bg-paper-sunk hover:text-brand-red disabled:opacity-40"
                    onClick={() => setStaged((prev) => prev.filter((x) => x.uid !== s.uid))}
                    disabled={uploading}
                    aria-label={`Retirer ${s.file.name} du lot`}
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                  {s.message && (
                    <p className="w-full text-xs text-ink-faint" role="note">
                      {s.message}
                    </p>
                  )}
                </li>
              ))}
            </ul>

            <Separator className="bg-rule" />

            {/* Métadonnées du lot */}
            <div className="space-y-1.5">
              <Label htmlFor="batch-credit">
                Crédit <span className="text-brand-red">*</span>
              </Label>
              <Input
                id="batch-credit"
                value={batchCredit}
                onChange={(e) => setBatchCredit(e.target.value)}
                placeholder="Agence, photographe, rights-holder…"
                disabled={uploading}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="batch-license">Licence</Label>
              <Input
                id="batch-license"
                value={batchLicense}
                onChange={(e) => setBatchLicense(e.target.value)}
                placeholder="Ex. : CC BY 4.0, Rights-managed, Domaine public"
                disabled={uploading}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="batch-alt">Texte alternatif</Label>
              <Textarea
                id="batch-alt"
                value={batchAlt}
                onChange={(e) => setBatchAlt(e.target.value)}
                placeholder="Description de l'image pour les lecteurs d'écran…"
                rows={2}
                disabled={uploading}
              />
              <p className="text-xs text-ink-faint">
                Facultatif à l&apos;envoi : complétable fiche par fiche ensuite — mais l&apos;alt
                est obligatoire pour la publication.
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-sm border border-rule bg-paper-alt p-2.5">
              <div>
                <Label htmlFor="batch-force" className="text-sm">
                  Ignorer la détection de doublons
                </Label>
                <p className="text-xs text-ink-faint">Force le téléversement même si le checksum existe déjà.</p>
              </div>
              <Switch
                id="batch-force"
                checked={forceUpload}
                onCheckedChange={setForceUpload}
                disabled={uploading}
                aria-label="Forcer le téléversement malgré les doublons"
              />
            </div>

            {/* Progression du lot */}
            {uploading && (
              <div className="space-y-1.5">
                <Progress value={uploadProgress} aria-label="Progression du téléversement" />
                <p className="text-xs text-ink-faint" aria-live="polite">
                  {processedCount}/{staged.length} — {uploadCurrent}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0">
            <Button
              variant="ghost"
              onClick={() => setUploadOpen(false)}
              disabled={uploading}
            >
              {uploading ? "Envoi en cours…" : "Fermer"}
            </Button>
            <Button
              className="bg-brand-red text-white hover:bg-red-deep"
              onClick={() => void runUpload()}
              disabled={uploading || pendingCount === 0 || batchCredit.trim() === ""}
            >
              {uploading ? (
                <Loader2 className="mr-1 size-4 animate-spin" aria-hidden />
              ) : (
                <Upload className="mr-1 size-4" aria-hidden />
              )}
              Téléverser {pendingCount > 0 ? `(${pendingCount})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Fiche média ─────────────────────────────────────────────── */}
      <Dialog
        open={detail !== null}
        onOpenChange={(o) => {
          if (!o) closeDetail();
        }}
      >
        <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden bg-paper sm:max-w-4xl">
          <DialogHeader className="shrink-0">
            <DialogTitle className="truncate pr-6 font-serif">
              {detail?.title ?? "Média"}
            </DialogTitle>
            <DialogDescription>
              {detail
                ? `${TYPE_LABEL[detail.type]} · ${detail.mime_type} · ajouté le ${formatDate(detail.created_at)}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {detail && (
            <div
              className="min-h-0 flex-1 overflow-y-auto pr-1"
              style={{ scrollbarWidth: "thin" }}
            >
              <div className="grid gap-6 md:grid-cols-2">
                {/* Aperçu + point focal + infos techniques */}
                <div className="space-y-4">
                  {detail.type === "image" ? (
                    <FocalPointEditor
                      url={bestPreview(detail)}
                      alt={detail.alt_text ?? detail.title ?? "Aperçu du média"}
                      focal={focal}
                      saving={focalSaving}
                      onSet={(p) => void saveFocal(p)}
                    />
                  ) : detail.type === "video" ? (
                    <video
                      controls
                      preload="metadata"
                      src={detail.url}
                      className="max-h-[38vh] w-full rounded-sm border border-rule bg-ink"
                      aria-label={`Aperçu vidéo : ${detail.title ?? detail.id}`}
                    />
                  ) : detail.type === "audio" ? (
                    <div className="space-y-3 rounded-sm border border-rule bg-paper-alt p-4">
                      <Music className="size-8 text-ink-faint" aria-hidden />
                      <audio
                        controls
                        src={detail.url}
                        className="w-full"
                        aria-label={`Écouter : ${detail.title ?? detail.id}`}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 rounded-sm border border-rule bg-paper-alt p-6">
                      <FileText className="size-10 text-ink-faint" aria-hidden />
                      <a
                        href={detail.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium text-brand-red underline underline-offset-2 hover:text-red-deep"
                      >
                        Ouvrir le document
                        <ExternalLink className="size-3.5" aria-hidden />
                      </a>
                    </div>
                  )}

                  <dl className="space-y-1 rounded-sm border border-rule bg-paper-alt p-3 text-xs text-ink-soft">
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-faint">Dimensions</dt>
                      <dd className="tabular-nums">
                        {detail.width && detail.height ? `${detail.width} × ${detail.height} px` : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-faint">Poids</dt>
                      <dd className="tabular-nums">{formatBytes(detail.file_size)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-faint">Licence</dt>
                      <dd>{detail.license ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-faint">Checksum</dt>
                      <dd className="truncate font-mono" title={detail.checksum ?? undefined}>
                        {detail.checksum ? `${detail.checksum.slice(0, 12)}…` : "—"}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Métadonnées éditables */}
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="meta-title">Titre</Label>
                    <Input
                      id="meta-title"
                      value={fTitle}
                      onChange={(e) => {
                        setFTitle(e.target.value);
                        markDirty("title");
                      }}
                      maxLength={300}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="meta-alt">
                      Texte alternatif <span className="text-brand-red">*</span> (obligatoire pour
                      la publication)
                    </Label>
                    <Textarea
                      id="meta-alt"
                      value={fAlt}
                      onChange={(e) => {
                        setFAlt(e.target.value);
                        markDirty("alt_text");
                      }}
                      rows={3}
                      maxLength={1000}
                      aria-required="true"
                    />
                    {detail.type === "image" && fAlt.trim() === "" && (
                      <p className="flex items-start gap-1 text-xs text-amber-700" role="note">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        Les images sans texte alternatif sont bloquées à la publication.
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="meta-caption">Légende</Label>
                    <Textarea
                      id="meta-caption"
                      value={fCaption}
                      onChange={(e) => {
                        setFCaption(e.target.value);
                        markDirty("caption");
                      }}
                      rows={2}
                      maxLength={1000}
                      placeholder="Affichée sous l'image dans les articles."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="meta-credit">
                      Crédit <span className="text-brand-red">*</span>
                    </Label>
                    <Input
                      id="meta-credit"
                      value={fCredit}
                      onChange={(e) => {
                        setFCredit(e.target.value);
                        markDirty("credit");
                      }}
                      maxLength={300}
                      required
                      aria-invalid={creditInvalid}
                    />
                    {creditInvalid && (
                      <p className="text-xs text-brand-red" role="alert">
                        Le crédit ne peut pas être vide.
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="meta-license">Licence</Label>
                    <Input
                      id="meta-license"
                      value={fLicense}
                      onChange={(e) => {
                        setFLicense(e.target.value);
                        markDirty("license");
                      }}
                      maxLength={200}
                      placeholder="Ex. : CC BY 4.0"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="meta-shot">Date de prise de vue</Label>
                      <Input
                        id="meta-shot"
                        type="date"
                        value={fShotAt}
                        onChange={(e) => {
                          setFShotAt(e.target.value);
                          markDirty("shot_at");
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="meta-location">Lieu</Label>
                      <Input
                        id="meta-location"
                        value={fLocation}
                        onChange={(e) => {
                          setFLocation(e.target.value);
                          markDirty("location");
                        }}
                        maxLength={300}
                        placeholder="Ex. : Dakar, Sénégal"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="shrink-0 flex-wrap items-center gap-2 border-t border-rule pt-3 sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => detail && void openUsages(detail)}
              aria-label="Voir les contenus utilisant ce média"
            >
              <Link2 className="mr-1 size-4" aria-hidden />
              Voir les usages
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-brand-red hover:bg-red-wash hover:text-red-deep"
                onClick={() => void trashCurrent()}
                disabled={trashing || saving}
                aria-label="Mettre ce média à la corbeille"
              >
                {trashing ? (
                  <Loader2 className="mr-1 size-4 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="mr-1 size-4" aria-hidden />
                )}
                Mettre à la corbeille
              </Button>
              <Button
                size="sm"
                className="bg-brand-red text-white hover:bg-red-deep"
                onClick={() => void saveMeta()}
                disabled={dirty.size === 0 || saving || creditInvalid}
                aria-label="Enregistrer les métadonnées"
              >
                {saving ? (
                  <Loader2 className="mr-1 size-4 animate-spin" aria-hidden />
                ) : (
                  <Check className="mr-1 size-4" aria-hidden />
                )}
                Enregistrer
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Usages du média ────────────────────────────────────────── */}
      <Dialog open={usageOpen} onOpenChange={setUsageOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden bg-paper sm:max-w-lg">
          <DialogHeader className="shrink-0">
            <DialogTitle className="font-serif">Usages du média</DialogTitle>
            <DialogDescription className="truncate">
              {usageFor?.title ?? usageFor?.id ?? ""}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1" style={{ scrollbarWidth: "thin" }}>
            {usageLoading ? (
              <div className="space-y-2 py-2" role="status" aria-label="Chargement des usages">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-sm" />
                ))}
              </div>
            ) : usage ? (
              <UsagePanel usage={usage} />
            ) : (
              <p className="py-6 text-center text-sm text-ink-faint">
                Usages indisponibles pour ce média.
              </p>
            )}
          </div>
          {usage && (
            <DialogFooter className="shrink-0 border-t border-rule pt-3">
              <p className="mr-auto text-sm text-ink-soft">
                Total : <span className="font-semibold text-ink">{usage.total}</span> usage(s)
              </p>
              <Button variant="ghost" size="sm" onClick={() => setUsageOpen(false)}>
                Fermer
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Suppression forcée (média utilisé) ─────────────────────── */}
      <AlertDialog open={forceOpen} onOpenChange={(o) => { if (!o && !forcing) { setForceOpen(false); setForceTarget(null); setForceUsage(null); } }}>
        <AlertDialogContent className="flex max-h-[85vh] flex-col overflow-hidden bg-paper sm:max-w-lg">
          <AlertDialogHeader className="shrink-0">
            <AlertDialogTitle className="font-serif">
              {forceUsage
                ? `Ce média est utilisé par ${forceUsage.total} contenu(s)`
                : "Média utilisé par des contenus"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Le média passera à la corbeille ; les contenus listés conserveront leur référence.
              Cette action reste traçable dans le journal d&apos;audit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div
            className="min-h-0 flex-1 overflow-y-auto rounded-sm border border-rule bg-paper-alt p-3"
            style={{ scrollbarWidth: "thin" }}
          >
            {forceUsage ? (
              <UsagePanel usage={forceUsage} compact />
            ) : (
              <p className="py-4 text-center text-sm text-ink-faint">
                Détail des usages indisponible.
              </p>
            )}
          </div>
          <AlertDialogFooter className="shrink-0">
            <AlertDialogCancel disabled={forcing}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-brand-red text-white hover:bg-red-deep"
              onClick={(e) => {
                e.preventDefault();
                void confirmForceTrash();
              }}
              disabled={forcing}
            >
              {forcing ? (
                <Loader2 className="mr-1 size-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="mr-1 size-4" aria-hidden />
              )}
              Confirmer quand même
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Purge des orphelins ────────────────────────────────────── */}
      <AlertDialog open={purgeOpen} onOpenChange={(o) => { if (!o && !purging) setPurgeOpen(false); }}>
        <AlertDialogContent className="bg-paper">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Purger les orphelins ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les médias présents en corbeille depuis plus de 30 jours seront définitivement
              supprimés (fichiers et variantes inclus). Action irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={purging}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-brand-red text-white hover:bg-red-deep"
              onClick={(e) => {
                e.preventDefault();
                void purgeOrphans();
              }}
              disabled={purging}
            >
              {purging ? (
                <Loader2 className="mr-1 size-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="mr-1 size-4" aria-hidden />
              )}
              Purger
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Sous-composants ───────────────────────────────────────────────────

function StagedStatusIcon({ status }: { status: UploadStatus }) {
  if (status === "done")
    return <Check className="size-4 shrink-0 text-success" aria-hidden />;
  if (status === "duplicate")
    return <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />;
  if (status === "error")
    return <X className="size-4 shrink-0 text-brand-red" aria-hidden />;
  if (status === "uploading")
    return <Loader2 className="size-4 shrink-0 animate-spin text-ink-faint" aria-hidden />;
  return <span className="size-4 shrink-0 rounded-full border border-rule-strong" aria-hidden />;
}

function MediaCard({ row, onOpen }: { row: MediaRow; onOpen: () => void }) {
  const isImage = row.type === "image";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group block w-full rounded-sm text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red hover:ring-2 hover:ring-brand-red"
      aria-label={`Ouvrir la fiche du média ${row.title ?? row.id}`}
    >
      <span className="relative block aspect-square overflow-hidden rounded-sm border border-rule bg-paper-sunk">
        {isImage ? (
           
          <img
            src={bestThumb(row)}
            alt={row.alt_text ?? row.title ?? ""}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            {typeIcon(row.type)}
          </span>
        )}
        {!isImage && (
          <Badge
            variant="outline"
            className="absolute left-1.5 top-1.5 border-rule bg-paper text-[10px] uppercase tracking-wide text-ink-soft"
          >
            {typeBadgeLabel(row)}
          </Badge>
        )}
        {isImage && !row.alt_text && (
          <Badge className="absolute right-1.5 top-1.5 border border-amber-200 bg-amber-50 text-[10px] font-semibold text-amber-800">
            Alt manquant
          </Badge>
        )}
      </span>
      <span className="mt-1.5 block truncate text-sm font-medium text-ink" title={row.title ?? row.id}>
        {row.title ?? "Sans titre"}
      </span>
      <span className="block truncate text-xs text-ink-faint">
        {row.credit ?? "—"} · {formatDate(row.created_at)}
      </span>
    </button>
  );
}

function TrashCard({
  row,
  restoring,
  onRestore,
}: {
  row: MediaRow;
  restoring: boolean;
  onRestore: () => void;
}) {
  return (
    <div className="block w-full rounded-sm opacity-90">
      <div className="relative aspect-square overflow-hidden rounded-sm border border-rule bg-paper-sunk">
        {row.type === "image" ? (
           
          <img
            src={bestThumb(row)}
            alt={row.alt_text ?? row.title ?? ""}
            className="h-full w-full object-cover grayscale"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">{typeIcon(row.type)}</div>
        )}
        <Badge
          variant="outline"
          className="absolute left-1.5 top-1.5 border-rule bg-paper text-[10px] uppercase tracking-wide text-ink-faint"
        >
          Corbeille
        </Badge>
      </div>
      <p className="mt-1.5 truncate text-sm font-medium text-ink" title={row.title ?? row.id}>
        {row.title ?? "Sans titre"}
      </p>
      <p className="truncate text-xs text-ink-faint">
        Supprimé le {formatDate(row.created_at)}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-1.5 w-full"
        onClick={onRestore}
        disabled={restoring}
        aria-label={`Restaurer le média ${row.title ?? row.id}`}
      >
        {restoring ? (
          <Loader2 className="mr-1 size-4 animate-spin" aria-hidden />
        ) : (
          <RotateCcw className="mr-1 size-4" aria-hidden />
        )}
        Restaurer
      </Button>
    </div>
  );
}

function FocalPointEditor({
  url,
  alt,
  focal,
  saving,
  onSet,
}: {
  url: string;
  alt: string;
  focal: FocalPoint;
  saving: boolean;
  onSet: (point: FocalPoint) => void;
}) {
  const handleClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    onSet({ x: round3(x), y: round3(y) });
  };

  return (
    <div>
      <div className="relative select-none overflow-hidden rounded-sm border border-rule bg-paper-sunk">
        { }
        <img
          src={url}
          alt={alt}
          className="max-h-[38vh] w-full cursor-crosshair object-contain"
          onClick={handleClick}
          draggable={false}
        />
        <span
          className="pointer-events-none absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-brand-red bg-white/20 shadow"
          style={{ left: `${focal.x * 100}%`, top: `${focal.y * 100}%` }}
          role="img"
          aria-label={`Point focal : x ${focal.x.toLocaleString("fr-FR")}, y ${focal.y.toLocaleString("fr-FR")}`}
        >
          <span className="size-1.5 rounded-full bg-brand-red" aria-hidden />
        </span>
        {saving && (
          <span className="absolute right-1.5 top-1.5 rounded-sm bg-paper/90 px-1.5 py-0.5 text-xs text-ink-soft">
            <Loader2 className="mr-1 inline size-3 animate-spin" aria-hidden />
            Enregistrement…
          </span>
        )}
      </div>
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-faint">
        <Crosshair className="size-3.5 shrink-0" aria-hidden />
        Cliquez sur l&apos;image pour définir le point focal — il guide les recadrages
        automatiques (16:9, 1:1…).
      </p>
    </div>
  );
}

function UsagePanel({ usage, compact = false }: { usage: MediaUsage; compact?: boolean }) {
  const groups = useMemo(() => usageGroups(usage), [usage]);
  if (groups.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-ink-faint">
        Aucun contenu n&apos;utilise ce média — suppression sans impact.
      </p>
    );
  }
  return (
    <div className={compact ? "space-y-3" : "space-y-4 py-1"}>
      {groups.map((group) => (
        <section key={group.label}>
          <p className="kicker text-ink-faint">
            {group.label} ({group.lines.length})
          </p>
          <ul className={cn("mt-1 space-y-0.5", "max-h-36 overflow-y-auto pr-1")} style={{ scrollbarWidth: "thin" }}>
            {group.lines.map((line) => (
              <li key={`${group.label}-${line.id}`} className="text-sm">
                {line.href ? (
                  <a
                    href={line.href}
                    className="inline-flex max-w-full items-center gap-1 truncate text-ink underline-offset-2 hover:text-brand-red hover:underline"
                    title={line.label}
                  >
                    <span className="truncate">{line.label}</span>
                    <ExternalLink className="size-3 shrink-0 text-ink-faint" aria-hidden />
                  </a>
                ) : (
                  <span className="truncate text-ink-soft" title={line.label}>
                    {line.label}
                  </span>
                )}
                {line.detail && (
                  <span className="ml-1.5 text-xs text-ink-faint">· {line.detail}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function EmptyState({
  trash,
  hasFilters,
  onUpload,
  onClearFilters,
}: {
  trash: boolean;
  hasFilters: boolean;
  onUpload: () => void;
  onClearFilters: () => void;
}) {
  if (trash) {
    return (
      <div className="mt-4 rounded-sm border border-dashed border-rule bg-paper p-12 text-center">
        <Trash2 className="mx-auto size-8 text-ink-faint" aria-hidden />
        <p className="mt-3 font-serif text-lg font-semibold text-ink">La corbeille est vide</p>
        <p className="mt-1 text-sm text-ink-faint">
          Les médias supprimés y restent 30 jours avant purge définitive.
        </p>
      </div>
    );
  }
  if (hasFilters) {
    return (
      <div className="mt-4 rounded-sm border border-dashed border-rule bg-paper p-12 text-center">
        <Search className="mx-auto size-8 text-ink-faint" aria-hidden />
        <p className="mt-3 font-serif text-lg font-semibold text-ink">Aucun média pour ces critères</p>
        <p className="mt-1 text-sm text-ink-faint">
          Essayez d&apos;élargir la recherche ou de changer de type.
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={onClearFilters}>
          Effacer les filtres
        </Button>
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-sm border border-dashed border-rule bg-paper p-12 text-center">
      <ImageIcon className="mx-auto size-8 text-ink-faint" aria-hidden />
      <p className="mt-3 font-serif text-lg font-semibold text-ink">
        La médiathèque est vide
      </p>
      <p className="mt-1 text-sm text-ink-faint">
        Téléversez vos premières photos, vidéos ou documents de rédaction.
      </p>
      <Button
        size="sm"
        className="mt-4 bg-brand-red text-white hover:bg-red-deep"
        onClick={onUpload}
      >
        <Upload className="mr-1 size-4" aria-hidden />
        Téléverser des médias
      </Button>
    </div>
  );
}
