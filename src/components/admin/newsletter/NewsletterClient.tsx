"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  ListChecks,
  Loader2,
  Mail,
  RotateCcw,
  Search,
  Trash2,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch, errorMessage } from "@/lib/api/client";

/**
 * Newsletter (§11.2 /admin/newsletter) — inscrits à la newsletter :
 * indicateurs (total, en attente, confirmés, désabonnés) et effectifs par
 * liste de diffusion ; table filtrable (e-mail, statut, liste) et paginée ;
 * confirmation manuelle, désabonnement, suppression (confirmations par
 * dialogue) ; export CSV côté serveur (mêmes filtres).
 */

// ─── Types (transport JSON) ────────────────────────────────────────────

type SubscriberStatus = "pending" | "confirmed" | "unsubscribed" | "bounced" | "complained";

interface SubscriberRow {
  id: string;
  email: string;
  first_name: string | null;
  country: string | null;
  status: SubscriberStatus;
  source: string | null;
  created_at: string;
  unsubscribed_at: string | null;
  lists: { key: string; name: string }[];
}

interface SubscriberListView {
  id: string;
  key: string;
  name: string;
  is_active: boolean;
  subscribers: number;
}

interface NewsletterStats {
  total: number;
  pending: number;
  confirmed: number;
  unsubscribed: number;
  bounced: number;
  complained: number;
}

interface Filters {
  q: string; // recherche par e-mail
  status: "all" | SubscriberStatus;
  listId: "all" | string; // « all » ou identifiant de liste
}

const EMPTY_FILTERS: Filters = { q: "", status: "all", listId: "all" };
const PER_PAGE = 20;

const STATUS_OPTIONS: { value: SubscriberStatus; label: string }[] = [
  { value: "pending", label: "En attente" },
  { value: "confirmed", label: "Confirmés" },
  { value: "unsubscribed", label: "Désabonnés" },
  { value: "bounced", label: "Rejets (bounce)" },
  { value: "complained", label: "Réclamations" },
];

const STATUS_LABELS: Record<SubscriberStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmé",
  unsubscribed: "Désabonné",
  bounced: "Rejeté (bounce)",
  complained: "Réclamation",
};

/** Couleur du badge selon le statut (mêmes teintes que le journal d'audit). */
function statusBadgeClass(status: SubscriberStatus): string {
  if (status === "confirmed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";
  }
  if (status === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300";
  }
  if (status === "unsubscribed") {
    return "border-rule bg-paper-alt text-ink-faint";
  }
  // bounced, complained
  return "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300";
}

const SOURCE_LABELS: Record<string, string> = {
  home_inline: "Bloc accueil",
  article_inline: "Bloc article",
  footer: "Pied de page",
  exit: "Intention de sortie",
  page: "Page dédiée",
};

function sourceLabel(source: string | null): string {
  if (!source) return "—";
  return SOURCE_LABELS[source] ?? source;
}

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return DATE_TIME_FORMAT.format(date);
}

/** Numéros de page affichés (avec ellipse au-delà de 7 pages). */
function pageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) items.push("…");
  for (let p = start; p <= end; p += 1) items.push(p);
  if (end < total - 1) items.push("…");
  items.push(total);
  return items;
}

type PendingAction = { type: "confirm" | "unsubscribe" | "delete"; row: SubscriberRow } | null;

// ─── Composant ─────────────────────────────────────────────────────────

