"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { apiFetch, errorMessage } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  Image as ImageIcon,
  ImageOff,
  ImagePlus,
  Loader2,
  Newspaper,
  Pin,
  Plus,
  Save,
  Search,
  Star,
  X,
} from "lucide-react";

/**
 * Composeur de la une (§11.2 /admin/une) : recherche de candidats à gauche,
 * deux zones à droite — article principal (héros, 1 emplacement) et articles
 * secondaires (4 emplacements). Réordonnancement par flèches, épinglage,
 * titre et image alternatifs, enregistrement complet (PUT) et aperçu
 * structurel.
 */

interface UneArticle {
  id: string;
  title: string;
  slug: string;
  published_at: string | null;
  importance: number;
  category: { name: string; slug: string } | null;
  coverMedia: { id: string; url: string; alt_text: string | null } | null;
}

interface ApiSlot {
  id: string;
  zone: string;
  position: number;
  article_id: string;
  pinned: boolean;
  starts_at: string | null;
  ends_at: string | null;
  override_title: string | null;
  override_media_id: string | null;
  article: UneArticle | null;
  overrideMedia: { id: string; url: string } | null;
}

/** Slot tel que manipulé localement (clé de rendu stable côté client). */
interface LocalSlot {
  key: string;
  article_id: string;
  pinned: boolean;
  starts_at: string | null;
  ends_at: string | null;
  override_title: string | null;
  override_media_id: string | null;
  article: UneArticle | null;
  overrideMedia: { id: string; url: string } | null;
}

interface UneSlotPayload {
  zone: "home_lead" | "home_secondary";
  article_id: string;
  position: number;
  pinned: boolean;
  starts_at: string | null;
  ends_at: string | null;
  override_title: string | null;
  override_media_id: string | null;
}

type Zone = "home_lead" | "home_secondary";

const HERO_MAX = 1;
const SECONDARY_MAX = 4;

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function toLocalSlot(slot: ApiSlot): LocalSlot {
  return {
    key: slot.id,
    article_id: slot.article_id,
    pinned: slot.pinned,
    starts_at: slot.starts_at,
    ends_at: slot.ends_at,
    override_title: slot.override_title,
    override_media_id: slot.override_media_id,
    article: slot.article,
    overrideMedia: slot.overrideMedia,
  };
}

