"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { MediaPicker, type MediaItem } from "@/components/admin/MediaPicker";
import { apiFetch, errorMessage } from "@/lib/api/client";
import { isDriveLink } from "@/lib/drive";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Headphones,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Power,
  Radio,
  Trash2,
} from "lucide-react";

/**
 * Podcast / FM (/admin/podcast) — saisons ordonnées (monter/descendre),
 * dépliables pour révéler leurs épisodes. CRUD complet : audio par URL
 * directe ou lien Google Drive (converti en flux lisible côté serveur).
 */

interface EpisodeItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  season_id: string;
  position: number;
  audio_url: string;
  drive_file_id: string | null;
  duration_sec: number | null;
  cover_media_id: string | null;
  cover_url: string | null;
  published_at: string;
  is_active: boolean;
  created_at: string;
}

interface SeasonItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  position: number;
  is_active: boolean;
  created_at: string;
  episodes: EpisodeItem[];
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

function formatDuration(sec: number | null): string {
  if (!sec || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m} min ${String(s).padStart(2, "0")} s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { dateStyle: "long" });
}

function toDateInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ─── Formulaire saison ────────────────────────────────────────────────

interface SeasonFormState {
  title: string;
  slug: string;
  slugEdited: boolean;
  description: string;
  isActive: boolean;
}

const EMPTY_SEASON: SeasonFormState = { title: "", slug: "", slugEdited: false, description: "", isActive: true };

// ─── Formulaire épisode ───────────────────────────────────────────────

interface EpisodeFormState {
  title: string;
  slug: string;
  slugEdited: boolean;
  seasonId: string;
  description: string;
  audioUrl: string;
  durationMin: string;
  coverMediaId: string | null;
  coverPreviewUrl: string | null;
  publishedAt: string;
  position: string;
  isActive: boolean;
}