export function NewsletterClient({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<SubscriberRow[]>([]);
  const [lists, setLists] = useState<SubscriberListView[]>([]);
  const [stats, setStats] = useState<NewsletterStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState<string | null>(null);

  // Filtres appliqués (requête) et brouillon (formulaire).
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);

  // Action en cours de confirmation (dialogue).
  const [action, setAction] = useState<PendingAction>(null);

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const q = filters.q.trim();
      if (q) params.set("q", q);
      if (filters.status !== "all") params.set("status", filters.status);
      if (filters.listId !== "all") params.set("list_id", filters.listId);
      params.set("page", String(page));
      params.set("per_page", String(PER_PAGE));

      const { data, meta } = await apiFetch<SubscriberRow[]>(`/api/admin/newsletter/subscribers?${params}`);
      setRows(data);
      setTotal(Number(meta?.total ?? 0));
      if (meta && typeof meta.stats === "object" && meta.stats !== null) {
        setStats(meta.stats as NewsletterStats);
      }
      if (meta && Array.isArray(meta.lists)) {
        setLists(meta.lists as SubscriberListView[]);
      }
    } catch (error) {
      toast.error("Chargement des inscrits impossible", { description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyFilters = () => {
    setFilters(draft);
    setPage(1);
  };

  const resetFilters = () => {
    setDraft(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  /** Export CSV : mêmes filtres que la liste, sans pagination. */
  const exportCsv = () => {
    const params = new URLSearchParams();
    const q = filters.q.trim();
    if (q) params.set("q", q);
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.listId !== "all") params.set("list_id", filters.listId);
    params.set("format", "csv");
    window.location.href = `/api/admin/newsletter/subscribers?${params}`;
  };

  const runAction = async () => {
    if (!action) return;
    const { type, row } = action;
    setAction(null);
    setMutating(row.id);
    try {
      if (type === "delete") {
        await apiFetch(`/api/admin/newsletter/subscribers/${encodeURIComponent(row.id)}`, { method: "DELETE" });
        toast.success("Inscrit supprimé", { description: row.email });
      } else {
        const status: SubscriberStatus = type === "confirm" ? "confirmed" : "unsubscribed";
        await apiFetch(`/api/admin/newsletter/subscribers/${encodeURIComponent(row.id)}`, {
          method: "PATCH",
          json: { status },
        });
        toast.success(
          type === "confirm" ? "Inscription confirmée" : "Inscrit désabonné",
          { description: row.email }
        );
      }
      await load();
    } catch (error) {
      toast.error("Action impossible", { description: errorMessage(error) });
    } finally {
      setMutating(null);
    }
  };

  const statCards = stats
    ? [
        { label: "Total inscrits", value: stats.total, icon: Users, cls: "text-ink-soft" },
        { label: "En attente", value: stats.pending, icon: Clock3, cls: "text-amber-600 dark:text-amber-400" },
        { label: "Confirmés", value: stats.confirmed, icon: UserCheck, cls: "text-emerald-600 dark:text-emerald-400" },
        { label: "Désabonnés", value: stats.unsubscribed, icon: UserX, cls: "text-ink-faint" },
      ]
    : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="kicker text-brand-red">Diffusion</p>
        <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-ink">Newsletter</h1>
        <p className="mt-1 text-sm text-ink-faint">
          Inscrits aux listes de diffusion : consultation, confirmation manuelle, désabonnement et
          export.
        </p>
      </header>

      {/* ── Cartes indicateurs ─────────────────────────────────────── */}
      {stats === null && loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full bg-paper-alt" />
          ))}
        </div>
      ) : (
        <section aria-label="Indicateurs" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((card) => (
            <div key={card.label} className="border border-rule bg-paper p-4">
              <div className="flex items-center gap-2">
                <card.icon className={`size-4 ${card.cls}`} aria-hidden />
                <p className="kicker text-ink-faint">{card.label}</p>
              </div>
              <p className="mt-2 font-serif text-3xl font-bold tabular-nums text-ink">
                {card.value.toLocaleString("fr-FR")}
              </p>
            </div>
          ))}
        </section>
      )}

      {/* ── Effectifs par liste ────────────────────────────────────── */}
      {lists.length > 0 && (
        <section aria-label="Inscrits par liste de diffusion" className="border border-rule bg-paper p-4">
          <div className="flex items-center gap-2">
            <ListChecks className="size-4 text-ink-soft" aria-hidden />
            <p className="kicker text-ink-faint">Par liste de diffusion</p>
          </div>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {lists.map((list) => (
              <li
                key={list.id}
                className="flex items-center justify-between gap-2 border border-rule bg-paper-alt px-3 py-2"
              >
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-ink">{list.name}</span>
                  {!list.is_active && (
                    <Badge variant="outline" className="border-rule bg-paper text-ink-faint">
                      Inactive
                    </Badge>
                  )}
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-ink-soft">
                  {list.subscribers.toLocaleString("fr-FR")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Filtres ────────────────────────────────────────────────── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          applyFilters();
        }}
        className="rounded-[2px] border border-rule bg-paper-alt p-4"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="nl-search" className="text-xs text-ink-faint">
              Recherche par e-mail
            </Label>
            <Input
              id="nl-search"
              type="search"
              value={draft.q}
              onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
              placeholder="ex. nom@exemple.com"
              aria-label="Rechercher un inscrit par adresse e-mail"
              className="mt-1 bg-paper"
            />
          </div>

          <div>
            <Label htmlFor="nl-status" className="text-xs text-ink-faint">
              Statut
            </Label>
            <Select
              value={draft.status}
              onValueChange={(value) => setDraft((d) => ({ ...d, status: value as Filters["status"] }))}
            >
              <SelectTrigger id="nl-status" aria-label="Filtrer par statut" className="mt-1 w-full bg-paper">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="all">Tous les statuts</SelectItem>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="nl-list" className="text-xs text-ink-faint">
              Liste
            </Label>
            <Select
              value={draft.listId}
              onValueChange={(value) => setDraft((d) => ({ ...d, listId: value }))}
            >
              <SelectTrigger id="nl-list" aria-label="Filtrer par liste de diffusion" className="mt-1 w-full bg-paper">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="all">Toutes les listes</SelectItem>
                {lists.map((list) => (
                  <SelectItem key={list.id} value={list.id}>
                    {list.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" disabled={loading}>
            <Search aria-hidden />
            Filtrer
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={resetFilters} disabled={loading}>
            <RotateCcw aria-hidden />
            Réinitialiser
          </Button>
        </div>
      </form>

      {/* ── Barre d'outils : compteur, export CSV ──────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-xs text-ink-faint" aria-live="polite">
          {total.toLocaleString("fr-FR")} inscrit{total > 1 ? "s" : ""} · Page {page} / {pages}
        </p>
        <div className="ml-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={exportCsv}
            title="Export limité à 5 000 inscrits"
            aria-label="Exporter les inscrits filtrés au format CSV (5 000 lignes maximum)"
          >
            <Download aria-hidden />
            Exporter en CSV
          </Button>
        </div>
      </div>

      {/* ── Table des inscrits ─────────────────────────────────────── */}
      <div className="rounded-[2px] border border-rule bg-paper">
        <div
          role="region"
          aria-label="Inscrits à la newsletter"
          aria-busy={loading}
          className="max-h-[70vh] overflow-y-auto"
          style={{ scrollbarWidth: "thin" }}
        >
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-paper-alt">
              <TableRow className="border-b border-rule hover:bg-paper-alt">
                <TableHead className="text-ink-soft">E-mail</TableHead>
                <TableHead className="w-48 text-ink-soft">Listes</TableHead>
                <TableHead className="w-32 text-ink-soft">Statut</TableHead>
                <TableHead className="w-40 text-ink-soft">Inscrit le</TableHead>
                <TableHead className="w-36 text-ink-soft">Source</TableHead>
                <TableHead className="w-36 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`} className="border-b border-rule">
                      <TableCell colSpan={6} className="py-3">
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : rows.length === 0
                  ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6} className="py-14 text-center">
                          <Mail className="mx-auto size-6 text-ink-faint" aria-hidden />
                          <p className="mt-3 text-sm text-ink-soft">Aucun inscrit pour ces filtres.</p>
                          <Button variant="ghost" size="sm" className="mt-3" onClick={resetFilters}>
                            <RotateCcw aria-hidden />
                            Réinitialiser les filtres
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  : (
                      rows.map((row) => (
                        <TableRow key={row.id} className="border-b border-rule">
                          <TableCell className="py-2.5">
                            <p className="break-all text-sm font-medium text-ink">{row.email}</p>
                            {row.first_name && <p className="text-xs text-ink-faint">{row.first_name}</p>}
                          </TableCell>
                          <TableCell className="py-2.5">
                            {row.lists.length === 0 ? (
                              <span className="text-xs text-ink-faint">—</span>
                            ) : (
                              <span className="flex flex-wrap gap-1">
                                {row.lists.map((list) => (
                                  <Badge key={list.key} variant="outline" className="border-rule bg-paper text-ink-soft">
                                    {list.name}
                                  </Badge>
                                ))}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <Badge className={statusBadgeClass(row.status)}>{STATUS_LABELS[row.status]}</Badge>
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-ink-soft tabular-nums">
                            {formatDateTime(row.created_at)}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-ink-soft">{sourceLabel(row.source)}</TableCell>
                          <TableCell className="py-2.5 text-right">
                            {canManage ? (
                              <div className="inline-flex items-center gap-1">
                                {row.status === "pending" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={mutating === row.id}
                                    onClick={() => setAction({ type: "confirm", row })}
                                    aria-label={`Confirmer manuellement l'inscription : ${row.email}`}
                                    title="Confirmer l'inscription"
                                  >
                                    <Check className="size-4" aria-hidden />
                                    <span className="sr-only">Confirmer</span>
                                  </Button>
                                )}
                                {row.status !== "unsubscribed" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={mutating === row.id}
                                    onClick={() => setAction({ type: "unsubscribe", row })}
                                    aria-label={`Désabonner : ${row.email}`}
                                    title="Désabonner"
                                  >
                                    <Ban className="size-4" aria-hidden />
                                    <span className="sr-only">Désabonner</span>
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-brand-red hover:bg-red-wash hover:text-red-deep"
                                  disabled={mutating === row.id}
                                  onClick={() => setAction({ type: "delete", row })}
                                  aria-label={`Supprimer l'inscrit : ${row.email}`}
                                  title="Supprimer"
                                >
                                  <Trash2 className="size-4" aria-hidden />
                                  <span className="sr-only">Supprimer</span>
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-ink-faint">Lecture seule</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Pagination ─────────────────────────────────────────────── */}
      {pages > 1 ? (
        <Pagination aria-label="Pagination des inscrits">
          <PaginationContent>
            <PaginationItem>
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Page précédente"
              >
                <ChevronLeft aria-hidden />
                Précédent
              </Button>
            </PaginationItem>

            {pageList(page, pages).map((p, index) =>
              p === "…" ? (
                <PaginationItem key={`ellipsis-${index}`}>
                  <span className="px-1 text-sm text-ink-faint" aria-hidden>
                    …
                  </span>
                </PaginationItem>
              ) : (
                <PaginationItem key={`page-${p}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`min-w-9 ${p === page ? "border-brand-red text-brand-red" : ""}`}
                    disabled={loading}
                    onClick={() => setPage(p)}
                    aria-label={`Aller à la page ${p}`}
                    aria-current={p === page ? "page" : undefined}
                  >
                    {p}
                  </Button>
                </PaginationItem>
              )
            )}

            <PaginationItem>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pages || loading}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                aria-label="Page suivante"
              >
                Suivant
                <ChevronRight aria-hidden />
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}

      {/* ── Confirmation d'action (dialogue) ───────────────────────── */}
      <AlertDialog open={action !== null} onOpenChange={(open) => (open ? undefined : setAction(null))}>
        <AlertDialogContent className="bg-paper">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">
              {action?.type === "confirm" && "Confirmer cette inscription ?"}
              {action?.type === "unsubscribe" && "Désabonner ce contact ?"}
              {action?.type === "delete" && "Supprimer cet inscrit ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {action?.type === "confirm" &&
                `« ${action.row.email} » passera au statut Confirmé sans attendre le clic sur le lien d'e-mail.`}
              {action?.type === "unsubscribe" &&
                `« ${action.row.email} » ne recevra plus les envois des listes auxquelles il est inscrit.`}
              {action?.type === "delete" &&
                `« ${action.row.email} » sera définitivement effacé (droit à l'effacement RGPD). Cette action est irréversible.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className={
                action?.type === "delete" ? "bg-brand-red text-white hover:bg-red-deep" : undefined
              }
              onClick={() => void runAction()}
            >
              {action?.type === "confirm" && "Confirmer"}
              {action?.type === "unsubscribe" && "Désabonner"}
              {action?.type === "delete" && "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {mutating !== null && (
        <p className="sr-only" role="status">
          Traitement de la demande en cours
          <Loader2 className="ml-1 inline size-3 animate-spin" aria-hidden />
        </p>
      )}
    </div>
  );
}
