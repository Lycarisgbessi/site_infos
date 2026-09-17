"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Ban,
  CheckCheck,
  CheckCircle2,
  Inbox as InboxIcon,
  Loader2,
  MailOpen,
  MessageSquare,
  Plus,
  RefreshCw,
  Reply,
  Search,
  ShieldBan,
  ShieldX,
  Trash2,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";

import { Toaster as SonnerToaster } from "@/components/ui/sonner";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, errorMessage } from "@/lib/api/client";

/**
 * Écran « Modération — Boîte unifiée » (§11.2) :
 * - onglet Commentaires : file d'attente, filtre par statut, recherche,
 *   sélection multiple + actions groupées, réponse officielle identifiée
 *   (badge « Équipe »), bannissement d'auteur ;
 * - onglet Boîte de réception : contacts, alertes info, droits de réponse,
 *   publicité, rectificatifs, recrutements — filtres type/statut, lecture,
 *   clôture, indésirable, assignation ;
 * - onglet Mots bloqués : filtrage automatique haine/spam (réglage
 *   editorial.blocked_words) ;
 * - onglet Bannis : e-mails bannis (réglage moderation.banned_emails).
 *
 * Les toasts utilisent Sonner ; le composant monte son propre Toaster car
 * la racine n'en expose pas (pattern SecurityClient).
 */

// ─── Types ─────────────────────────────────────────────────────────────

type CommentStatusValue = "pending" | "approved" | "rejected" | "spam";
type CommentAction =
  | "approve"
  | "reject"
  | "spam"
  | "delete"
  | "reply"
  | "ban";
type InboxAction = "read" | "assigned" | "closed" | "spam" | "delete";
type InboxKind =
  | "contact"
  | "tip"
  | "right_of_reply"
  | "advertising"
  | "correction"
  | "job";

interface CommentItem {
  id: string;
  parent_id: string | null;
  author_name: string;
  author_email: string | null;
  body: string;
  status: CommentStatusValue;
  is_staff: boolean;
  moderated_at: string | null;
  created_at: string;
  article: { title: string; slug: string; category_id: string };
  moderatedBy: { display_name: string } | null;
}

interface InboxItem {
  id: string;
  kind: InboxKind;
  department: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  subject: string | null;
  body: string;
  is_anonymous: boolean;
  status: string;
  assigned_to: string | null;
  created_at: string;
  assignedTo: { display_name: string } | null;
}

interface UserOption {
  id: string;
  display_name: string;
  slug: string;
}

// ─── Libellés et styles ────────────────────────────────────────────────

const PER_PAGE = 20;

const COMMENT_STATUS_LABELS: Record<CommentStatusValue, string> = {
  pending: "En attente",
  approved: "Approuvé",
  rejected: "Rejeté",
  spam: "Indésirable",
};

const COMMENT_STATUS_CLASSES: Record<CommentStatusValue, string> = {
  pending: "border-warning/40 bg-warning/10 text-warning",
  approved: "border-success/40 bg-success/10 text-success",
  rejected: "border-danger/40 bg-danger/10 text-danger",
  spam: "border-danger/40 bg-danger/10 text-danger",
};

const INBOX_STATUS_LABELS: Record<string, string> = {
  new: "Nouveau",
  read: "Lu",
  assigned: "Assigné",
  closed: "Clôturé",
  spam: "Indésirable",
};

const INBOX_STATUS_CLASSES: Record<string, string> = {
  new: "border-warning/40 bg-warning/10 text-warning",
  read: "border-rule bg-paper-alt text-ink-soft",
  assigned: "border-ink/25 bg-ink/5 text-ink",
  closed: "border-rule bg-transparent text-ink-faint",
  spam: "border-danger/40 bg-danger/10 text-danger",
};

const INBOX_KIND_LABELS: Record<InboxKind, string> = {
  contact: "Contact",
  tip: "Alerte info",
  right_of_reply: "Droit de réponse",
  advertising: "Publicité",
  correction: "Rectificatif",
  job: "Recrutement",
};

