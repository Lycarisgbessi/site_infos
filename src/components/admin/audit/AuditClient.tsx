"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  RotateCcw,
  ScrollText,
  Search,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
 * Journal d'audit (§11.2 /admin/audit) : liste horodatée des actions
 * d'écriture du back-office, filtrable par utilisateur, action (préfixe),
 * ressource et période ; diff avant/après par entrée (dialogue) ; export
 * CSV ; pagination. Erreurs signalées par toast (sonner) et panneau en ligne.
 */

interface AuditEntry {
  id: number;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  before: string | null;
  after: string | null;
  ip_hash: string | null;
  user_agent: string | null;
  created_at: string;
  user: { display_name: string; email: string } | null;
}

interface UserOption {
  id: string;
  display_name: string;
  slug: string;
}

interface AuditFilters {
  user_id: string; // « all » ou identifiant
  action: string; // préfixe libre, ex. « article. »
  resource_type: string; // « all » ou valeur
  from: string; // AAAA-MM-JJ
  to: string; // AAAA-MM-JJ
}

interface AuditMeta {
  total: number;
  page: number;
  perPage: number;
}

const EMPTY_FILTERS: AuditFilters = {
  user_id: "all",
  action: "",
  resource_type: "all",
  from: "",
  to: "",
};

const PER_PAGE_OPTIONS = [20, 50, 100];

/** Ressources auditables (§06.2) — libellés de presse en français. */
const RESOURCE_TYPES: { value: string; label: string }[] = [
  { value: "article", label: "Article" },
  { value: "category", label: "Rubrique" },
  { value: "tag", label: "Mot-clé" },
  { value: "media", label: "Média" },
  { value: "page", label: "Page" },
  { value: "menu", label: "Menu" },
  { value: "setting", label: "Réglage" },
  { value: "translation", label: "Texte d'interface" },
  { value: "user", label: "Utilisateur" },
  { value: "session", label: "Session" },
  { value: "banner", label: "Bannière" },
  { value: "redirect", label: "Redirection" },
  { value: "homepage", label: "Page d'accueil" },
  { value: "une", label: "Une" },
  { value: "flash", label: "Flash" },
  { value: "comment", label: "Commentaire" },
  { value: "inbox", label: "Message reçu" },
];

const RESOURCE_LABELS = new Map(RESOURCE_TYPES.map((r) => [r.value, r.label]));

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return DATE_TIME_FORMAT.format(date);
}

/** Couleur du badge d'action selon le préfixe (§11.2 : auth.* rouge, settings.* ambre…). */
function actionBadgeClass(action: string): string {
  if (action.startsWith("auth.")) {
    return "border-transparent bg-brand-red text-white";
  }
  if (action.startsWith("settings.")) {
    return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300";
  }
  if (action.startsWith("user.")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";
  }
  // article.*, media.*, page.* … : neutre
  return "border-rule bg-paper-alt text-ink-soft";
}

function resourceLabel(value: string): string {
  return RESOURCE_LABELS.get(value) ?? value;
}

/** Identifiant de ressource abrégé (8 premiers caractères, mono). */
function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

/**
 * Analyse prudemment une colonne before/after (JSON sérialisé) pour
 * l'affichage en diff : JSON valide → indenté ; sinon → texte brut.
 */
function parseDiff(raw: string | null): string | null {
  if (raw === null) return null;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

/** Construit les paramètres de requête partagés (liste JSON et export CSV). */
function buildParams(filters: AuditFilters, page?: number, perPage?: number): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.user_id !== "all") params.set("user_id", filters.user_id);
  const action = filters.action.trim();
  if (action) params.set("action", action);
  if (filters.resource_type !== "all") params.set("resource_type", filters.resource_type);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (page !== undefined) params.set("page", String(page));
  if (perPage !== undefined) params.set("per_page", String(perPage));
  return params;
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

