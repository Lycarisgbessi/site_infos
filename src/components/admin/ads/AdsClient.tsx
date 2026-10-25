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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ExternalLink, Image as ImageIcon, Loader2, Megaphone, Monitor, MousePointerClick, Pencil, Plus, Power, Smartphone, Trash2, Eye } from "lucide-react";

/**
 * Régie publicitaire (§11.2 /admin/ads) — gestion des campagnes réelles :
 * une campagne = annonceur + période + priorité + une créative (image,
 * GIF de la médiathèque ou vidéo externe YouTube/mp4) sur un emplacement
 * AD-01→AD-19. Compteurs d'impressions et de clics en lecture.
 * Système « taquin » 2026-10 : ciblage appareils (Tous/Mobile/Desktop),
 * rubriques ciblées (CSV de slugs) et code HTML de repli (sanitisé au
 * rendu public).
 */

interface AdCampaignItem {
  id: string;
  name: string;
  advertiser: string;
  slot_code: string;
  slot_name: string;
  media_kind: "image" | "gif" | "video";
  media_id: string | null;
  media_url: string | null;
  video_url: string | null;
  click_url: string;
  starts_at: string;
  ends_at: string | null;
  priority: number;
  is_active: boolean;
  impressions: number;
  clicks: number;
  created_at: string;
  device_targeting: "ALL" | "MOBILE" | "DESKTOP";
  category_targeting: string | null;
  html_code: string | null;
}

interface AdSlotItem {
  code: string;
  name: string;
  format: string;
  width: number | null;
  height: number | null;
}

const MEDIA_KIND_LABELS: Record<AdCampaignItem["media_kind"], string> = {
  image: "Image statique",
  gif: "GIF animé",
  video: "Vidéo",
};

const FORMAT_LABELS: Record<string, string> = {
  leaderboard: "Leaderboard",
  billboard: "Billboard",
  pave: "Pavé",
  halfpage: "Demi-page",
  native: "Natif",
  footer: "Pied de page",
  promo: "Promotion",
  sticky: "Bandeau collant",
  video: "Vidéo",
};

/**
 * Mentions d'emplacement — où la créative est réellement affichée sur le
 * site public (usages vérifiés dans src/app/page.tsx, /video, /podcast et
 * le rendu des corps d'articles). Objectif : permettre à l'annonceur de
 * choisir un emplacement visible ; les slots sans usage frontal sont
 * signalés comme réservés.
 */
const SLOT_HINTS: Record<string, string> = {
  "AD-01": "Bannière haut de page accueil",
  "AD-02": "Colonne accueil",
  "AD-03": "Pleine largeur accueil",
  "AD-04": "Dans les articles",
  "AD-10": "Haut page vidéo/podcast",
  "AD-12": "Bandeau mobile collant",
  // Autres emplacements réellement rendus aujourd'hui :
  "AD-06": "Pavé pied de page vidéo",
  "AD-07": "Entre les sections accueil",
  "AD-08": "Carte éditoriale accueil",
  "AD-14": "Bas de colonne accueil",
  "AD-15": "Pied de page accueil",
  "AD-16": "Carte éditoriale accueil (météo)",
};

const SLOT_RESERVED_HINT = "Réservé — non affiché actuellement";

