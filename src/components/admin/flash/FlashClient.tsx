"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
import { apiFetch, errorMessage } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ExternalLink, Loader2, TimerOff, Trash2, Zap } from "lucide-react";

/**
 * Publication d'urgence — flashs (§11.2) : saisie en une ligne (texte,
 * priorité, lien, expiration en heures), liste avec compte à rebours,
 * expiration immédiate ou suppression.
 */

interface FlashItem {
  id: string;
  text: string;
  article_id: string | null;
  external_url: string | null;
  priority: number;
  published_at: string;
  expires_at: string;
  article: { title: string; slug: string } | null;
}

const PRIORITY_LABELS: Record<number, string> = {
  1: "Urgent",
  2: "Prioritaire",
  3: "Normal",
};

function priorityBadgeClass(priority: number): string {
  if (priority === 1) return "border-brand-red bg-brand-red text-white";
  if (priority === 2) return "border-rule bg-paper-alt text-ink";
  return "border-rule bg-paper text-ink-soft";
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

function splitDuration(ms: number): { h: number; m: number } {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  return { h: Math.floor(totalMinutes / 60), m: totalMinutes % 60 };
}

/** Compte à rebours avant expiration (rafraîchi par l'horloge locale). */
function formatCountdown(expiresAt: string, now: number): string {
  const diff = new Date(expiresAt).getTime() - now;
  if (diff <= 0) return "expiré";
  const { h, m } = splitDuration(diff);
  if (h > 0) return `dans ${h} h ${String(m).padStart(2, "0")} min`;
  return `dans ${m} min`;
}

/** Durée écoulée depuis l'expiration, pour les flashs grisés. */
function formatSinceExpiry(expiresAt: string, now: number): string {
  const diff = now - new Date(expiresAt).getTime();
  const { h, m } = splitDuration(diff);
  if (h > 24) return `expiré depuis ${Math.floor(h / 24)} j`;
  if (h > 0) return `expiré depuis ${h} h ${String(m).padStart(2, "0")} min`;
  return `expiré depuis ${m} min`;
}

export function FlashClient() {
  const { toast } = useToast();

  const [items, setItems] = useState<FlashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Formulaire une ligne
  const [text, setText] = useState("");
  const [priority, setPriority] = useState("2");
  const [link, setLink] = useState("");
  const [hours, setHours] = useState("12");

  // Horloge locale pour les comptes à rebours (30 s)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    try {
      const { data } = await apiFetch<FlashItem[]>("/api/admin/flash");
      setItems(data);
    } catch (error) {
      toast({ title: "Chargement impossible", description: errorMessage(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const publish = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      toast({ title: "Texte requis", description: "Saisissez le texte du flash avant de publier.", variant: "destructive" });
      return;
    }
    if (link.trim() && !/^https?:\/\//i.test(link.trim())) {
      toast({ title: "Lien invalide", description: "Le lien doit commencer par http:// ou https://.", variant: "destructive" });
      return;
    }
    const hoursNumber = Number(hours);
    if (!Number.isInteger(hoursNumber) || hoursNumber < 1 || hoursNumber > 72) {
      toast({ title: "Expiration invalide", description: "La durée de validité doit être comprise entre 1 et 72 heures.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch("/api/admin/flash", {
        method: "POST",
        json: {
          text: trimmed,
          priority: Number(priority),
          link: link.trim() || null,
          expires_in_hours: hoursNumber,
        },
      });
      setText("");
      toast({ title: "Flash publié", description: PRIORITY_LABELS[Number(priority)] ? `Priorité : ${PRIORITY_LABELS[Number(priority)]}.` : undefined });
      await load();
    } catch (error) {
      toast({ title: "Publication impossible", description: errorMessage(error), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const expire = async (item: FlashItem) => {
    try {
      await apiFetch(`/api/admin/flash?id=${encodeURIComponent(item.id)}&mode=expire`, { method: "DELETE" });
      toast({ title: "Flash expiré", description: "Il n'est plus visible en front-office." });
      await load();
    } catch (error) {
      toast({ title: "Action impossible", description: errorMessage(error), variant: "destructive" });
    }
  };

  const remove = async (item: FlashItem) => {
    try {
      await apiFetch(`/api/admin/flash?id=${encodeURIComponent(item.id)}&mode=delete`, { method: "DELETE" });
      toast({ title: "Flash supprimé" });
      await load();
    } catch (error) {
      toast({ title: "Suppression impossible", description: errorMessage(error), variant: "destructive" });
    }
  };

  const { active, expired } = useMemo(() => {
    const activeList: FlashItem[] = [];
    const expiredList: FlashItem[] = [];
    for (const item of items) {
      if (new Date(item.expires_at).getTime() > now) activeList.push(item);
      else expiredList.push(item);
    }
    return { active: activeList, expired: expiredList };
  }, [items, now]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="kicker text-brand-red">Publication d&apos;urgence</p>
        <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight">Flashs</h1>
        <p className="mt-1 text-sm text-ink-faint">
          Un flash s&apos;affiche immédiatement en tête du site et expire automatiquement.
        </p>
      </header>

      {/* ── Saisie en une ligne ─────────────────────────────────────────── */}
      <section aria-label="Saisie rapide d'un flash" className="border border-rule bg-paper p-4">
        <p className="kicker text-ink-faint">Saisie rapide</p>
        <form
          className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void publish();
          }}
        >
          <div className="flex-1 space-y-1">
            <Label htmlFor="flash-text" className="text-xs font-semibold text-ink-soft">
              Texte du flash *
            </Label>
            <Input
              id="flash-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={300}
              placeholder="À la minute : …"
              aria-label="Texte du flash (300 caractères maximum)"
              autoComplete="off"
            />
            <p className="text-right text-xs text-ink-faint" aria-live="polite">
              {text.length}/300
            </p>
          </div>

          <div className="space-y-1 lg:w-44">
            <Label htmlFor="flash-priority" className="text-xs font-semibold text-ink-soft">
              Priorité
            </Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger id="flash-priority" aria-label="Priorité du flash">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 — Urgent (rouge)</SelectItem>
                <SelectItem value="2">2 — Prioritaire</SelectItem>
                <SelectItem value="3">3 — Normal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 lg:w-56">
            <Label htmlFor="flash-link" className="text-xs font-semibold text-ink-soft">
              Lien (optionnel)
            </Label>
            <Input
              id="flash-link"
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://…"
              aria-label="Lien associé au flash"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1 lg:w-24">
            <Label htmlFor="flash-hours" className="text-xs font-semibold text-ink-soft">
              Durée (h)
            </Label>
            <Input
              id="flash-hours"
              type="number"
              min={1}
              max={72}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              aria-label="Durée de validité en heures"
            />
          </div>

          <Button type="submit" disabled={submitting} className="lg:mb-[26px]" aria-label="Publier le flash">
            {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Zap className="size-4" aria-hidden />}
            Publier
          </Button>
        </form>
      </section>

      {/* ── Liste des flashs ───────────────────────────────────────────── */}
      <section aria-label="Liste des flashs">
        <div className="flex items-baseline justify-between gap-2">
          <p className="kicker text-ink-faint">
            Flashs actifs {loading ? "" : `(${active.length})`}
          </p>
          {expired.length > 0 && (
            <p className="text-xs text-ink-faint">
              {expired.length} expiré{expired.length > 1 ? "s" : ""} ci-dessous
            </p>
          )}
        </div>

        {loading ? (
          <div className="mt-3 space-y-2" aria-hidden>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full bg-paper-alt" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-3 border border-dashed border-rule bg-paper-alt p-10 text-center">
            <Zap className="mx-auto size-6 text-ink-faint" aria-hidden />
            <p className="mt-2 text-sm font-medium text-ink-soft">Aucun flash pour le moment</p>
            <p className="mt-1 text-xs text-ink-faint">
              Utilisez la saisie rapide ci-dessus pour publier une information urgente.
            </p>
          </div>
        ) : (
          <ul className="mt-3 border border-rule bg-paper">
            {items.map((item) => {
              const isExpired = new Date(item.expires_at).getTime() <= now;
              return (
                <li
                  key={item.id}
                  className={cn(
                    "border-b border-rule p-3 last:border-0",
                    isExpired && "bg-paper-alt/60 opacity-60"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex shrink-0 flex-col items-start gap-1">
                      <Badge className={priorityBadgeClass(item.priority)} aria-label={`Priorité ${item.priority} : ${PRIORITY_LABELS[item.priority] ?? item.priority}`}>
                        {PRIORITY_LABELS[item.priority] ?? item.priority}
                      </Badge>
                      {isExpired && (
                        <Badge variant="outline" className="border-rule bg-paper-alt text-ink-faint">
                          Expiré
                        </Badge>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug text-ink">{item.text}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
                        <span>Publié {formatDateTime(item.published_at)}</span>
                        <span className={isExpired ? "" : "font-medium text-ink-soft"} aria-live="off">
                          {isExpired
                            ? formatSinceExpiry(item.expires_at, now)
                            : `Expire ${formatCountdown(item.expires_at, now)}`}
                        </span>
                        {item.article && (
                          <span className="truncate" title={item.article.title}>
                            Lié à : {item.article.title}
                          </span>
                        )}
                        {item.external_url && (
                          <a
                            href={item.external_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-ink-soft underline underline-offset-2 hover:text-brand-red"
                            aria-label={`Ouvrir le lien du flash : ${item.external_url}`}
                          >
                            <ExternalLink className="size-3" aria-hidden />
                            Lien
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {!isExpired && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void expire(item)}
                          aria-label={`Expirer maintenant le flash : ${item.text}`}
                          title="Expirer maintenant"
                        >
                          <TimerOff className="size-4" aria-hidden />
                          <span className="hidden md:inline">Expirer maintenant</span>
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-brand-red hover:bg-red-wash hover:text-red-deep"
                            aria-label={`Supprimer le flash : ${item.text}`}
                            title="Supprimer"
                          >
                            <Trash2 className="size-4" aria-hidden />
                            <span className="sr-only">Supprimer</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-paper">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="font-serif">Supprimer ce flash ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              « {item.text} » sera retiré de la liste. Cette action est définitive.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-brand-red text-white hover:bg-red-deep"
                              onClick={() => void remove(item)}
                            >
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