export function PodcastClient() {
  const { toast } = useToast();

  const [seasons, setSeasons] = useState<SeasonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Formulaire saison
  const [seasonFormOpen, setSeasonFormOpen] = useState(false);
  const [editingSeasonId, setEditingSeasonId] = useState<string | null>(null);
  const [seasonForm, setSeasonForm] = useState<SeasonFormState>(EMPTY_SEASON);

  // Formulaire épisode
  const [episodeFormOpen, setEpisodeFormOpen] = useState(false);
  const [editingEpisodeId, setEditingEpisodeId] = useState<string | null>(null);
  const [episodeSeasonId, setEpisodeSeasonId] = useState<string>("");
  const [episodeForm, setEpisodeForm] = useState<EpisodeFormState | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await apiFetch<SeasonItem[]>("/api/admin/podcast/seasons");
      setSeasons(data);
      setExpanded((prev) => (prev.size === 0 && data.length > 0 ? new Set([data[0].id]) : prev));
    } catch (error) {
      toast({ title: "Chargement impossible", description: errorMessage(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // ── Saisons ─────────────────────────────────────────────────────────

  const openSeasonCreate = () => {
    setEditingSeasonId(null);
    setSeasonForm(EMPTY_SEASON);
    setSeasonFormOpen(true);
  };

  const openSeasonEdit = (season: SeasonItem) => {
    setEditingSeasonId(season.id);
    setSeasonForm({
      title: season.title,
      slug: season.slug,
      slugEdited: true,
      description: season.description ?? "",
      isActive: season.is_active,
    });
    setSeasonFormOpen(true);
  };

  const submitSeason = async () => {
    if (!seasonForm.title.trim() || !seasonForm.slug.trim()) {
      toast({ title: "Champs requis", description: "Le titre et le slug sont obligatoires.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        title: seasonForm.title.trim(),
        slug: seasonForm.slug.trim(),
        description: seasonForm.description.trim() || null,
        is_active: seasonForm.isActive,
      };
      if (editingSeasonId) {
        await apiFetch(`/api/admin/podcast/seasons/${encodeURIComponent(editingSeasonId)}`, { method: "PATCH", json: payload });
        toast({ title: "Saison mise à jour" });
      } else {
        await apiFetch("/api/admin/podcast/seasons", { method: "POST", json: payload });
        toast({ title: "Saison créée", description: "Ajoutez maintenant ses épisodes." });
      }
      setSeasonFormOpen(false);
      await load();
    } catch (error) {
      toast({ title: "Enregistrement impossible", description: errorMessage(error), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const moveSeason = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= seasons.length) return;
    const reordered = [...seasons];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setSeasons(reordered);
    try {
      await apiFetch("/api/admin/podcast/seasons", {
        method: "POST",
        json: { items: reordered.map((s, i) => ({ id: s.id, position: i })) },
      });
    } catch (error) {
      toast({ title: "Réordonnancement impossible", description: errorMessage(error), variant: "destructive" });
      await load();
    }
  };

  const toggleSeasonActive = async (season: SeasonItem) => {
    try {
      await apiFetch(`/api/admin/podcast/seasons/${encodeURIComponent(season.id)}`, {
        method: "PATCH",
        json: { is_active: !season.is_active },
      });
      toast({ title: season.is_active ? "Saison masquée" : "Saison visible", description: season.title });
      await load();
    } catch (error) {
      toast({ title: "Action impossible", description: errorMessage(error), variant: "destructive" });
    }
  };

  const removeSeason = async (season: SeasonItem) => {
    try {
      await apiFetch(`/api/admin/podcast/seasons/${encodeURIComponent(season.id)}`, { method: "DELETE" });
      toast({ title: "Saison supprimée", description: season.title });
      await load();
    } catch (error) {
      toast({ title: "Suppression impossible", description: errorMessage(error), variant: "destructive" });
    }
  };

  // ── Épisodes ────────────────────────────────────────────────────────

  const emptyEpisodeForm = (seasonId: string): EpisodeFormState => ({
    title: "",
    slug: "",
    slugEdited: false,
    seasonId,
    description: "",
    audioUrl: "",
    durationMin: "",
    coverMediaId: null,
    coverPreviewUrl: null,
    publishedAt: toDateInput(new Date().toISOString()),
    position: "",
    isActive: true,
  });

  const openEpisodeCreate = (seasonId: string) => {
    setEditingEpisodeId(null);
    setEpisodeSeasonId(seasonId);
    setEpisodeForm(emptyEpisodeForm(seasonId));
    setEpisodeFormOpen(true);
  };

  const openEpisodeEdit = (episode: EpisodeItem) => {
    setEditingEpisodeId(episode.id);
    setEpisodeSeasonId(episode.season_id);
    setEpisodeForm({
      title: episode.title,
      slug: episode.slug,
      slugEdited: true,
      seasonId: episode.season_id,
      description: episode.description ?? "",
      audioUrl: episode.audio_url,
      durationMin: episode.duration_sec ? String(Math.round(episode.duration_sec / 60)) : "",
      coverMediaId: episode.cover_media_id,
      coverPreviewUrl: episode.cover_url,
      publishedAt: toDateInput(episode.published_at),
      position: String(episode.position),
      isActive: episode.is_active,
    });
    setEpisodeFormOpen(true);
  };

  const submitEpisode = async () => {
    if (!episodeForm) return;
    if (!episodeForm.title.trim() || !episodeForm.slug.trim()) {
      toast({ title: "Champs requis", description: "Le titre et le slug sont obligatoires.", variant: "destructive" });
      return;
    }
    if (!/^https?:\/\//i.test(episodeForm.audioUrl.trim()) && !isDriveLink(episodeForm.audioUrl.trim())) {
      toast({
        title: "URL audio invalide",
        description: "Fournissez une URL http(s) directe ou un lien Google Drive.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const duration = Number(episodeForm.durationMin);
      const payload = {
        title: episodeForm.title.trim(),
        slug: episodeForm.slug.trim(),
        season_id: episodeForm.seasonId,
        description: episodeForm.description.trim() || null,
        audio_url: episodeForm.audioUrl.trim(),
        duration_sec: episodeForm.durationMin && Number.isFinite(duration) && duration > 0 ? Math.round(duration * 60) : null,
        cover_media_id: episodeForm.coverMediaId,
        published_at: new Date(episodeForm.publishedAt || Date.now()).toISOString(),
        position: episodeForm.position ? Number(episodeForm.position) : undefined,
        is_active: episodeForm.isActive,
      };
      if (editingEpisodeId) {
        await apiFetch(`/api/admin/podcast/episodes/${encodeURIComponent(editingEpisodeId)}`, { method: "PATCH", json: payload });
        toast({ title: "Épisode mis à jour" });
      } else {
        await apiFetch("/api/admin/podcast/episodes", { method: "POST", json: payload });
        toast({ title: "Épisode créé" });
      }
      setEpisodeFormOpen(false);
      setExpanded((prev) => new Set(prev).add(episodeForm.seasonId));
      await load();
    } catch (error) {
      toast({ title: "Enregistrement impossible", description: errorMessage(error), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const toggleEpisodeActive = async (episode: EpisodeItem) => {
    try {
      await apiFetch(`/api/admin/podcast/episodes/${encodeURIComponent(episode.id)}`, {
        method: "PATCH",
        json: { is_active: !episode.is_active },
      });
      toast({ title: episode.is_active ? "Épisode désactivé" : "Épisode activé", description: episode.title });
      await load();
    } catch (error) {
      toast({ title: "Action impossible", description: errorMessage(error), variant: "destructive" });
    }
  };

  const removeEpisode = async (episode: EpisodeItem) => {
    try {
      await apiFetch(`/api/admin/podcast/episodes/${encodeURIComponent(episode.id)}`, { method: "DELETE" });
      toast({ title: "Épisode supprimé", description: episode.title });
      await load();
    } catch (error) {
      toast({ title: "Suppression impossible", description: errorMessage(error), variant: "destructive" });
    }
  };

  const episodeCount = seasons.reduce((sum, s) => sum + s.episodes.length, 0);
  const driveDetected = episodeForm ? isDriveLink(episodeForm.audioUrl) : false;

  // ─── Rendu ────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kicker text-brand-red">Audio</p>
          <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight">Podcast / FM</h1>
          <p className="mt-1 text-sm text-ink-faint">
            Saisons et épisodes diffusés sur la page publique /podcast. Audio : URL directe ou lien Google Drive.
          </p>
        </div>
        <Button onClick={openSeasonCreate}>
          <Plus className="size-4" aria-hidden />
          Nouvelle saison
        </Button>
      </header>

      {/* ── Formulaire saison ─────────────────────────────────────────── */}
      {seasonFormOpen && (
        <section aria-label="Formulaire de saison" className="border border-rule bg-paper p-4">
          <p className="kicker text-ink-faint">{editingSeasonId ? "Modifier la saison" : "Nouvelle saison"}</p>
          <form
            className="mt-3 grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              void submitSeason();
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="season-title" className="text-xs font-semibold text-ink-soft">Titre *</Label>
              <Input
                id="season-title"
                value={seasonForm.title}
                maxLength={200}
                placeholder="Ex. Saison 1 — Élections 2026"
                onChange={(e) =>
                  setSeasonForm({
                    ...seasonForm,
                    title: e.target.value,
                    slug: seasonForm.slugEdited ? seasonForm.slug : slugify(e.target.value),
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="season-slug" className="text-xs font-semibold text-ink-soft">Slug (URL) *</Label>
              <Input
                id="season-slug"
                value={seasonForm.slug}
                maxLength={160}
                placeholder="saison-1"
                onChange={(e) => setSeasonForm({ ...seasonForm, slug: slugify(e.target.value), slugEdited: true })}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="season-desc" className="text-xs font-semibold text-ink-soft">Description</Label>
              <Textarea
                id="season-desc"
                value={seasonForm.description}
                maxLength={2000}
                rows={2}
                placeholder="Résumé éditorial de la saison (optionnel)"
                onChange={(e) => setSeasonForm({ ...seasonForm, description: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch id="season-active" checked={seasonForm.isActive} onCheckedChange={(checked) => setSeasonForm({ ...seasonForm, isActive: checked })} />
              <Label htmlFor="season-active" className="text-sm text-ink-soft">Saison active (visible sur /podcast)</Label>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Radio className="size-4" aria-hidden />}
                {editingSeasonId ? "Enregistrer" : "Créer la saison"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setSeasonFormOpen(false)}>
                Annuler
              </Button>
            </div>
          </form>
        </section>
      )}

      {/* ── Formulaire épisode ────────────────────────────────────────── */}
      {episodeFormOpen && episodeForm && (
        <section aria-label="Formulaire d'épisode" className="border border-rule bg-paper p-4">
          <p className="kicker text-ink-faint">{editingEpisodeId ? "Modifier l'épisode" : "Nouvel épisode"}</p>
          <form
            className="mt-3 grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              void submitEpisode();
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="ep-title" className="text-xs font-semibold text-ink-soft">Titre *</Label>
              <Input
                id="ep-title"
                value={episodeForm.title}
                maxLength={300}
                placeholder="Ex. Épisode 12 — La campagne à Kindia"
                onChange={(e) =>
                  setEpisodeForm({
                    ...episodeForm,
                    title: e.target.value,
                    slug: episodeForm.slugEdited ? episodeForm.slug : slugify(e.target.value),
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ep-slug" className="text-xs font-semibold text-ink-soft">Slug (URL) *</Label>
              <Input
                id="ep-slug"
                value={episodeForm.slug}
                maxLength={160}
                onChange={(e) => setEpisodeForm({ ...episodeForm, slug: slugify(e.target.value), slugEdited: true })}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-ink-soft">Saison *</Label>
              <Select value={episodeForm.seasonId} onValueChange={(value) => setEpisodeForm({ ...episodeForm, seasonId: value })}>
                <SelectTrigger aria-label="Saison de l'épisode">
                  <SelectValue placeholder="Choisir une saison" />
                </SelectTrigger>
                <SelectContent>
                  {seasons.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ep-published" className="text-xs font-semibold text-ink-soft">Date de publication</Label>
              <Input
                id="ep-published"
                type="date"
                value={episodeForm.publishedAt}
                onChange={(e) => setEpisodeForm({ ...episodeForm, publishedAt: e.target.value })}
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="ep-audio" className="text-xs font-semibold text-ink-soft">URL audio * (directe ou Google Drive)</Label>
              <Input
                id="ep-audio"
                value={episodeForm.audioUrl}
                placeholder="https://drive.google.com/file/d/…/view ou https://…/episode.mp3"
                onChange={(e) => setEpisodeForm({ ...episodeForm, audioUrl: e.target.value })}
              />
              {driveDetected && (
                <p className="flex items-center gap-1 text-xs font-medium text-green-700">
                  <CheckCircle2 className="size-3.5" aria-hidden />
                  Lien Drive détecté ✓ — il sera converti en flux lisible à l&apos;enregistrement.
                </p>
              )}
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-semibold text-ink-soft">Couverture (médiathèque)</Label>
              <div className="flex items-center gap-3">
                {episodeForm.coverPreviewUrl ? (
                  <img src={episodeForm.coverPreviewUrl} alt="Aperçu de la couverture" className="h-16 w-16 border border-rule object-cover" />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center border border-dashed border-rule bg-paper-alt text-ink-faint">
                    <ImageIcon className="size-5" aria-hidden />
                  </span>
                )}
                <Button type="button" variant="outline" onClick={() => setPickerOpen(true)}>
                  <ImageIcon className="size-4" aria-hidden />
                  {episodeForm.coverMediaId ? "Changer de couverture" : "Choisir une couverture"}
                </Button>
                {episodeForm.coverMediaId && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setEpisodeForm({ ...episodeForm, coverMediaId: null, coverPreviewUrl: null })}
                  >
                    Retirer
                  </Button>
                )}
              </div>
              <MediaPicker
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                filterType="image"
                title="Choisir la couverture de l'épisode"
                onSelect={(media: MediaItem) =>
                  setEpisodeForm({ ...episodeForm, coverMediaId: media.id, coverPreviewUrl: media.url })
                }
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="ep-duration" className="text-xs font-semibold text-ink-soft">Durée (minutes)</Label>
              <Input
                id="ep-duration"
                type="number"
                min={0}
                max={1440}
                value={episodeForm.durationMin}
                placeholder="Ex. 32"
                onChange={(e) => setEpisodeForm({ ...episodeForm, durationMin: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ep-position" className="text-xs font-semibold text-ink-soft">Position (vide = fin de saison)</Label>
              <Input
                id="ep-position"
                type="number"
                min={0}
                value={episodeForm.position}
                onChange={(e) => setEpisodeForm({ ...episodeForm, position: e.target.value })}
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="ep-desc" className="text-xs font-semibold text-ink-soft">Description</Label>
              <Textarea
                id="ep-desc"
                value={episodeForm.description}
                maxLength={5000}
                rows={3}
                placeholder="Résumé de l'épisode (optionnel)"
                onChange={(e) => setEpisodeForm({ ...episodeForm, description: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch id="ep-active" checked={episodeForm.isActive} onCheckedChange={(checked) => setEpisodeForm({ ...episodeForm, isActive: checked })} />
              <Label htmlFor="ep-active" className="text-sm text-ink-soft">Épisode actif (diffusé sur /podcast)</Label>
            </div>

            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Headphones className="size-4" aria-hidden />}
                {editingEpisodeId ? "Enregistrer" : "Créer l'épisode"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEpisodeFormOpen(false)}>
                Annuler
              </Button>
            </div>
          </form>
        </section>
      )}

      {/* ── Liste des saisons ─────────────────────────────────────────── */}
      <section aria-label="Liste des saisons">
        <p className="kicker text-ink-faint">
          Saisons {loading ? "" : `(${seasons.length}) · ${episodeCount} épisode${episodeCount > 1 ? "s" : ""}`}
        </p>

        {loading ? (
          <div className="mt-3 space-y-2" aria-hidden>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full bg-paper-alt" />
            ))}
          </div>
        ) : seasons.length === 0 ? (
          <div className="mt-3 border border-dashed border-rule bg-paper-alt p-10 text-center">
            <Radio className="mx-auto size-6 text-ink-faint" aria-hidden />
            <p className="mt-2 text-sm font-medium text-ink-soft">Aucune saison pour le moment</p>
            <p className="mt-1 text-xs text-ink-faint">
              Créez une première saison puis ajoutez ses épisodes (audio Google Drive ou URL directe).
            </p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {seasons.map((season, index) => {
              const isOpen = expanded.has(season.id);
              return (
                <li key={season.id} className={cn("border border-rule bg-paper", !season.is_active && "bg-paper-alt/60")}>
                  {/* Ligne d'en-tête de saison */}
                  <div className="flex flex-wrap items-center gap-2 p-3">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(season.id)}
                      aria-expanded={isOpen}
                      aria-label={`${isOpen ? "Replier" : "Déplier"} la saison : ${season.title}`}
                      className="flex min-w-0 flex-1 items-center gap-2 text-start"
                    >
                      {isOpen ? <ChevronDown className="size-4 shrink-0 text-ink-faint" aria-hidden /> : <ChevronRight className="size-4 shrink-0 text-ink-faint" aria-hidden />}
                      <span className="truncate font-serif text-sm font-bold text-ink">{season.title}</span>
                      <Badge variant="outline" className="border-rule bg-paper text-ink-faint">
                        {season.episodes.length} épisode{season.episodes.length > 1 ? "s" : ""}
                      </Badge>
                      {!season.is_active && (
                        <Badge className="border-rule bg-paper-alt text-ink-faint">Masquée</Badge>
                      )}
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={index === 0}
                        onClick={() => void moveSeason(index, -1)}
                        aria-label={`Monter la saison : ${season.title}`}
                        title="Monter"
                      >
                        <ChevronUp className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={index === seasons.length - 1}
                        onClick={() => void moveSeason(index, 1)}
                        aria-label={`Descendre la saison : ${season.title}`}
                        title="Descendre"
                      >
                        <ChevronDown className="size-4" aria-hidden />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEpisodeCreate(season.id)} title="Ajouter un épisode">
                        <Plus className="size-4" aria-hidden />
                        <span className="sr-only">Ajouter un épisode</span>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openSeasonEdit(season)} aria-label={`Modifier la saison : ${season.title}`} title="Modifier">
                        <Pencil className="size-4" aria-hidden />
                        <span className="sr-only">Modifier</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void toggleSeasonActive(season)}
                        aria-label={season.is_active ? `Masquer la saison : ${season.title}` : `Afficher la saison : ${season.title}`}
                        title={season.is_active ? "Masquer" : "Afficher"}
                      >
                        <Power className="size-4" aria-hidden />
                        <span className="sr-only">{season.is_active ? "Masquer" : "Afficher"}</span>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-brand-red hover:bg-red-wash hover:text-red-deep"
                            aria-label={`Supprimer la saison : ${season.title}`}
                            title="Supprimer"
                          >
                            <Trash2 className="size-4" aria-hidden />
                            <span className="sr-only">Supprimer</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-paper">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="font-serif">Supprimer cette saison ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              « {season.title} » sera définitivement retirée. La suppression est bloquée si des épisodes y sont rattachés.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction className="bg-brand-red text-white hover:bg-red-deep" onClick={() => void removeSeason(season)}>
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {/* Épisodes de la saison */}
                  {isOpen && (
                    <div className="border-t border-rule">
                      {season.episodes.length === 0 ? (
                        <p className="p-4 text-xs text-ink-faint">
                          Aucun épisode dans cette saison — cliquez sur + pour en ajouter un.
                        </p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-rule text-start text-xs uppercase tracking-wide text-ink-faint">
                              <th scope="col" className="px-3 py-2 text-start font-semibold">#</th>
                              <th scope="col" className="px-3 py-2 text-start font-semibold">Épisode</th>
                              <th scope="col" className="hidden px-3 py-2 text-start font-semibold md:table-cell">Durée</th>
                              <th scope="col" className="hidden px-3 py-2 text-start font-semibold md:table-cell">Publication</th>
                              <th scope="col" className="px-3 py-2 text-end font-semibold">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {season.episodes.map((episode, epIndex) => (
                              <tr key={episode.id} className={cn("border-b border-rule last:border-0", !episode.is_active && "bg-paper-alt/60")}>
                                <td className="px-3 py-2 font-mono text-xs text-ink-faint">{epIndex + 1}</td>
                                <td className="px-3 py-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium text-ink">{episode.title}</span>
                                    {episode.drive_file_id && (
                                      <Badge variant="outline" className="border-rule bg-paper text-ink-soft">Drive</Badge>
                                    )}
                                    {!episode.is_active && (
                                      <Badge className="border-rule bg-paper-alt text-ink-faint">Inactif</Badge>
                                    )}
                                  </div>
                                  <p className="mt-0.5 truncate text-xs text-ink-faint">{episode.audio_url}</p>
                                </td>
                                <td className="hidden px-3 py-2 text-xs text-ink-soft md:table-cell">{formatDuration(episode.duration_sec)}</td>
                                <td className="hidden px-3 py-2 text-xs text-ink-soft md:table-cell">{formatDate(episode.published_at)}</td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => openEpisodeEdit(episode)} aria-label={`Modifier l'épisode : ${episode.title}`} title="Modifier">
                                      <Pencil className="size-4" aria-hidden />
                                      <span className="sr-only">Modifier</span>
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => void toggleEpisodeActive(episode)}
                                      aria-label={episode.is_active ? `Désactiver l'épisode : ${episode.title}` : `Activer l'épisode : ${episode.title}`}
                                      title={episode.is_active ? "Désactiver" : "Activer"}
                                    >
                                      <Power className="size-4" aria-hidden />
                                      <span className="sr-only">{episode.is_active ? "Désactiver" : "Activer"}</span>
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="text-brand-red hover:bg-red-wash hover:text-red-deep"
                                          aria-label={`Supprimer l'épisode : ${episode.title}`}
                                          title="Supprimer"
                                        >
                                          <Trash2 className="size-4" aria-hidden />
                                          <span className="sr-only">Supprimer</span>
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent className="bg-paper">
                                        <AlertDialogHeader>
                                          <AlertDialogTitle className="font-serif">Supprimer cet épisode ?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            « {episode.title} » sera définitivement retiré de la saison {season.title}.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                                          <AlertDialogAction className="bg-brand-red text-white hover:bg-red-deep" onClick={() => void removeEpisode(episode)}>
                                            Supprimer
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