function slotHint(code: string): string {
  return SLOT_HINTS[code] ?? SLOT_RESERVED_HINT;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

/** ISO → valeur pour <input type="datetime-local"> (minutes locales). */
function toInputDateTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Valeur datetime-local → ISO UTC. */
function fromInputDateTime(value: string): string {
  return new Date(value).toISOString();
}

interface FormState {
  name: string;
  advertiser: string;
  slotCode: string;
  mediaKind: AdCampaignItem["media_kind"];
  mediaId: string | null;
  mediaPreviewUrl: string | null;
  videoUrl: string;
  clickUrl: string;
  startsAt: string;
  endsAt: string;
  priority: string;
  isActive: boolean;
  deviceTargeting: AdCampaignItem["device_targeting"];
  categoryTargeting: string;
  htmlCode: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  advertiser: "",
  slotCode: "",
  mediaKind: "image",
  mediaId: null,
  mediaPreviewUrl: null,
  videoUrl: "",
  clickUrl: "",
  startsAt: toInputDateTime(new Date().toISOString()),
  endsAt: "",
  priority: "5",
  isActive: true,
  deviceTargeting: "ALL",
  categoryTargeting: "",
  htmlCode: "",
};

export function AdsClient({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();

  const [items, setItems] = useState<AdCampaignItem[]>([]);
  const [slots, setSlots] = useState<AdSlotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const load = useCallback(async () => {
    try {
      const { data, meta } = await apiFetch<AdCampaignItem[]>("/api/admin/ads/campaigns");
      setItems(data);
      if (meta && Array.isArray(meta.slots)) setSlots(meta.slots as AdSlotItem[]);
    } catch (error) {
      toast({ title: "Chargement impossible", description: errorMessage(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, slotCode: slots[0]?.code ?? "" });
    setFormOpen(true);
  };

  const openEdit = (item: AdCampaignItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      advertiser: item.advertiser,
      slotCode: item.slot_code,
      mediaKind: item.media_kind,
      mediaId: item.media_id,
      mediaPreviewUrl: item.media_url,
      videoUrl: item.video_url ?? "",
      clickUrl: item.click_url,
      startsAt: toInputDateTime(item.starts_at),
      endsAt: toInputDateTime(item.ends_at),
      priority: String(item.priority),
      isActive: item.is_active,
      deviceTargeting: item.device_targeting ?? "ALL",
      categoryTargeting: item.category_targeting ?? "",
      htmlCode: item.html_code ?? "",
    });
    setFormOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim() || !form.advertiser.trim() || !form.slotCode) {
      toast({ title: "Champs requis", description: "Nom, annonceur et emplacement sont obligatoires.", variant: "destructive" });
      return;
    }
    if (!/^https?:\/\//i.test(form.clickUrl.trim())) {
      toast({ title: "URL de destination invalide", description: "Elle doit commencer par http:// ou https://.", variant: "destructive" });
      return;
    }
    if (form.mediaKind === "video" && !/^https?:\/\//i.test(form.videoUrl.trim()) && !form.htmlCode.trim()) {
      toast({ title: "URL vidéo requise", description: "Fournissez une URL YouTube ou mp4 (http/https) ou un code HTML de repli.", variant: "destructive" });
      return;
    }
    if (form.mediaKind !== "video" && !form.mediaId && !form.htmlCode.trim()) {
      toast({ title: "Média requis", description: "Choisissez une image ou un GIF dans la médiathèque, ou fournissez un code HTML de repli.", variant: "destructive" });
      return;
    }
    if (!form.startsAt) {
      toast({ title: "Date de début requise", variant: "destructive" });
      return;
    }

    const payload = {
      name: form.name.trim(),
      advertiser: form.advertiser.trim(),
      slot_code: form.slotCode,
      media_kind: form.mediaKind,
      media_id: form.mediaKind === "video" ? null : form.mediaId,
      video_url: form.mediaKind === "video" ? form.videoUrl.trim() : null,
      click_url: form.clickUrl.trim(),
      starts_at: fromInputDateTime(form.startsAt),
      ends_at: form.endsAt ? fromInputDateTime(form.endsAt) : null,
      priority: Number(form.priority) || 5,
      is_active: form.isActive,
      device_targeting: form.deviceTargeting,
      category_targeting: form.categoryTargeting.trim() ? form.categoryTargeting.trim() : null,
      html_code: form.htmlCode.trim() ? form.htmlCode : null,
    };

    setSaving(true);
    try {
      if (editingId) {
        await apiFetch(`/api/admin/ads/campaigns/${encodeURIComponent(editingId)}`, { method: "PATCH", json: payload });
        toast({ title: "Campagne mise à jour" });
      } else {
        await apiFetch("/api/admin/ads/campaigns", { method: "POST", json: payload });
        toast({ title: "Campagne créée", description: "Elle est immédiatement diffusée si active." });
      }
      setFormOpen(false);
      await load();
    } catch (error) {
      toast({ title: "Enregistrement impossible", description: errorMessage(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: AdCampaignItem) => {
    try {
      await apiFetch(`/api/admin/ads/campaigns/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        json: { is_active: !item.is_active },
      });
      toast({ title: item.is_active ? "Campagne désactivée" : "Campagne activée", description: item.name });
      await load();
    } catch (error) {
      toast({ title: "Action impossible", description: errorMessage(error), variant: "destructive" });
    }
  };

  const remove = async (item: AdCampaignItem) => {
    try {
      await apiFetch(`/api/admin/ads/campaigns/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      toast({ title: "Campagne supprimée", description: item.name });
      await load();
    } catch (error) {
      toast({ title: "Suppression impossible", description: errorMessage(error), variant: "destructive" });
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kicker text-brand-red">Monétisation</p>
          <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight">Régie publicitaire</h1>
          <p className="mt-1 text-sm text-ink-faint">
            Campagnes diffusées sur les emplacements AD-01 à AD-19 du site public.
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            Nouvelle campagne
          </Button>
        )}
      </header>

      {/* ── Formulaire création / édition ─────────────────────────────── */}
      {formOpen && (
        <section aria-label="Formulaire de campagne" className="border border-rule bg-paper p-4">
          <p className="kicker text-ink-faint">{editingId ? "Modifier la campagne" : "Nouvelle campagne"}</p>
          <form
            className="mt-3 grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="ad-name" className="text-xs font-semibold text-ink-soft">Nom de la campagne *</Label>
              <Input id="ad-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={200} placeholder="Ex. Lancement Orange Money" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ad-advertiser" className="text-xs font-semibold text-ink-soft">Annonceur *</Label>
              <Input id="ad-advertiser" value={form.advertiser} onChange={(e) => setForm({ ...form, advertiser: e.target.value })} maxLength={200} placeholder="Ex. Orange Guinée" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-ink-soft">Emplacement *</Label>
              <Select value={form.slotCode} onValueChange={(value) => setForm({ ...form, slotCode: value })}>
                <SelectTrigger aria-label="Emplacement publicitaire">
                  <SelectValue placeholder="Choisir un emplacement" />
                </SelectTrigger>
                <SelectContent>
                  {slots.map((slot) => (
                    <SelectItem key={slot.code} value={slot.code}>
                      <span className="flex flex-col items-start gap-0.5">
                        <span>
                          {slot.code} — {slot.name}
                          {slot.width && slot.height ? ` (${slot.width}×${slot.height})` : ""}
                        </span>
                        <span className={cn("text-[11px] leading-tight", SLOT_HINTS[slot.code] ? "text-ink-faint" : "text-ink-faint/70")}>
                          {slotHint(slot.code)}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.slotCode && (
                <p className="text-xs text-ink-faint" aria-live="polite">
                  Affichage : {slotHint(form.slotCode)}
                </p>
              )}
              <p className="text-[11px] leading-snug text-ink-faint/90">
                Emplacements principaux réellement affichés : AD-01 bannière haut de page accueil · AD-02 colonne
                accueil · AD-03 pleine largeur accueil · AD-04 dans les articles · AD-10 haut page vidéo/podcast ·
                AD-12 bandeau mobile collant.
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-ink-soft">Type de média *</Label>
              <Select value={form.mediaKind} onValueChange={(value) => setForm({ ...form, mediaKind: value as AdCampaignItem["media_kind"] })}>
                <SelectTrigger aria-label="Type de média">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">Image statique</SelectItem>
                  <SelectItem value="gif">GIF animé</SelectItem>
                  <SelectItem value="video">Vidéo (YouTube / mp4)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.mediaKind !== "video" ? (
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-semibold text-ink-soft">Créative (médiathèque) *</Label>
                <div className="flex items-center gap-3">
                  {form.mediaPreviewUrl ? (
                    <img src={form.mediaPreviewUrl} alt="Aperçu de la créative" className="h-16 w-28 border border-rule object-cover" />
                  ) : (
                    <span className="flex h-16 w-28 items-center justify-center border border-dashed border-rule bg-paper-alt text-ink-faint">
                      <ImageIcon className="size-5" aria-hidden />
                    </span>
                  )}
                  <Button type="button" variant="outline" onClick={() => setPickerOpen(true)}>
                    <ImageIcon className="size-4" aria-hidden />
                    {form.mediaId ? "Changer de média" : "Choisir un média"}
                  </Button>
                  <span className="text-xs text-ink-faint">{MEDIA_KIND_LABELS[form.mediaKind]} · l&apos;original est servi tel quel (GIF animé préservé)</span>
                </div>
                <MediaPicker
                  open={pickerOpen}
                  onOpenChange={setPickerOpen}
                  filterType="image"
                  title="Choisir la créative"
                  onSelect={(media: MediaItem) =>
                    setForm({
                      ...form,
                      mediaId: media.id,
                      mediaPreviewUrl: media.url,
                      mediaKind: media.mime_type === "image/gif" ? "gif" : "image",
                    })
                  }
                />
              </div>
            ) : (
              <div className="space-y-1">
                <Label htmlFor="ad-video" className="text-xs font-semibold text-ink-soft">URL vidéo * (YouTube ou mp4)</Label>
                <Input id="ad-video" type="url" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} placeholder="https://www.youtube.com/watch?v=… ou https://…/video.mp4" />
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="ad-click" className="text-xs font-semibold text-ink-soft">URL de destination *</Label>
              <Input id="ad-click" type="url" value={form.clickUrl} onChange={(e) => setForm({ ...form, clickUrl: e.target.value })} placeholder="https://…" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ad-priority" className="text-xs font-semibold text-ink-soft">Priorité (1 garanti → 9 remplissage)</Label>
              <Input id="ad-priority" type="number" min={1} max={9} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-ink-soft">Appareils ciblés</Label>
              <Select value={form.deviceTargeting} onValueChange={(value) => setForm({ ...form, deviceTargeting: value as AdCampaignItem["device_targeting"] })}>
                <SelectTrigger aria-label="Appareils ciblés">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les appareils</SelectItem>
                  <SelectItem value="MOBILE">Mobile uniquement</SelectItem>
                  <SelectItem value="DESKTOP">Desktop uniquement</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] leading-snug text-ink-faint/90">
                La créative n'est servie qu'aux appareils choisis (détection User-Agent).
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="ad-categories" className="text-xs font-semibold text-ink-soft">Rubriques ciblées (CSV de slugs, optionnel)</Label>
              <Input
                id="ad-categories"
                value={form.categoryTargeting}
                onChange={(e) => setForm({ ...form, categoryTargeting: e.target.value })}
                maxLength={500}
                placeholder="ex. politique,economie,sport"
              />
              <p className="text-[11px] leading-snug text-ink-faint/90">
                Slugs de rubriques séparés par des virgules — vide = toutes les pages.
              </p>
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="ad-html" className="text-xs font-semibold text-ink-soft">Code HTML de repli (optionnel)</Label>
              <Textarea
                id="ad-html"
                value={form.htmlCode}
                onChange={(e) => setForm({ ...form, htmlCode: e.target.value })}
                className="min-h-20 bg-paper font-mono text-xs"
                placeholder="<div><strong>Votre marque</strong> — <a href='https://…'>découvrir</a></div>"
                aria-label="Code HTML de repli"
              />
              <p className="text-[11px] leading-snug text-ink-faint/90">
                Affiché si aucun média ni vidéo n'est disponible. Sanitisation stricte au rendu :
                seules les balises b, i, em, strong, a, img, div, span, p, br sont conservées
                (scripts, iframes et attributs on* supprimés ; liens http(s) uniquement).
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="ad-starts" className="text-xs font-semibold text-ink-soft">Début de diffusion *</Label>
              <Input id="ad-starts" type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ad-ends" className="text-xs font-semibold text-ink-soft">Fin de diffusion (vide = illimitée)</Label>
              <Input id="ad-ends" type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
            </div>

            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch id="ad-active" checked={form.isActive} onCheckedChange={(checked) => setForm({ ...form, isActive: checked })} />
              <Label htmlFor="ad-active" className="text-sm text-ink-soft">Campagne active (diffusée sur le site)</Label>
            </div>

            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Megaphone className="size-4" aria-hidden />}
                {editingId ? "Enregistrer" : "Créer la campagne"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Annuler
              </Button>
            </div>
          </form>
        </section>
      )}

      {/* ── Liste des campagnes ───────────────────────────────────────── */}
      <section aria-label="Liste des campagnes">
        <p className="kicker text-ink-faint">Campagnes {loading ? "" : `(${items.length})`}</p>

        {loading ? (
          <div className="mt-3 space-y-2" aria-hidden>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full bg-paper-alt" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-3 border border-dashed border-rule bg-paper-alt p-10 text-center">
            <Megaphone className="mx-auto size-6 text-ink-faint" aria-hidden />
            <p className="mt-2 text-sm font-medium text-ink-soft">Aucune campagne pour le moment</p>
            <p className="mt-1 text-xs text-ink-faint">
              Créez une campagne pour diffuser une créative réelle sur les emplacements du site.
            </p>
          </div>
        ) : (
          <ul className="mt-3 border border-rule bg-paper">
            {items.map((item) => (
              <li key={item.id} className={cn("border-b border-rule p-3 last:border-0", !item.is_active && "bg-paper-alt/60")}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-ink">{item.name}</p>
                      <Badge className={item.is_active ? "border-brand-red bg-brand-red text-white" : "border-rule bg-paper-alt text-ink-faint"}>
                        {item.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline" className="border-rule bg-paper text-ink-soft">
                        {item.media_kind === "video" ? "Vidéo" : item.media_kind === "gif" ? "GIF" : "Image"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
                      <span className="font-medium text-ink-soft">{item.advertiser}</span>
                      <span title={item.slot_name}>
                        {item.slot_code} · {FORMAT_LABELS[slots.find((s) => s.code === item.slot_code)?.format ?? ""] ?? item.slot_name}
                      </span>
                      <span>
                        {formatDateTime(item.starts_at)} → {item.ends_at ? formatDateTime(item.ends_at) : "illimitée"}
                      </span>
                      <span className="inline-flex items-center gap-1" title="Impressions">
                        <Eye className="size-3" aria-hidden />
                        {item.impressions.toLocaleString("fr-FR")}
                      </span>
                      <span className="inline-flex items-center gap-1" title="Clics">
                        <MousePointerClick className="size-3" aria-hidden />
                        {item.clicks.toLocaleString("fr-FR")}
                      </span>
                      <span>Priorité {item.priority}</span>
                      <span className="inline-flex items-center gap-1" title="Appareils ciblés">
                        {item.device_targeting === "MOBILE" ? <Smartphone className="size-3" aria-hidden /> : item.device_targeting === "DESKTOP" ? <Monitor className="size-3" aria-hidden /> : null}
                        {item.device_targeting === "MOBILE" ? "Mobile" : item.device_targeting === "DESKTOP" ? "Desktop" : "Tous appareils"}
                      </span>
                      {item.category_targeting && (
                        <span title={`Rubriques ciblées : ${item.category_targeting}`}>
                          Ciblage : {item.category_targeting}
                        </span>
                      )}
                      {item.html_code && <span title="Créative HTML de repli définie">HTML repli</span>}
                      <a
                        href={item.click_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-ink-soft underline underline-offset-2 hover:text-brand-red"
                        aria-label={`Ouvrir l'URL de destination : ${item.click_url}`}
                      >
                        <ExternalLink className="size-3" aria-hidden />
                        Destination
                      </a>
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(item)} aria-label={`Modifier la campagne : ${item.name}`} title="Modifier">
                        <Pencil className="size-4" aria-hidden />
                        <span className="sr-only">Modifier</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void toggleActive(item)}
                        aria-label={item.is_active ? `Désactiver la campagne : ${item.name}` : `Activer la campagne : ${item.name}`}
                        title={item.is_active ? "Désactiver" : "Activer"}
                      >
                        <Power className="size-4" aria-hidden />
                        <span className="sr-only">{item.is_active ? "Désactiver" : "Activer"}</span>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-brand-red hover:bg-red-wash hover:text-red-deep"
                            aria-label={`Supprimer la campagne : ${item.name}`}
                            title="Supprimer"
                          >
                            <Trash2 className="size-4" aria-hidden />
                            <span className="sr-only">Supprimer</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-paper">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="font-serif">Supprimer cette campagne ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              « {item.name} » ({item.advertiser}) sera retirée de la régie. Cette action est définitive.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction className="bg-brand-red text-white hover:bg-red-deep" onClick={() => void remove(item)}>
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