const DATETIME_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(iso: string): string {
  return DATETIME_FORMAT.format(new Date(iso));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Composants d'appoint ──────────────────────────────────────────────

function StatusPill({ className, label }: { className: string; label: string }) {
  return (
    <Badge variant="outline" className={`rounded-full px-2 py-0 text-[11px] font-semibold ${className}`}>
      {label}
    </Badge>
  );
}

function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[2px] border border-dashed border-rule bg-paper-alt/60 px-6 py-12 text-center">
      <Icon className="mx-auto size-8 text-ink-faint" aria-hidden />
      <p className="mt-3 font-serif text-base font-semibold text-ink">{title}</p>
      {hint ? (
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-faint">{hint}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <span className="sr-only">Chargement de la file…</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-[2px] border border-rule bg-paper p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-4" />
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-[2px] border border-danger bg-red-wash p-8 text-center"
    >
      <AlertTriangle className="mx-auto size-6 text-brand-red" aria-hidden />
      <p className="mt-3 font-serif text-lg font-semibold text-ink">
        Chargement impossible
      </p>
      <p className="mt-1 text-sm text-ink-soft">{message}</p>
      <Button className="mt-5" onClick={onRetry}>
        <RefreshCw aria-hidden />
        Réessayer
      </Button>
    </div>
  );
}

function Pager({
  page,
  total,
  disabled,
  onPage,
}: {
  page: number;
  total: number;
  disabled: boolean;
  onPage: (next: number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-rule pt-3">
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || page <= 1}
        onClick={() => onPage(Math.max(1, page - 1))}
      >
        Précédent
      </Button>
      <span className="text-xs text-ink-faint" aria-live="polite">
        Page {page} · {total} élément{total > 1 ? "s" : ""}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || page * PER_PAGE >= total}
        onClick={() => onPage(page + 1)}
      >
        Suivant
      </Button>
    </div>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="relative w-full sm:w-72">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-9 bg-paper pl-8"
      />
    </div>
  );
}

// ─── Onglet Commentaires ───────────────────────────────────────────────