export function AuditClient() {
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [meta, setMeta] = useState<AuditMeta>({ total: 0, page: 1, perPage: 20 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);

  // Filtres appliqués (requête) et brouillon (formulaire).
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_FILTERS);
  const [draft, setDraft] = useState<AuditFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  // Entrée consultée (diff avant/après).
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const pages = Math.max(1, Math.ceil(meta.total / meta.perPage));

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = buildParams(filters, page, perPage);
      const { data, meta: m } = await apiFetch<AuditEntry[]>(`/api/admin/audit?${params}`);
      setRows(data);
      setMeta({
        total: Number(m?.total ?? 0),
        page: Number(m?.page ?? page),
        perPage: Number(m?.per_page ?? perPage),
      });
    } catch (error) {
      setLoadError(errorMessage(error));
      toast.error("Chargement du journal impossible", { description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [filters, page, perPage]);

  useEffect(() => {
    void load();
  }, [load]);

  // Liste des utilisateurs pour le filtre (repli silencieux : « Tous »).
  useEffect(() => {
    void (async () => {
      try {
        const { data } = await apiFetch<UserOption[]>("/api/admin/users/options");
        if (Array.isArray(data)) setUsers(data);
      } catch {
        // Options indisponibles : le filtre reste limité à « Tous les utilisateurs ».
      }
    })();
  }, []);

  const applyFilters = () => {
    setFilters(draft);
    setPage(1);
  };

  const resetFilters = () => {
    setDraft(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const changePerPage = (value: string) => {
    setPerPage(Number(value));
    setPage(1);
  };

  const openEntry = (entry: AuditEntry) => {
    setSelected(entry);
    setDialogOpen(true);
  };

  /** Export CSV : mêmes filtres que la liste, sans pagination. */
  const exportCsv = () => {
    const params = buildParams(filters);
    params.set("format", "csv");
    window.location.href = `/api/admin/audit?${params}`;
  };

  const beforeText = selected ? parseDiff(selected.before) : null;
  const afterText = selected ? parseDiff(selected.after) : null;

  return (
    <div className="space-y-4">
      {/* ── Filtres ─────────────────────────────────────────────────── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          applyFilters();
        }}
        className="rounded-[2px] border border-rule bg-paper-alt p-4"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div>
            <Label htmlFor="audit-user" className="text-xs text-ink-faint">
              Utilisateur
            </Label>
            <Select
              value={draft.user_id}
              onValueChange={(value) => setDraft((d) => ({ ...d, user_id: value }))}
            >
              <SelectTrigger
                id="audit-user"
                aria-label="Filtrer par utilisateur"
                className="mt-1 w-full bg-paper"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="all">Tous les utilisateurs</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="audit-action" className="text-xs text-ink-faint">
              Action (préfixe)
            </Label>
            <Input
              id="audit-action"
              value={draft.action}
              onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))}
              placeholder="article. · auth. · settings."
              aria-label="Filtrer par préfixe d'action"
              className="mt-1 bg-paper"
            />
          </div>

          <div>
            <Label htmlFor="audit-resource" className="text-xs text-ink-faint">
              Ressource
            </Label>
            <Select
              value={draft.resource_type}
              onValueChange={(value) => setDraft((d) => ({ ...d, resource_type: value }))}
            >
              <SelectTrigger
                id="audit-resource"
                aria-label="Filtrer par ressource"
                className="mt-1 w-full bg-paper"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="all">Toutes les ressources</SelectItem>
                {RESOURCE_TYPES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="audit-from" className="text-xs text-ink-faint">
              Depuis
            </Label>
            <Input
              id="audit-from"
              type="date"
              value={draft.from}
              max={draft.to || undefined}
              onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
              aria-label="Date de début de la période"
              className="mt-1 bg-paper"
            />
          </div>

          <div>
            <Label htmlFor="audit-to" className="text-xs text-ink-faint">
              Au
            </Label>
            <Input
              id="audit-to"
              type="date"
              value={draft.to}
              min={draft.from || undefined}
              onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
              aria-label="Date de fin de la période"
              className="mt-1 bg-paper"
            />
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

      {/* ── Barre d'outils : compteur, lignes/page, export CSV ─────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-xs text-ink-faint" aria-live="polite">
          {meta.total.toLocaleString("fr-FR")} entrée{meta.total > 1 ? "s" : ""} · Page{" "}
          {meta.page} / {pages}
        </p>

        <div className="ml-auto flex items-center gap-2">
          <Label htmlFor="audit-per-page" className="text-xs text-ink-faint">
            Lignes / page
          </Label>
          <Select value={String(perPage)} onValueChange={changePerPage}>
            <SelectTrigger
              id="audit-per-page"
              aria-label="Nombre de lignes par page"
              className="w-20 bg-paper"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PER_PAGE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={exportCsv}
            title="Export limité à 5 000 lignes"
            aria-label="Exporter le journal filtré au format CSV (5 000 lignes maximum)"
          >
            <Download aria-hidden />
            Exporter en CSV
          </Button>
        </div>
      </div>

      {/* ── Erreur sur données déjà affichées (bandeau d'avertissement) ── */}
      {loadError !== null && rows.length > 0 ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded-[2px] border border-danger bg-red-wash px-3 py-2 text-sm text-ink"
        >
          <AlertTriangle className="size-4 shrink-0 text-brand-red" aria-hidden />
          <span>Rafraîchissement impossible : {loadError}</span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => void load()}>
            Réessayer
          </Button>
        </div>
      ) : null}

      {/* ── Erreur bloquante (aucune donnée affichée) ───────────────── */}
      {loadError !== null && rows.length === 0 ? (
        <div role="alert" className="rounded-[2px] border border-danger bg-red-wash p-8 text-center">
          <AlertTriangle className="mx-auto size-6 text-brand-red" aria-hidden />
          <p className="mt-3 font-serif text-lg font-semibold text-ink">
            Chargement impossible
          </p>
          <p className="mt-1 text-sm text-ink-soft">{loadError}</p>
          <Button className="mt-5" onClick={() => void load()}>
            Réessayer
          </Button>
        </div>
      ) : (
        <div className="rounded-[2px] border border-rule bg-paper">
          <div
            role="region"
            aria-label="Entrées du journal d'audit"
            aria-busy={loading}
            className="max-h-[70vh] overflow-y-auto"
            style={{ scrollbarWidth: "thin" }}
          >
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-paper-alt">
                <TableRow className="border-b border-rule hover:bg-paper-alt">
                  <TableHead className="w-44 text-ink-soft">Date et heure</TableHead>
                  <TableHead className="w-52 text-ink-soft">Action</TableHead>
                  <TableHead className="text-ink-soft">Ressource</TableHead>
                  <TableHead className="text-ink-soft">Utilisateur</TableHead>
                  <TableHead className="w-36 text-ink-soft">Empreinte IP</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Consulter le diff</span>
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
                            <ScrollText className="mx-auto size-6 text-ink-faint" aria-hidden />
                            <p className="mt-3 text-sm text-ink-soft">
                              Aucune entrée d&apos;audit pour ces filtres.
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-3"
                              onClick={resetFilters}
                            >
                              <RotateCcw aria-hidden />
                              Réinitialiser les filtres
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    : (
                        rows.map((row) => (
                          <TableRow
                            key={row.id}
                            onClick={() => openEntry(row)}
                            className="cursor-pointer border-b border-rule"
                          >
                            <TableCell className="py-2.5 text-xs text-ink-soft tabular-nums">
                              {formatDateTime(row.created_at)}
                            </TableCell>
                            <TableCell className="py-2.5">
                              <Badge className={actionBadgeClass(row.action)}>
                                {row.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2.5 text-ink-soft">
                              {resourceLabel(row.resource_type)}
                              {row.resource_id ? (
                                <span
                                  className="ml-2 font-mono text-xs text-ink-faint"
                                  title={row.resource_id}
                                >
                                  {shortId(row.resource_id)}
                                </span>
                              ) : null}
                            </TableCell>
                            <TableCell className="py-2.5 text-ink-soft">
                              {row.user?.display_name ?? "Compte supprimé"}
                            </TableCell>
                            <TableCell className="py-2.5 font-mono text-xs text-ink-faint">
                              {row.ip_hash ? shortId(row.ip_hash) : "—"}
                            </TableCell>
                            <TableCell className="py-2.5 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEntry(row);
                                }}
                                aria-label={`Consulter le diff avant/après de l'entrée n°${row.id}`}
                                title="Voir le diff avant / après"
                              >
                                <Eye aria-hidden />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────────────── */}
      {pages > 1 ? (
        <Pagination aria-label="Pagination du journal d'audit">
          <PaginationContent>
            <PaginationItem>
              <Button
                variant="outline"
                size="sm"
                disabled={meta.page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Page précédente"
              >
                <ChevronLeft aria-hidden />
                Précédent
              </Button>
            </PaginationItem>

            {pageList(meta.page, pages).map((p, index) =>
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
                    className={`min-w-9 ${p === meta.page ? "border-brand-red text-brand-red" : ""}`}
                    disabled={loading}
                    onClick={() => setPage(p)}
                    aria-label={`Aller à la page ${p}`}
                    aria-current={p === meta.page ? "page" : undefined}
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
                disabled={meta.page >= pages || loading}
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

      {/* ── Dialogue : diff avant / après ───────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto bg-paper sm:max-w-4xl">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2 font-serif text-lg text-ink">
                  <span>Entrée d&apos;audit n°{selected.id}</span>
                  <Badge className={actionBadgeClass(selected.action)}>
                    {selected.action}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-sm text-ink-soft">
                  {formatDateTime(selected.created_at)} ·{" "}
                  {selected.user
                    ? `${selected.user.display_name} (${selected.user.email})`
                    : "Compte supprimé"}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 gap-4 rounded-[2px] border border-rule bg-paper-alt p-4 sm:grid-cols-2">
                <div>
                  <p className="kicker text-ink-faint">Ressource</p>
                  <p className="mt-1 text-sm text-ink">
                    {resourceLabel(selected.resource_type)}
                    {selected.resource_id ? (
                      <span className="ml-2 break-all font-mono text-xs text-ink-faint">
                        {selected.resource_id}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div>
                  <p className="kicker text-ink-faint">Utilisateur</p>
                  <p className="mt-1 text-sm text-ink">
                    {selected.user
                      ? `${selected.user.display_name} — ${selected.user.email}`
                      : "Compte supprimé"}
                  </p>
                </div>
                <div>
                  <p className="kicker text-ink-faint">Empreinte IP</p>
                  <p className="mt-1 break-all font-mono text-xs text-ink-soft">
                    {selected.ip_hash ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="kicker text-ink-faint">Agent utilisateur</p>
                  <p className="mt-1 break-all font-mono text-xs text-ink-soft">
                    {selected.user_agent ?? "—"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <p className="kicker text-ink-faint">Avant</p>
                  {beforeText === null ? (
                    <p className="mt-2 rounded-[2px] border border-rule bg-paper-alt p-3 text-xs italic text-ink-faint">
                      Aucune donnée (état initial).
                    </p>
                  ) : (
                    <pre
                      className="mt-2 max-h-96 overflow-y-auto rounded-[2px] border border-rule bg-red-50 p-3 font-mono text-xs leading-5 text-red-900 dark:bg-red-950/30 dark:text-red-100"
                      style={{ scrollbarWidth: "thin" }}
                    >
                      {beforeText}
                    </pre>
                  )}
                </div>
                <div>
                  <p className="kicker text-ink-faint">Après</p>
                  {afterText === null ? (
                    <p className="mt-2 rounded-[2px] border border-rule bg-paper-alt p-3 text-xs italic text-ink-faint">
                      Aucune donnée.
                    </p>
                  ) : (
                    <pre
                      className="mt-2 max-h-96 overflow-y-auto rounded-[2px] border border-rule bg-emerald-50 p-3 font-mono text-xs leading-5 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"
                      style={{ scrollbarWidth: "thin" }}
                    >
                      {afterText}
                    </pre>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