export function UneClient() {
  const { toast } = useToast();

  const [lead, setLead] = useState<LocalSlot[]>([]);
  const [secondary, setSecondary] = useState<LocalSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Candidats
  const [q, setQ] = useState("");
  const [candidates, setCandidates] = useState<UneArticle[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(true);

  // Sélecteur de média (image alternative)
  const [pickerKey, setPickerKey] = useState<string | null>(null);
  // Aperçu structurel
  const [previewOpen, setPreviewOpen] = useState(false);

  const keySeq = useRef(0);

  const load = useCallback(async () => {
    try {
      const { data } = await apiFetch<{ slots: ApiSlot[] }>("/api/admin/une");
      setLead(data.slots.filter((s) => s.zone === "home_lead").map(toLocalSlot));
      setSecondary(data.slots.filter((s) => s.zone === "home_secondary").map(toLocalSlot));
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

  const loadCandidates = useCallback(
    async (query: string) => {
      setCandidatesLoading(true);
      try {
        const params = new URLSearchParams({ candidates: "1" });
        if (query.trim()) params.set("q", query.trim());
        const { data } = await apiFetch<UneArticle[]>(`/api/admin/une?${params}`);
        setCandidates(data);
      } catch (error) {
        toast({ title: "Recherche impossible", description: errorMessage(error), variant: "destructive" });
      } finally {
        setCandidatesLoading(false);
      }
    },
    [toast]
  );

  // Recherche avec anti-rebond (300 ms) ; chargement initial immédiat
  useEffect(() => {
    const timer = setTimeout(() => void loadCandidates(q), q.trim() === "" ? 0 : 300);
    return () => clearTimeout(timer);
  }, [q, loadCandidates]);

  const newSlot = (article: UneArticle): LocalSlot => ({
    key: `n${keySeq.current++}`,
    article_id: article.id,
    pinned: false,
    starts_at: null,
    ends_at: null,
    override_title: null,
    override_media_id: null,
    article,
    overrideMedia: null,
  });

  const mutateZone = useCallback((zone: Zone, updater: (list: LocalSlot[]) => LocalSlot[]) => {
    if (zone === "home_lead") setLead(updater);
    else setSecondary(updater);
    setDirty(true);
  }, []);

  const heroId = lead[0]?.article_id ?? null;
  const secondaryIds = useMemo(() => new Set(secondary.map((s) => s.article_id)), [secondary]);

  const placeHero = useCallback(
    (candidate: UneArticle) => {
      if (heroId === candidate.id) {
        toast({ title: "Article déjà en principal", description: "Cet article occupe déjà la zone héros." });
        return;
      }
      mutateZone("home_lead", () => [newSlot(candidate)]);
      // Pas de doublon : l'article quitte la zone secondaire s'il s'y trouvait
      mutateZone("home_secondary", (list) => list.filter((s) => s.article_id !== candidate.id));
      toast({ title: "Article principal défini", description: candidate.title });
    },
    [heroId, mutateZone, toast]
  );

  const placeSecondary = useCallback(
    (candidate: UneArticle) => {
      if (heroId === candidate.id) {
        toast({ title: "Article déjà en principal", description: "Retirez-le d'abord de la zone héros pour le déplacer." });
        return;
      }
      if (secondaryIds.has(candidate.id)) {
        toast({ title: "Article déjà placé", description: "Cet article figure déjà dans la une secondaire." });
        return;
      }
      if (secondary.length >= SECONDARY_MAX) {
        toast({
          title: "Zone secondaire complète",
          description: `La une secondaire accepte ${SECONDARY_MAX} articles maximum. Retirez un article pour libérer une place.`,
          variant: "destructive",
        });
        return;
      }
      mutateZone("home_secondary", (list) => [...list, newSlot(candidate)]);
      toast({ title: "Article ajouté à la une secondaire", description: candidate.title });
    },
    [heroId, secondaryIds, secondary.length, mutateZone, toast]
  );

  /** Règle de dépôt : le héros d'abord s'il est libre, sinon la zone secondaire. */
  const placeAuto = useCallback(
    (candidate: UneArticle) => {
      if (lead.length === 0) placeHero(candidate);
      else placeSecondary(candidate);
    },
    [lead.length, placeHero, placeSecondary]
  );

  const removeSlot = useCallback(
    (zone: Zone, key: string) => {
      mutateZone(zone, (list) => list.filter((s) => s.key !== key));
    },
    [mutateZone]
  );

  const moveSlot = useCallback(
    (zone: Zone, index: number, delta: number) => {
      mutateZone(zone, (list) => {
        const target = index + delta;
        if (target < 0 || target >= list.length) return list;
        const next = [...list];
        const [moved] = next.splice(index, 1);
        if (!moved) return list;
        next.splice(target, 0, moved);
        return next;
      });
    },
    [mutateZone]
  );

  const togglePin = useCallback(
    (zone: Zone, key: string) => {
      mutateZone(zone, (list) => list.map((s) => (s.key === key ? { ...s, pinned: !s.pinned } : s)));
    },
    [mutateZone]
  );

  const patchSlot = useCallback(
    (zone: Zone, key: string, patch: Partial<LocalSlot>) => {
      mutateZone(zone, (list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)));
    },
    [mutateZone]
  );

  const save = async () => {
    setSaving(true);
    try {
      const toPayload = (slot: LocalSlot, zone: Zone, position: number): UneSlotPayload => ({
        zone,
        article_id: slot.article_id,
        position,
        pinned: slot.pinned,
        starts_at: slot.starts_at,
        ends_at: slot.ends_at,
        override_title: slot.override_title && slot.override_title.trim() !== "" ? slot.override_title.trim() : null,
        override_media_id: slot.override_media_id,
      });
      const slots: UneSlotPayload[] = [
        ...lead.map((s, position) => toPayload(s, "home_lead", position)),
        ...secondary.map((s, position) => toPayload(s, "home_secondary", position)),
      ];
      await apiFetch("/api/admin/une", { method: "PUT", json: { slots } });
      toast({ title: "Une enregistrée", description: `${slots.length} article${slots.length > 1 ? "s" : ""} composent désormais la une.` });
      await load();
    } catch (error) {
      toast({ title: "Enregistrement impossible", description: errorMessage(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  /** Carte d'un slot (rendu partagé héros / secondaire). */
  const renderSlot = (slot: LocalSlot, zone: Zone, index: number, total: number) => {
    const title = slot.override_title && slot.override_title.trim() !== "" ? slot.override_title : slot.article?.title;
    const cover = slot.overrideMedia ?? slot.article?.coverMedia ?? null;
    return (
      <div key={slot.key} className="border border-rule bg-paper p-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => setPickerKey(slot.key)}
            className="relative size-14 shrink-0 overflow-hidden border border-rule bg-paper-alt transition-shadow hover:ring-2 hover:ring-brand-red"
            aria-label={`Image de « ${title ?? "article"} » — cliquer pour choisir une image alternative`}
            title="Choisir une image alternative"
          >
            {cover ? (
              <img src={cover.url} alt={slot.article?.coverMedia?.alt_text ?? ""} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <ImageIcon className="mx-auto size-5 text-ink-faint" aria-hidden />
            )}
            {slot.overrideMedia && (
              <span className="absolute inset-x-0 bottom-0 bg-ink/80 py-px text-center text-[9px] font-bold uppercase tracking-wide text-paper">
                Alt.
              </span>
            )}
          </button>

          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <p className="truncate font-serif text-sm font-semibold text-ink" title={title ?? undefined}>
                {title ?? "Article introuvable"}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-faint">
                {slot.article?.category && <span className="font-medium text-ink-soft">{slot.article.category.name}</span>}
                {slot.article?.published_at && <span>{formatDay(slot.article.published_at)}</span>}
                {slot.article?.importance === 1 && (
                  <Badge className="border-brand-red bg-red-wash text-brand-red">Importance 1</Badge>
                )}
              </p>
            </div>

            <Input
              value={slot.override_title ?? ""}
              onChange={(e) => patchSlot(zone, slot.key, { override_title: e.target.value })}
              placeholder="Titre alternatif (affiché à la place du titre d'origine)…"
              aria-label={`Titre alternatif pour « ${slot.article?.title ?? "article"} »`}
              className="h-8 text-xs"
              autoComplete="off"
            />

            <div className="flex flex-wrap items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-1.5"
                disabled={zone === "home_lead" || index === 0}
                onClick={() => moveSlot(zone, index, -1)}
                aria-label="Monter dans la zone"
                title="Monter"
              >
                <ChevronUp className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-1.5"
                disabled={zone === "home_lead" || index === total - 1}
                onClick={() => moveSlot(zone, index, 1)}
                aria-label="Descendre dans la zone"
                title="Descendre"
              >
                <ChevronDown className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn("h-7 px-2", slot.pinned && "bg-red-wash text-brand-red hover:bg-red-wash hover:text-brand-red")}
                onClick={() => togglePin(zone, slot.key)}
                aria-pressed={slot.pinned}
                aria-label={slot.pinned ? "Désépingler cet article" : "Épingler cet article en tête de zone"}
                title={slot.pinned ? "Épinglé" : "Épingler"}
              >
                <Pin className="size-4" aria-hidden />
                {slot.pinned ? "Épinglé" : "Épingler"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => setPickerKey(slot.key)}
                aria-label="Choisir une image alternative"
                title="Image alternative"
              >
                <ImagePlus className="size-4" aria-hidden />
                Image alternative
              </Button>
              {slot.override_media_id && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-ink-faint"
                  onClick={() => patchSlot(zone, slot.key, { override_media_id: null, overrideMedia: null })}
                  aria-label="Retirer l'image alternative"
                  title="Retirer l'image alternative"
                >
                  <ImageOff className="size-4" aria-hidden />
                  Retirer l&apos;image
                </Button>
              )}
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 px-1.5 text-ink-faint hover:bg-red-wash hover:text-brand-red"
            onClick={() => removeSlot(zone, slot.key)}
            aria-label={`Retirer « ${title ?? "cet article"} » de la une`}
            title="Retirer de la une"
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    );
  };

  /** Emplacement vide — zone libre en pointillés. */
  const freeZone = (zone: Zone) => (
    <div
      key={`free-${zone}`}
      className="flex h-16 items-center justify-center border border-dashed border-rule bg-paper-alt/50 text-xs font-medium text-ink-faint"
      aria-label="Emplacement libre"
    >
      Zone libre
    </div>
  );

  const previewCount = lead.length + secondary.length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kicker text-brand-red">Une du site</p>
          <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight">Composeur de la une</h1>
          <p className="mt-1 text-sm text-ink-faint">
            Article principal (héros) et articles secondaires — l&apos;ordre conditionne l&apos;affichage de la page d&apos;accueil.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty && (
            <Badge className="border-amber-200 bg-amber-50 text-amber-800" aria-live="polite">
              Modifications non enregistrées
            </Badge>
          )}
          <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)} aria-label="Prévisualiser la structure de la une">
            <Eye className="size-4" aria-hidden />
            Prévisualiser
          </Button>
          <Button type="button" onClick={() => void save()} disabled={!dirty || saving} aria-label="Enregistrer la composition de la une">
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
            Enregistrer
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ── Colonne gauche : candidats ──────────────────────────────── */}
        <section aria-label="Articles candidats" className="border border-rule bg-paper lg:col-span-2">
          <div className="border-b border-rule p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="kicker text-ink-faint">Candidats</p>
              <span className="text-xs text-ink-faint">
                Héros : {lead.length}/{HERO_MAX} · Secondaires : {secondary.length}/{SECONDARY_MAX}
              </span>
            </div>
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-2.5 size-4 text-ink-faint" aria-hidden />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher un article publié…"
                aria-label="Rechercher un article candidat"
                className="pl-8"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="max-h-[560px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
            {candidatesLoading ? (
              <div className="space-y-2 p-3" aria-hidden>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="size-10 bg-paper-alt" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-full bg-paper-alt" />
                      <Skeleton className="h-3 w-1/2 bg-paper-alt" />
                    </div>
                  </div>
                ))}
              </div>
            ) : candidates.length === 0 ? (
              <div className="p-10 text-center">
                <Newspaper className="mx-auto size-6 text-ink-faint" aria-hidden />
                <p className="mt-2 text-sm font-medium text-ink-soft">
                  {q.trim() === "" ? "Aucun article publié disponible" : "Aucun article ne correspond à cette recherche"}
                </p>
                <p className="mt-1 text-xs text-ink-faint">
                  {q.trim() === ""
                    ? "Publiez des articles pour composer la une."
                    : `Aucun résultat pour « ${q.trim()} ». Essayez d'autres mots-clés.`}
                </p>
              </div>
            ) : (
              <ul>
                {candidates.map((candidate) => {
                  const isHero = heroId === candidate.id;
                  const inSecondary = secondaryIds.has(candidate.id);
                  return (
                    <li key={candidate.id} className="border-b border-rule p-3 last:border-0 hover:bg-paper-alt/60">
                      <div className="flex items-center gap-3">
                        <div className="size-10 shrink-0 overflow-hidden border border-rule bg-paper-alt">
                          {candidate.coverMedia ? (
                            <img
                              src={candidate.coverMedia.url}
                              alt={candidate.coverMedia.alt_text ?? ""}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <span className="flex h-full items-center justify-center">
                              <Newspaper className="size-4 text-ink-faint" aria-hidden />
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-medium leading-snug text-ink" title={candidate.title}>
                            {candidate.title}
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-faint">
                            {candidate.category && <span className="font-medium text-ink-soft">{candidate.category.name}</span>}
                            {candidate.published_at && <span>{formatDay(candidate.published_at)}</span>}
                            {candidate.importance === 1 && <span className="font-semibold text-brand-red">Importance 1</span>}
                            {(isHero || inSecondary) && <span className="font-medium text-ink-soft">— déjà placé</span>}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={cn("h-8 px-1.5", isHero && "bg-red-wash text-brand-red hover:bg-red-wash hover:text-brand-red")}
                            disabled={isHero}
                            onClick={() => placeHero(candidate)}
                            aria-label={`Définir comme article principal (héros) : ${candidate.title}`}
                            title="Article principal (héros)"
                          >
                            <Star className="size-4" aria-hidden />
                            <span className="sr-only">Héros</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-1.5"
                            disabled={isHero || inSecondary || secondary.length >= SECONDARY_MAX}
                            onClick={() => placeAuto(candidate)}
                            aria-label={`Ajouter à la une (héros si libre, sinon secondaire) : ${candidate.title}`}
                            title="Ajouter à la une (héros si libre, sinon secondaire)"
                          >
                            <Plus className="size-4" aria-hidden />
                            <span className="sr-only">Ajouter</span>
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* ── Colonne droite : zones de la une ───────────────────────── */}
        <div className="space-y-6 lg:col-span-3">
          <section aria-label="Une — article principal (héros)" className="border border-rule bg-paper">
            <div className="flex items-center justify-between gap-2 border-b border-rule px-4 py-3">
              <div>
                <p className="kicker text-ink-faint">Zone 1 · home_lead</p>
                <h2 className="font-serif text-base font-bold text-ink">Une — article principal (héros)</h2>
              </div>
              <Badge variant="outline" className="border-rule text-ink-faint">
                {lead.length}/{HERO_MAX}
              </Badge>
            </div>
            <div className="space-y-2 p-3">
              {loading ? (
                <Skeleton className="h-24 w-full bg-paper-alt" aria-hidden />
              ) : lead.length === 0 ? (
                freeZone("home_lead")
              ) : (
                lead.map((slot, index) => renderSlot(slot, "home_lead", index, lead.length))
              )}
            </div>
          </section>

          <section aria-label="Une — articles secondaires" className="border border-rule bg-paper">
            <div className="flex items-center justify-between gap-2 border-b border-rule px-4 py-3">
              <div>
                <p className="kicker text-ink-faint">Zone 2 · home_secondary</p>
                <h2 className="font-serif text-base font-bold text-ink">Une — articles secondaires</h2>
              </div>
              <Badge variant="outline" className="border-rule text-ink-faint">
                {secondary.length}/{SECONDARY_MAX}
              </Badge>
            </div>
            <div className="space-y-2 p-3">
              {loading ? (
                <Skeleton className="h-24 w-full bg-paper-alt" aria-hidden />
              ) : (
                <>
                  {secondary.map((slot, index) => renderSlot(slot, "home_secondary", index, secondary.length))}
                  {Array.from({ length: Math.max(0, SECONDARY_MAX - secondary.length) }).map((_, i) => (
                    <div key={`free-secondary-${i}`}>{freeZone("home_secondary")}</div>
                  ))}
                </>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* ── Sélecteur de média (image alternative) ───────────────────── */}
      <MediaPicker
        open={pickerKey !== null}
        onOpenChange={(open) => {
          if (!open) setPickerKey(null);
        }}
        onSelect={(media: { id: string; url: string }) => {
          const zone: Zone = lead.some((s) => s.key === pickerKey) ? "home_lead" : "home_secondary";
          if (pickerKey) patchSlot(zone, pickerKey, { override_media_id: media.id, overrideMedia: { id: media.id, url: media.url } });
        }}
        filterType="image"
        title="Image alternative de la une"
      />

      {/* ── Aperçu structurel ────────────────────────────────────────── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto bg-paper sm:max-w-lg" style={{ scrollbarWidth: "thin" }}>
          <DialogHeader>
            <DialogTitle className="font-serif">Prévisualisation de la structure</DialogTitle>
            <DialogDescription>
              {dirty ? "Structure en cours de composition (non enregistrée)." : "Structure actuellement enregistrée."}
            </DialogDescription>
          </DialogHeader>

          {previewCount === 0 ? (
            <div className="border border-dashed border-rule bg-paper-alt p-8 text-center">
              <p className="text-sm font-medium text-ink-soft">La une est vide</p>
              <p className="mt-1 text-xs text-ink-faint">Ajoutez un article principal et jusqu&apos;à {SECONDARY_MAX} articles secondaires.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="kicker text-ink-faint">Article principal (héros)</p>
                <div className="mt-2 border border-rule bg-paper-alt p-3">
                  {lead.length === 0 ? (
                    <p className="text-sm text-ink-faint">Zone libre</p>
                  ) : (
                    <div className="flex items-start gap-2">
                      {lead[0]?.pinned && <Pin className="mt-1 size-3.5 shrink-0 text-brand-red" aria-label="Article épinglé" />}
                      <div>
                        <p className="font-serif text-base font-bold leading-snug text-ink">
                          {lead[0]?.override_title?.trim() || lead[0]?.article?.title}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-faint">
                          {lead[0]?.article?.category?.name ?? "Sans rubrique"}
                          {lead[0]?.override_title?.trim() ? " · titre alternatif" : ""}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="kicker text-ink-faint">Articles secondaires</p>
                {secondary.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-faint">Aucun article secondaire.</p>
                ) : (
                  <ol className="mt-2 space-y-1.5">
                    {secondary.map((slot, index) => (
                      <li
                        key={slot.key}
                        className="flex items-start gap-2 border border-rule bg-paper-alt px-3 py-2 text-sm"
                      >
                        <span className="mt-0.5 font-mono text-xs font-bold text-ink-faint">{index + 1}.</span>
                        {slot.pinned && <Pin className="mt-1 size-3.5 shrink-0 text-brand-red" aria-label="Article épinglé" />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-ink" title={slot.override_title?.trim() || slot.article?.title}>
                            {slot.override_title?.trim() || slot.article?.title}
                          </span>
                          <span className="text-xs text-ink-faint">
                            {slot.article?.category?.name ?? "Sans rubrique"}
                            {slot.override_title?.trim() ? " · titre alternatif" : ""}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <p className="text-xs text-ink-faint">
                Le rendu visuel de la page d&apos;accueil est livré en phase 4 — cet aperçu montre la structure envoyée au front-office.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