function CommentsTab() {
  const [items, setItems] = useState<CommentItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<CommentStatusValue | "all">("pending");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const [replyTarget, setReplyTarget] = useState<CommentItem | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyApprove, setReplyApprove] = useState(true);

  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [banTargets, setBanTargets] = useState<CommentItem[] | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        tab: "comments",
        status,
        page: String(page),
        per_page: String(PER_PAGE),
      });
      if (debouncedQ !== "") params.set("q", debouncedQ);
      const { data, meta } = await apiFetch<CommentItem[]>(
        `/api/admin/moderation?${params.toString()}`
      );
      setItems(data);
      setTotal(typeof meta?.total === "number" ? meta.total : data.length);
      setSelected(new Set());
    } catch (e) {
      setError(errorMessage(e));
      setItems(null);
    } finally {
      setLoading(false);
    }
  }, [status, page, debouncedQ]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = useCallback(
    async (action: CommentAction, ids: string[], officialReply?: string) => {
      if (ids.length === 0) return;
      setBusy(true);
      try {
        const { data } = await apiFetch<{ updated: number }>(
          "/api/admin/moderation/actions",
          {
            method: "POST",
            json: {
              target: "comment",
              ids,
              action,
              ...(officialReply !== undefined ? { official_reply: officialReply } : {}),
            },
          }
        );
        const n = data.updated;
        const messages: Record<CommentAction, string> = {
          approve: `${n} commentaire${n > 1 ? "s" : ""} approuvé${n > 1 ? "s" : ""}.`,
          reject: `${n} commentaire${n > 1 ? "s" : ""} rejeté${n > 1 ? "s" : ""}.`,
          spam: `${n} commentaire${n > 1 ? "s" : ""} signalé${n > 1 ? "s" : ""} comme indésirable.`,
          delete: `${n} commentaire${n > 1 ? "s" : ""} supprimé${n > 1 ? "s" : ""}.`,
          reply: `Réponse officielle publiée (${n}).`,
          ban: `Auteur banni — ${n} commentaire${n > 1 ? "s" : ""} rejeté${n > 1 ? "s" : ""} et e-mail ajouté à la liste.`,
        };
        toast.success(messages[action]);
        await load();
      } catch (e) {
        toast.error("Action impossible", { description: errorMessage(e) });
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  const toggle = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked && items) for (const c of items) next.add(c.id);
      if (!checked && items) for (const c of items) next.delete(c.id);
      return next;
    });
  };

  const openReply = (c: CommentItem) => {
    setReplyTarget(c);
    setReplyText("");
    setReplyApprove(c.status === "pending");
  };

  const submitReply = async () => {
    const text = replyText.trim();
    if (!replyTarget || text === "") return;
    const action =
      replyApprove && replyTarget.status === "pending" ? "approve" : "reply";
    const target = replyTarget;
    setReplyTarget(null);
    await runAction(action, [target.id], text);
  };

  const confirmBan = async () => {
    if (!banTargets) return;
    const ids = banTargets.map((c) => c.id);
    setBanTargets(null);
    await runAction("ban", ids);
  };

  const confirmDelete = async () => {
    if (!deleteIds) return;
    const ids = deleteIds;
    setDeleteIds(null);
    await runAction("delete", ids);
  };

  const allPageSelected =
    items !== null && items.length > 0 && items.every((c) => selected.has(c.id));
  const hasFilters = status !== "all" || debouncedQ !== "";
  const banEmails = useMemo(() => {
    if (!banTargets) return { emails: [] as string[], withoutEmail: 0 };
    const emails = new Set<string>();
    let withoutEmail = 0;
    for (const c of banTargets) {
      if (c.author_email) emails.add(c.author_email.trim().toLowerCase());
      else withoutEmail += 1;
    }
    return { emails: [...emails], withoutEmail };
  }, [banTargets]);

  return (
    <div className="space-y-4">
      {/* Barre de filtres */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as CommentStatusValue | "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-full bg-paper sm:w-48" aria-label="Filtrer par statut">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="approved">Approuvés</SelectItem>
            <SelectItem value="rejected">Rejetés</SelectItem>
            <SelectItem value="spam">Indésirables</SelectItem>
            <SelectItem value="all">Tous les statuts</SelectItem>
          </SelectContent>
        </Select>
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Rechercher auteur, texte, article…"
          label="Rechercher dans les commentaires"
        />
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto size-9 shrink-0"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Rafraîchir la file"
          title="Rafraîchir"
        >
          <RefreshCw className={loading ? "animate-spin" : undefined} aria-hidden />
        </Button>
      </div>

      {/* Barre d'actions groupées */}
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[2px] border border-rule bg-paper-alt px-3 py-2">
          <span className="text-sm font-semibold text-ink" aria-live="polite">
            {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="bg-success text-white hover:bg-success/90"
              disabled={busy}
              onClick={() => void runAction("approve", [...selected])}
            >
              <CheckCheck aria-hidden />
              Approuver
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-danger/40 text-danger hover:bg-red-wash"
              disabled={busy}
              onClick={() => void runAction("reject", [...selected])}
            >
              <ShieldX aria-hidden />
              Rejeter
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-danger hover:bg-red-wash"
              disabled={busy}
              onClick={() => void runAction("spam", [...selected])}
            >
              <Ban aria-hidden />
              Indésirable
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-danger hover:bg-red-wash"
              disabled={busy}
              onClick={() => setDeleteIds([...selected])}
            >
              <Trash2 aria-hidden />
              Supprimer
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setSelected(new Set())}
            >
              Désélectionner
            </Button>
          </div>
        </div>
      ) : null}

      {/* File des commentaires */}
      {error !== null ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : loading && items === null ? (
        <ListSkeleton />
      ) : items !== null && items.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={Search}
            title="Aucun commentaire ne correspond"
            hint="Ajustez le statut ou la recherche pour élargir la file."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQ("");
                  setDebouncedQ("");
                  setStatus("pending");
                  setPage(1);
                }}
              >
                Réinitialiser les filtres
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={CheckCircle2}
            title="Aucun commentaire en attente"
            hint="La file est à jour. Les contributions des lecteurs arriveront ici dès l'ouverture des commentaires sur le site public."
          />
        )
      ) : items === null ? (
        <ListSkeleton />
      ) : (
        <div
          className="max-h-[70vh] space-y-3 overflow-y-auto pr-1"
          style={{ scrollbarWidth: "thin" }}
        >
          {/* Tout sélectionner */}
          <div className="flex items-center gap-3 rounded-[2px] border border-rule bg-paper px-3 py-2">
            <Checkbox
              id="comments-select-all"
              checked={allPageSelected}
              onCheckedChange={(v) => toggleAll(v === true)}
              aria-label="Tout sélectionner sur cette page"
            />
            <label
              htmlFor="comments-select-all"
              className="cursor-pointer text-xs font-medium text-ink-soft"
            >
              Tout sélectionner sur cette page
            </label>
          </div>

          {items.map((c) => (
            <article
              key={c.id}
              className="rounded-[2px] border border-rule bg-paper p-4"
            >
              <div className="flex items-start gap-3">
                <div className="pt-1">
                  <Checkbox
                    checked={selected.has(c.id)}
                    onCheckedChange={(v) => toggle(c.id, v === true)}
                    aria-label={`Sélectionner le commentaire de ${c.author_name}`}
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold text-ink">
                      {c.author_name}
                    </span>
                    {c.author_email ? (
                      <span className="text-xs text-ink-faint">{c.author_email}</span>
                    ) : null}
                    {c.is_staff ? (
                      <Badge className="rounded-full bg-brand-red px-2 py-0 text-[11px] font-semibold text-white">
                        Équipe
                      </Badge>
                    ) : null}
                    {c.parent_id ? (
                      <Badge
                        variant="outline"
                        className="rounded-full px-2 py-0 text-[11px] text-ink-soft"
                      >
                        Réponse
                      </Badge>
                    ) : null}
                    <StatusPill
                      className={COMMENT_STATUS_CLASSES[c.status]}
                      label={COMMENT_STATUS_LABELS[c.status]}
                    />
                    <span className="ml-auto shrink-0 text-xs text-ink-faint">
                      {formatDateTime(c.created_at)}
                    </span>
                  </div>

                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
                    {c.body}
                  </p>

                  <p className="text-xs text-ink-faint">
                    Article :{" "}
                    <a
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      title="Le lien public de l'article sera actif avec le front-office (Phase 4)"
                      className="font-medium text-brand-red underline decoration-brand-red/40 underline-offset-2 hover:decoration-brand-red"
                    >
                      {c.article.title}
                    </a>
                  </p>

                  {c.moderatedBy || c.moderated_at ? (
                    <p className="text-xs italic text-ink-faint">
                      Décision : {c.moderatedBy?.display_name ?? "—"}
                      {c.moderated_at ? ` · ${formatDateTime(c.moderated_at)}` : ""}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {c.status !== "approved" ? (
                      <Button
                        size="sm"
                        className="h-8 bg-success text-white hover:bg-success/90"
                        disabled={busy}
                        onClick={() => void runAction("approve", [c.id])}
                      >
                        <CheckCircle2 aria-hidden />
                        Approuver
                      </Button>
                    ) : null}
                    {c.status !== "rejected" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-danger/40 text-danger hover:bg-red-wash"
                        disabled={busy}
                        onClick={() => void runAction("reject", [c.id])}
                      >
                        <ShieldX aria-hidden />
                        Rejeter
                      </Button>
                    ) : null}
                    {c.status !== "spam" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-danger hover:bg-red-wash"
                        disabled={busy}
                        onClick={() => void runAction("spam", [c.id])}
                      >
                        <Ban aria-hidden />
                        Indésirable
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      disabled={busy}
                      onClick={() => openReply(c)}
                    >
                      <Reply aria-hidden />
                      Répondre officiellement
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-danger hover:bg-red-wash"
                      disabled={busy || !c.author_email}
                      title={
                        c.author_email
                          ? "Bannir l'auteur (e-mail ajouté à la liste des bannis, commentaire rejeté)"
                          : "Bannissement impossible : ce commentaire n'a pas d'e-mail d'auteur"
                      }
                      onClick={() => setBanTargets([c])}
                    >
                      <ShieldBan aria-hidden />
                      Bannir l&apos;auteur
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto h-8 text-danger hover:bg-red-wash"
                      disabled={busy}
                      aria-label={`Supprimer le commentaire de ${c.author_name}`}
                      onClick={() => setDeleteIds([c.id])}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {items !== null && items.length > 0 ? (
        <Pager page={page} total={total} disabled={loading} onPage={setPage} />
      ) : null}

      {/* Dialogue — réponse officielle */}
      <Dialog
        open={replyTarget !== null}
        onOpenChange={(open) => {
          if (!open) setReplyTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Réponse officielle</DialogTitle>
            <DialogDescription>
              {replyTarget
                ? `Votre réponse sera publiée sous le commentaire de ${replyTarget.author_name} avec le badge « Équipe » — identifiée visuellement comme une prise de parole officielle de la rédaction.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {replyTarget ? (
            <div className="space-y-3">
              <blockquote className="max-h-24 overflow-y-auto border-l-2 border-rule pl-3 text-sm italic text-ink-soft" style={{ scrollbarWidth: "thin" }}>
                {replyTarget.body}
              </blockquote>
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                maxLength={2000}
                rows={5}
                aria-label="Texte de la réponse officielle"
                placeholder="Réponse officielle de la rédaction…"
                className="bg-paper"
              />
              <div className="flex items-center justify-between gap-4 text-xs text-ink-faint">
                <label className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={replyApprove}
                    onCheckedChange={(v) => setReplyApprove(v === true)}
                    aria-label="Approuver aussi le commentaire"
                  />
                  Approuver aussi le commentaire
                </label>
                <span>{replyText.length}/2000</span>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyTarget(null)}>
              Annuler
            </Button>
            <Button
              onClick={() => void submitReply()}
              disabled={busy || replyText.trim().length === 0}
            >
              {busy ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Reply aria-hidden />
              )}
              Publier la réponse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue — confirmation de suppression */}
      <AlertDialog
        open={deleteIds !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteIds(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Supprimer {deleteIds?.length ?? 0} commentaire
              {(deleteIds?.length ?? 0) > 1 ? "s" : ""} ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Suppression définitive, y compris les réponses associées.
              L&apos;opération est enregistrée au journal d&apos;audit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              onClick={() => void confirmDelete()}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialogue — confirmation de bannissement */}
      <AlertDialog
        open={banTargets !== null}
        onOpenChange={(open) => {
          if (!open) setBanTargets(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bannir cet auteur ?</AlertDialogTitle>
            <AlertDialogDescription>
              {banEmails.emails.length > 0 ? (
                <>
                  L&apos;adresse{" "}
                  <span className="font-mono text-ink">
                    {banEmails.emails.join(", ")}
                  </span>{" "}
                  sera ajoutée à la liste des e-mails bannis et{" "}
                  {banTargets?.length ?? 0} commentaire
                  {(banTargets?.length ?? 0) > 1 ? "s" : ""} sera rejeté.
                </>
              ) : (
                "Ce commentaire n'a pas d'e-mail d'auteur : le bannissement est impossible."
              )}
              {banEmails.withoutEmail > 0
                ? ` ${banEmails.withoutEmail} commentaire(s) de la sélection sans e-mail ne permettront pas de bannir.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              disabled={banEmails.emails.length === 0}
              onClick={() => void confirmBan()}
            >
              Bannir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Onglet Boîte de réception ─────────────────────────────────────────

function InboxTab({
  currentUserId,
  currentUserName,
}: {
  currentUserId: string;
  currentUserName: string;
}) {
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState<InboxKind | "all">("all");
  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    void apiFetch<UserOption[]>("/api/admin/users/options")
      .then(({ data }) => setUsers(data))
      .catch(() => setUsers([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        tab: "inbox",
        kind,
        status,
        page: String(page),
        per_page: String(PER_PAGE),
      });
      if (debouncedQ !== "") params.set("q", debouncedQ);
      const { data, meta } = await apiFetch<InboxItem[]>(
        `/api/admin/moderation?${params.toString()}`
      );
      setItems(data);
      setTotal(typeof meta?.total === "number" ? meta.total : data.length);
      setSelected(new Set());
    } catch (e) {
      setError(errorMessage(e));
      setItems(null);
    } finally {
      setLoading(false);
    }
  }, [kind, status, page, debouncedQ]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = useCallback(
    async (
      action: InboxAction,
      ids: string[],
      opts?: { assigned_to?: string | null }
    ) => {
      if (ids.length === 0) return;
      setBusy(true);
      try {
        const { data } = await apiFetch<{ updated: number }>(
          "/api/admin/moderation/actions",
          {
            method: "POST",
            json: {
              target: "inbox",
              ids,
              action,
              ...(opts?.assigned_to !== undefined
                ? { assigned_to: opts.assigned_to }
                : {}),
            },
          }
        );
        const n = data.updated;
        const messages: Record<InboxAction, string> = {
          read: `${n} message${n > 1 ? "s" : ""} marqué${n > 1 ? "s" : ""} comme lu${n > 1 ? "s" : ""}.`,
          assigned:
            opts?.assigned_to == null
              ? "Assignation retirée."
              : `Message${n > 1 ? "s" : ""} assigné${n > 1 ? "s" : ""}.`,
          closed: `${n} message${n > 1 ? "s" : ""} clôturé${n > 1 ? "s" : ""}.`,
          spam: `${n} message${n > 1 ? "s" : ""} signalé${n > 1 ? "s" : ""} comme indésirable.`,
          delete: `${n} message${n > 1 ? "s" : ""} supprimé${n > 1 ? "s" : ""}.`,
        };
        toast.success(messages[action]);
        await load();
      } catch (e) {
        toast.error("Action impossible", { description: errorMessage(e) });
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  const toggle = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked && items) for (const m of items) next.add(m.id);
      if (!checked && items) for (const m of items) next.delete(m.id);
      return next;
    });
  };

  const confirmDelete = async () => {
    if (!deleteIds) return;
    const ids = deleteIds;
    setDeleteIds(null);
    await runAction("delete", ids);
  };

  const allPageSelected =
    items !== null && items.length > 0 && items.every((m) => selected.has(m.id));
  const hasFilters = kind !== "all" || status !== "all" || debouncedQ !== "";

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          value={kind}
          onValueChange={(v) => {
            setKind(v as InboxKind | "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-full bg-paper sm:w-48" aria-label="Filtrer par type de message">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {(Object.keys(INBOX_KIND_LABELS) as InboxKind[]).map((k) => (
              <SelectItem key={k} value={k}>
                {INBOX_KIND_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-full bg-paper sm:w-44" aria-label="Filtrer par statut">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="new">Nouveaux</SelectItem>
            <SelectItem value="read">Lus</SelectItem>
            <SelectItem value="assigned">Assignés</SelectItem>
            <SelectItem value="closed">Clôturés</SelectItem>
            <SelectItem value="spam">Indésirables</SelectItem>
          </SelectContent>
        </Select>
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Rechercher expéditeur, objet, texte…"
          label="Rechercher dans la boîte de réception"
        />
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto size-9 shrink-0"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Rafraîchir la boîte de réception"
          title="Rafraîchir"
        >
          <RefreshCw className={loading ? "animate-spin" : undefined} aria-hidden />
        </Button>
      </div>

      {/* Actions groupées */}
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[2px] border border-rule bg-paper-alt px-3 py-2">
          <span className="text-sm font-semibold text-ink" aria-live="polite">
            {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void runAction("read", [...selected])}
            >
              <MailOpen aria-hidden />
              Marquer lu
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void runAction("closed", [...selected])}
            >
              <CheckCheck aria-hidden />
              Clôturer
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-danger hover:bg-red-wash"
              disabled={busy}
              onClick={() => void runAction("spam", [...selected])}
            >
              <Ban aria-hidden />
              Indésirable
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-danger hover:bg-red-wash"
              disabled={busy}
              onClick={() => setDeleteIds([...selected])}
            >
              <Trash2 aria-hidden />
              Supprimer
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setSelected(new Set())}
            >
              Désélectionner
            </Button>
          </div>
        </div>
      ) : null}

      {/* Messages */}
      {error !== null ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : loading && items === null ? (
        <ListSkeleton />
      ) : items !== null && items.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={Search}
            title="Aucun message ne correspond"
            hint="Ajustez le type, le statut ou la recherche."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setKind("all");
                  setStatus("all");
                  setQ("");
                  setDebouncedQ("");
                  setPage(1);
                }}
              >
                Réinitialiser les filtres
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={InboxIcon}
            title="Boîte de réception vide"
            hint="Les contacts, alertes info, droits de réponse et autres messages du formulaire « Nous écrire » arriveront ici."
          />
        )
      ) : items === null ? (
        <ListSkeleton />
      ) : (
        <div
          className="max-h-[70vh] space-y-3 overflow-y-auto pr-1"
          style={{ scrollbarWidth: "thin" }}
        >
          <div className="flex items-center gap-3 rounded-[2px] border border-rule bg-paper px-3 py-2">
            <Checkbox
              id="inbox-select-all"
              checked={allPageSelected}
              onCheckedChange={(v) => toggleAll(v === true)}
              aria-label="Tout sélectionner sur cette page"
            />
            <label
              htmlFor="inbox-select-all"
              className="cursor-pointer text-xs font-medium text-ink-soft"
            >
              Tout sélectionner sur cette page
            </label>
          </div>

          {items.map((m) => {
            const statusLabel = INBOX_STATUS_LABELS[m.status] ?? m.status;
            const statusClass = INBOX_STATUS_CLASSES[m.status] ?? "border-rule text-ink-soft";
            return (
              <article
                key={m.id}
                className="rounded-[2px] border border-rule bg-paper p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="pt-1">
                    <Checkbox
                      checked={selected.has(m.id)}
                      onCheckedChange={(v) => toggle(m.id, v === true)}
                      aria-label={`Sélectionner le message « ${m.subject ?? "sans objet"} »`}
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <StatusPill
                        className="border-rule bg-paper-alt text-ink-soft"
                        label={INBOX_KIND_LABELS[m.kind] ?? m.kind}
                      />
                      {m.department ? (
                        <span className="text-xs text-ink-faint">
                          Rubrique : {m.department}
                        </span>
                      ) : null}
                      <StatusPill className={statusClass} label={statusLabel} />
                      <span className="ml-auto shrink-0 text-xs text-ink-faint">
                        {formatDateTime(m.created_at)}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-ink">
                      {m.subject && m.subject.trim() !== ""
                        ? m.subject
                        : "(sans objet)"}
                    </p>

                    <p className="text-xs text-ink-soft">
                      {m.is_anonymous ? (
                        <span className="font-medium">Anonyme</span>
                      ) : (
                        <>
                          <span className="font-medium text-ink">
                            {m.name ?? "Expéditeur inconnu"}
                          </span>
                          {m.email ? ` · ${m.email}` : ""}
                          {m.phone ? ` · ${m.phone}` : ""}
                        </>
                      )}
                    </p>

                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
                      {m.body}
                    </p>

                    {m.assignedTo ? (
                      <p className="text-xs italic text-ink-faint">
                        Assigné à {m.assignedTo.display_name}
                      </p>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {m.status === "new" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          disabled={busy}
                          onClick={() => void runAction("read", [m.id])}
                        >
                          <MailOpen aria-hidden />
                          Marquer lu
                        </Button>
                      ) : null}
                      {m.status !== "closed" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          disabled={busy}
                          onClick={() => void runAction("closed", [m.id])}
                        >
                          <CheckCheck aria-hidden />
                          Clôturer
                        </Button>
                      ) : null}
                      {m.status !== "spam" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-danger hover:bg-red-wash"
                          disabled={busy}
                          onClick={() => void runAction("spam", [m.id])}
                        >
                          <Ban aria-hidden />
                          Indésirable
                        </Button>
                      ) : null}
                      <div className="flex items-center gap-1.5">
                        <UserPlus className="size-3.5 text-ink-faint" aria-hidden />
                        <Select
                          value={m.assigned_to ?? ""}
                          onValueChange={(v) => {
                            if (v === "__unassign__") {
                              void runAction("assigned", [m.id], { assigned_to: null });
                            } else {
                              void runAction("assigned", [m.id], { assigned_to: v });
                            }
                          }}
                        >
                          <SelectTrigger
                            className="h-8 w-44 bg-paper text-xs"
                            aria-label={`Assigner le message « ${m.subject ?? "sans objet"} »`}
                          >
                            <SelectValue placeholder="Assigner à…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={currentUserId}>
                              {currentUserName} (moi)
                            </SelectItem>
                            {users
                              .filter((u) => u.id !== currentUserId)
                              .map((u) => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.display_name}
                                </SelectItem>
                              ))}
                            {m.assigned_to ? (
                              <SelectItem value="__unassign__">
                                Retirer l&apos;assignation
                              </SelectItem>
                            ) : null}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto h-8 text-danger hover:bg-red-wash"
                        disabled={busy}
                        aria-label={`Supprimer le message « ${m.subject ?? "sans objet"} »`}
                        onClick={() => setDeleteIds([m.id])}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {items !== null && items.length > 0 ? (
        <Pager page={page} total={total} disabled={loading} onPage={setPage} />
      ) : null}

      {/* Dialogue — confirmation de suppression */}
      <AlertDialog
        open={deleteIds !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteIds(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Supprimer {deleteIds?.length ?? 0} message
              {(deleteIds?.length ?? 0) > 1 ? "s" : ""} ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Suppression définitive de la boîte de réception. L&apos;opération
              est enregistrée au journal d&apos;audit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              onClick={() => void confirmDelete()}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Éditeur de liste de chaînes (mots bloqués / bannis) ───────────────

interface SettingRow {
  key: string;
  value: string;
  group_key: string;
  label: string | null;
  updated_at: string;
}

function StringListEditor({
  settingKey,
  groupKey,
  label,
  singular,
  addPlaceholder,
  help,
  emptyTitle,
  emptyHint,
  successToast,
  normalize,
  validate,
  countNoun,
}: {
  settingKey: string;
  groupKey: string | null;
  label: string;
  singular: string;
  addPlaceholder: string;
  help: string;
  emptyTitle: string;
  emptyHint: string;
  successToast: string;
  normalize: (v: string) => string;
  validate: (v: string) => string | null;
  countNoun: (n: number) => string;
}) {
  const [initial, setInitial] = useState<string[] | null>(null);
  const [list, setList] = useState<string[]>([]);
  const [newItem, setNewItem] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiFetch<SettingRow[]>("/api/admin/settings");
      const row = data.find((r) => r.key === settingKey);
      let parsed: string[] = [];
      if (row) {
        try {
          const value: unknown = JSON.parse(row.value);
          if (Array.isArray(value)) parsed = value.map((v) => String(v));
        } catch {
          parsed = [];
        }
      }
      setInitial(parsed);
      setList(parsed);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [settingKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty =
    !loading &&
    initial !== null &&
    (list.length !== initial.length ||
      list.some((v, i) => v !== initial[i]));

  const add = () => {
    const value = normalize(newItem);
    if (value === "") return;
    const invalid = validate(value);
    if (invalid !== null) {
      toast.error(invalid);
      return;
    }
    if (list.some((v) => v.toLowerCase() === value.toLowerCase())) {
      toast.error(`« ${value} » figure déjà dans la liste.`);
      return;
    }
    setList((prev) => [...prev, value]);
    setNewItem("");
  };

  const remove = (value: string) => {
    setList((prev) => prev.filter((v) => v !== value));
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/admin/settings", {
        method: "PUT",
        json: {
          settings: [
            {
              key: settingKey,
              value: JSON.stringify(list),
              ...(groupKey !== null ? { group_key: groupKey } : {}),
              label,
            },
          ],
        },
      });
      setInitial(list);
      toast.success(successToast, {
        description: "Prise d'effet immédiate sur le site.",
      });
    } catch (e) {
      toast.error("Enregistrement impossible", { description: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <span className="sr-only">Chargement de la liste…</span>
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error !== null) {
    return (
      <ErrorState
        message={error}
        onRetry={() => void load()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-faint">{help}</p>

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder={addPlaceholder}
          aria-label={addPlaceholder}
          className="h-9 bg-paper"
        />
        <Button type="submit" size="sm" className="h-9 shrink-0">
          <Plus aria-hidden />
          Ajouter
        </Button>
      </form>

      {list.length === 0 ? (
        <EmptyState icon={MessageSquare} title={emptyTitle} hint={emptyHint} />
      ) : (
        <div
          className="max-h-[50vh] overflow-y-auto rounded-[2px] border border-rule bg-paper p-4"
          style={{ scrollbarWidth: "thin" }}
        >
          <div className="flex flex-wrap gap-2">
            {list.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-paper-alt px-3 py-1 text-xs font-medium text-ink"
              >
                {item}
                <button
                  type="button"
                  onClick={() => remove(item)}
                  aria-label={`Retirer « ${item} » de la liste`}
                  className="text-ink-faint transition-colors hover:text-danger"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-rule pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-ink-faint" aria-live="polite">
          <span className="font-mono text-[11px]">{settingKey}</span>
          {" — "}
          {list.length} {countNoun(list.length)} ·{" "}
          {dirty
            ? "modifications non enregistrées"
            : "à jour — aucune modification en attente"}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={!dirty || saving}
            onClick={() => setList(initial ?? [])}
          >
            Annuler
          </Button>
          <Button size="sm" disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <CheckCheck aria-hidden />
            )}
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Composant racine ──────────────────────────────────────────────────

export function ModerationClient({
  currentUserId,
  currentUserName,
}: {
  currentUserId: string;
  currentUserName: string;
}) {
  return (
    <>
      <SonnerToaster position="bottom-right" closeButton />
      <Tabs defaultValue="comments" className="gap-4">
        <TabsList className="h-auto w-full flex-wrap justify-start rounded-[2px] border border-rule bg-paper-alt p-1">
          <TabsTrigger value="comments" className="gap-1.5 rounded-[2px]">
            <MessageSquare className="size-4" aria-hidden />
            Commentaires
          </TabsTrigger>
          <TabsTrigger value="inbox" className="gap-1.5 rounded-[2px]">
            <InboxIcon className="size-4" aria-hidden />
            Boîte de réception
          </TabsTrigger>
          <TabsTrigger value="words" className="gap-1.5 rounded-[2px]">
            <ShieldX className="size-4" aria-hidden />
            Mots bloqués
          </TabsTrigger>
          <TabsTrigger value="banned" className="gap-1.5 rounded-[2px]">
            <ShieldBan className="size-4" aria-hidden />
            Bannis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comments">
          <CommentsTab />
        </TabsContent>
        <TabsContent value="inbox">
          <InboxTab currentUserId={currentUserId} currentUserName={currentUserName} />
        </TabsContent>
        <TabsContent value="words">
          <StringListEditor
            settingKey="editorial.blocked_words"
            groupKey="editorial"
            label="Mots bloqués"
            singular="mot"
            addPlaceholder="Mot ou expression à filtrer automatiquement…"
            help="Filtrage automatique haine/spam (§11.2) : tout commentaire ou message contenant l'un de ces termes est placé en file d'attente au lieu d'être publié directement. La casse est ignorée."
            emptyTitle="Aucun mot bloqué"
            emptyHint="Ajoutez des termes insultants, spam ou hors-sujet pour renforcer le filtrage automatique."
            successToast="Liste des mots bloqués enregistrée"
            normalize={(v) => v.trim().toLowerCase()}
            validate={(v) => (v.length < 2 ? "Saisissez au moins 2 caractères." : null)}
            countNoun={(n) => (n > 1 ? "mots" : "mot")}
          />
        </TabsContent>
        <TabsContent value="banned">
          <StringListEditor
            settingKey="moderation.banned_emails"
            groupKey={null}
            label="E-mails bannis"
            singular="adresse"
            addPlaceholder="adresse@exemple.net"
            help="Les auteurs bannis par e-mail ne peuvent plus publier de commentaires. Retirez une adresse pour lever le bannissement. Les adresses sont normalisées en minuscules."
            emptyTitle="Aucun auteur banni"
            emptyHint="Bannissez un auteur depuis la file des commentaires, ou ajoutez directement son adresse ici."
            successToast="Liste des e-mails bannis enregistrée"
            normalize={(v) => v.trim().toLowerCase()}
            validate={(v) =>
              EMAIL_RE.test(v) ? null : "Saisissez une adresse e-mail valide."
            }
            countNoun={(n) => (n > 1 ? "adresses" : "adresse")}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
