"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Toaster } from "@/components/ui/sonner";
import { apiFetch, errorMessage } from "@/lib/api/client";
import {
  Ban,
  Check,
  Copy,
  KeyRound,
  MoreHorizontal,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  UserCog,
} from "lucide-react";

/**
 * Écran « Utilisateurs » (§08.3, §11.2) : liste des comptes de la
 * rédaction avec recherche, invitation (mot de passe temporaire affiché
 * une seule fois — repli explicite D-10 en l'absence de service e-mail),
 * changement de statut et de rôle avec restriction par rubrique.
 */

type UserStatus = "active" | "invited" | "suspended" | "disabled";

interface UserItemRole {
  key: string;
  label: string;
  category_ids: string[] | null;
}

interface UserItem {
  id: string;
  email: string;
  display_name: string;
  slug: string;
  job_title: string | null;
  status: UserStatus;
  two_factor_enabled: boolean;
  last_login_at: string | null;
  created_at: string;
  roles: UserItemRole[];
}

interface CategoryItem {
  id: string;
  parent_id: string | null;
  name: string;
  depth: number;
}

// Les 11 rôles système (§08.2, libellés du référentiel). Les rôles
// portés par des comptes mais absents de cette liste sont ajoutés
// depuis la réponse GET (rôles personnalisés éventuels).
const SYSTEM_ROLES: readonly { key: string; label: string }[] = [
  { key: "admin", label: "Administrateur" },
  { key: "publisher", label: "Directeur de publication" },
  { key: "chief_editor", label: "Rédacteur en chef" },
  { key: "section_editor", label: "Chef de rubrique" },
  { key: "journalist", label: "Journaliste" },
  { key: "copy_editor", label: "Correcteur" },
  { key: "contributor", label: "Contributeur externe" },
  { key: "ad_manager", label: "Régie publicitaire" },
  { key: "newsletter_manager", label: "Gestionnaire newsletter" },
  { key: "moderator", label: "Modérateur" },
  { key: "analyst", label: "Analyste" },
];

const STATUS_META: Record<UserStatus, { label: string; badge: string }> = {
  active: { label: "Actif", badge: "bg-success/10 text-success border-success/30" },
  invited: { label: "Invité", badge: "bg-warning/10 text-warning border-warning/30" },
  suspended: { label: "Suspendu", badge: "bg-danger/10 text-danger border-danger/30" },
  disabled: { label: "Désactivé", badge: "bg-paper-alt text-ink-faint border-rule" },
};

function relativeTime(iso: string | null): string {
  if (!iso) return "Jamais";
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  if (days < 30) return `il y a ${Math.floor(days / 7)} sem.`;
  if (days < 365) return `il y a ${Math.floor(days / 30)} mois`;
  const years = Math.floor(days / 365);
  return `il y a ${years} an${years > 1 ? "s" : ""}`;
}

/** Sélecteur de rôle + restriction par rubrique, partagé par les deux dialogs. */
function RoleAndCategoriesFields({
  roleOptions,
  roleKey,
  onRoleKeyChange,
  categories,
  selected,
  onToggleCategory,
  onAllCategories,
}: {
  roleOptions: { key: string; label: string }[];
  roleKey: string;
  onRoleKeyChange: (key: string) => void;
  categories: CategoryItem[];
  selected: string[];
  onToggleCategory: (id: string) => void;
  onAllCategories: () => void;
}) {
  const allChecked = selected.length === 0;
  const indeterminate = !allChecked && selected.length < categories.length;

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="user-role">Rôle</Label>
        <Select value={roleKey} onValueChange={onRoleKeyChange}>
          <SelectTrigger id="user-role" className="mt-1 w-full">
            <SelectValue placeholder="Choisir un rôle" />
          </SelectTrigger>
          <SelectContent>
            {roleOptions.map((role) => (
              <SelectItem key={role.key} value={role.key}>
                {role.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Restriction par rubrique</Label>
        <p className="mt-0.5 text-xs text-ink-faint">
          {allChecked
            ? "Aucune restriction : accès à toutes les rubriques."
            : `Accès limité à ${selected.length} rubrique${selected.length > 1 ? "s" : ""}.`}
        </p>
        <div
          role="group"
          aria-label="Rubriques autorisées"
          className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-[2px] border border-rule bg-paper-alt p-2"
        >
          <label className="flex cursor-pointer items-center gap-2 rounded-[2px] px-1 py-1 text-sm font-medium hover:bg-paper">
            <Checkbox
              checked={indeterminate ? "indeterminate" : allChecked}
              onCheckedChange={(value) => {
                if (value === true) onAllCategories();
              }}
              aria-label="Toutes les rubriques"
            />
            Toutes les rubriques
          </label>
          {categories.map((category) => (
            <label
              key={category.id}
              className="flex cursor-pointer items-center gap-2 rounded-[2px] px-1 py-1 text-sm hover:bg-paper"
              style={{ paddingLeft: `${8 + category.depth * 16}px` }}
            >
              <Checkbox
                checked={selected.includes(category.id)}
                onCheckedChange={(value) => {
                  if (value === true) onToggleCategory(category.id);
                }}
                aria-label={category.name}
              />
              <span className={category.depth > 0 ? "text-ink-soft" : undefined}>
                {category.name}
              </span>
            </label>
          ))}
          {categories.length === 0 ? (
            <p className="px-1 py-2 text-xs text-ink-faint">Aucune rubrique disponible.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function UtilisateursClient() {
  const [users, setUsers] = useState<UserItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [categories, setCategories] = useState<CategoryItem[]>([]);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteJob, setInviteJob] = useState("");
  const [inviteRole, setInviteRole] = useState("journalist");
  const [inviteCats, setInviteCats] = useState<string[]>([]);
  const [invited, setInvited] = useState<{ email: string; password: string } | null>(null);

  const [roleTarget, setRoleTarget] = useState<UserItem | null>(null);
  const [roleKey, setRoleKey] = useState("journalist");
  const [roleCats, setRoleCats] = useState<string[]>([]);

  const [busy, setBusy] = useState(false);

  // ── Chargement ─────────────────────────────────────────────────────

  const loadUsers = useCallback(async (query: string) => {
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      const { data } = await apiFetch<UserItem[]>(`/api/admin/users?${params.toString()}`);
      setUsers(data);
    } catch (error) {
      setLoadError(errorMessage(error));
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    void loadUsers(debouncedQ);
  }, [debouncedQ, loadUsers]);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await apiFetch<CategoryItem[]>("/api/admin/taxonomies/categories");
        setCategories(data);
      } catch {
        // Rubriques indisponibles : la restriction reste utilisable à vide.
      }
    })();
  }, []);

  // ── Options de rôles (11 rôles système + rôles rencontrés) ─────────

  const roleOptions = useMemo(() => {
    const map = new Map<string, string>(SYSTEM_ROLES.map((r) => [r.key, r.label]));
    for (const user of users ?? []) {
      for (const role of user.roles) {
        if (!map.has(role.key)) map.set(role.key, role.label);
      }
    }
    return [...map].map(([key, label]) => ({ key, label }));
  }, [users]);

  // ── Actions ────────────────────────────────────────────────────────

  const submitInvite = async () => {
    setBusy(true);
    try {
      const { data } = await apiFetch<{ user: UserItem; temporary_password: string }>(
        "/api/admin/users",
        {
          method: "POST",
          json: {
            email: inviteEmail.trim(),
            display_name: inviteName.trim(),
            ...(inviteJob.trim() ? { job_title: inviteJob.trim() } : {}),
            role_key: inviteRole,
            category_ids: inviteCats,
          },
        }
      );
      setInvited({ email: data.user.email, password: data.temporary_password });
      toast.success(`Invitation créée pour ${data.user.email}.`);
      void loadUsers(debouncedQ);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const submitRoleChange = async () => {
    if (!roleTarget) return;
    setBusy(true);
    try {
      await apiFetch(`/api/admin/users/${roleTarget.id}`, {
        method: "PATCH",
        json: { role_key: roleKey, category_ids: roleCats },
      });
      toast.success(`Rôle de ${roleTarget.display_name} mis à jour.`);
      setRoleTarget(null);
      void loadUsers(debouncedQ);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (target: UserItem, status: UserStatus) => {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/users/${target.id}`, {
        method: "PATCH",
        json: { status },
      });
      toast.success(`Statut de ${target.display_name} mis à jour.`);
      void loadUsers(debouncedQ);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const copyPassword = async () => {
    if (!invited) return;
    try {
      await navigator.clipboard.writeText(invited.password);
      toast.success("Mot de passe copié dans le presse-papiers.");
    } catch {
      toast.error("Copie impossible — sélectionnez le mot de passe manuellement.");
    }
  };

  const resetInviteForm = () => {
    setInviteEmail("");
    setInviteName("");
    setInviteJob("");
    setInviteRole("journalist");
    setInviteCats([]);
    setInvited(null);
  };

  const openRoleDialog = (target: UserItem) => {
    const current = target.roles[0];
    setRoleTarget(target);
    setRoleKey(current?.key ?? "journalist");
    setRoleCats(current?.category_ids ?? []);
  };

  const toggleInviteCategory = (id: string) => {
    setInviteCats((current) =>
      current.includes(id) ? current.filter((c) => c !== id) : [...current, id]
    );
  };

  const toggleRoleCategory = (id: string) => {
    setRoleCats((current) =>
      current.includes(id) ? current.filter((c) => c !== id) : [...current, id]
    );
  };

  // ── Rendu ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <Toaster position="bottom-right" richColors closeButton />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-faint" aria-live="polite">
          {users === null
            ? "Chargement…"
            : `${users.length} compte${users.length > 1 ? "s" : ""}`}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
            />
            <Input
              type="search"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Rechercher un nom ou un e-mail…"
              aria-label="Rechercher un utilisateur"
              className="w-full ps-9 sm:w-72"
            />
          </div>
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus aria-hidden="true" className="size-4" />
            Inviter un collaborateur
          </Button>
        </div>
      </div>

      <div className="max-h-[70vh] overflow-y-auto rounded-[2px] border border-rule bg-paper">
        {users === null ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-danger">{loadError}</p>
            <Button variant="outline" size="sm" onClick={() => void loadUsers(debouncedQ)}>
              Réessayer
            </Button>
          </div>
        ) : users.length === 0 ? (
          <p className="p-8 text-center text-sm text-ink-faint">
            {debouncedQ
              ? "Aucun utilisateur ne correspond à votre recherche."
              : "Aucun utilisateur pour le moment — invitez votre premier collaborateur."}
          </p>
        ) : (
          <Table className="min-w-[860px]">
            <TableHeader className="sticky top-0 z-10 bg-paper-alt">
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Rôles</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>2FA</TableHead>
                <TableHead>Dernière connexion</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const statusMeta = STATUS_META[user.status];
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <p className="font-medium text-ink">{user.display_name}</p>
                      {user.job_title ? (
                        <p className="text-xs text-ink-faint">{user.job_title}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-ink-soft">{user.email}</TableCell>
                    <TableCell>
                      <div className="flex max-w-64 flex-wrap gap-1">
                        {user.roles.length === 0 ? (
                          <span className="text-xs text-ink-faint">—</span>
                        ) : (
                          user.roles.map((role) => (
                            <Badge
                              key={role.key}
                              variant="outline"
                              title={
                                role.category_ids && role.category_ids.length > 0
                                  ? `Restreint à ${role.category_ids.length} rubrique(s)`
                                  : "Toutes les rubriques"
                              }
                            >
                              {role.label}
                              {role.category_ids && role.category_ids.length > 0
                                ? ` · ${role.category_ids.length}`
                                : null}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusMeta.badge}>
                        {statusMeta.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.two_factor_enabled ? (
                        <ShieldCheck
                          aria-label="Double authentification activée"
                          className="size-4 text-success"
                        />
                      ) : (
                        <ShieldAlert
                          aria-label="Double authentification non activée"
                          className="size-4 text-ink-faint"
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-ink-soft tabular-nums">
                      {relativeTime(user.last_login_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={busy}
                            aria-label={`Actions pour ${user.display_name}`}
                          >
                            <MoreHorizontal aria-hidden="true" className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Statut</DropdownMenuLabel>
                          <DropdownMenuItem
                            disabled={user.status === "active"}
                            onSelect={() => void changeStatus(user, "active")}
                          >
                            <Check aria-hidden="true" className="size-4 text-success" />
                            Activer
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={user.status === "suspended"}
                            onSelect={() => void changeStatus(user, "suspended")}
                          >
                            <Ban aria-hidden="true" className="size-4 text-warning" />
                            Suspendre
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={user.status === "disabled"}
                            onSelect={() => void changeStatus(user, "disabled")}
                            className="text-danger focus:text-danger"
                          >
                            <ShieldAlert aria-hidden="true" className="size-4" />
                            Désactiver
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => openRoleDialog(user)}>
                            <UserCog aria-hidden="true" className="size-4" />
                            Modifier le rôle
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* ── Dialog : invitation d'un collaborateur ──────────────────── */}
      <Dialog
        open={inviteOpen}
        onOpenChange={(value) => {
          setInviteOpen(value);
          if (!value) resetInviteForm();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Inviter un collaborateur</DialogTitle>
            <DialogDescription>
              Un mot de passe temporaire sera généré et affiché une seule fois.
            </DialogDescription>
          </DialogHeader>

          {invited ? (
            <div className="space-y-4">
              <Alert className="border-success/40 bg-success/5">
                <ShieldCheck className="text-success" />
                <AlertTitle>Invitation créée pour {invited.email}</AlertTitle>
                <AlertDescription>
                  <p className="text-xs text-ink-soft">
                    Transmettez ce mot de passe temporaire au collaborateur — il
                    devra le changer à la première connexion.
                  </p>
                  <div className="flex w-full items-center gap-2">
                    <code className="min-w-0 flex-1 break-all rounded-[2px] border border-rule bg-paper-alt px-2 py-1.5 font-mono text-sm font-semibold text-ink">
                      {invited.password}
                    </code>
                    <Button type="button" variant="outline" size="sm" onClick={() => void copyPassword()}>
                      <Copy aria-hidden="true" className="size-4" />
                      Copier
                    </Button>
                  </div>
                  <p className="text-xs font-semibold text-danger">
                    Ce mot de passe ne sera plus jamais affiché.
                  </p>
                </AlertDescription>
              </Alert>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setInviteOpen(false);
                    resetInviteForm();
                  }}
                >
                  Terminé
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submitInvite();
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="invite-email">E-mail professionnel</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    required
                    autoComplete="off"
                    placeholder="prenom.nom@infospro.net"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="invite-name">Nom complet</Label>
                  <Input
                    id="invite-name"
                    required
                    minLength={2}
                    autoComplete="off"
                    placeholder="Fatoumata Camara"
                    value={inviteName}
                    onChange={(event) => setInviteName(event.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="invite-job">Fonction (optionnel)</Label>
                <Input
                  id="invite-job"
                  placeholder="Journaliste politique"
                  value={inviteJob}
                  onChange={(event) => setInviteJob(event.target.value)}
                  className="mt-1"
                />
              </div>
              <RoleAndCategoriesFields
                roleOptions={roleOptions}
                roleKey={inviteRole}
                onRoleKeyChange={setInviteRole}
                categories={categories}
                selected={inviteCats}
                onToggleCategory={toggleInviteCategory}
                onAllCategories={() => setInviteCats([])}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setInviteOpen(false);
                    resetInviteForm();
                  }}
                  disabled={busy}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={busy || !inviteEmail.trim() || !inviteName.trim()}>
                  <KeyRound aria-hidden="true" className="size-4" />
                  {busy ? "Création…" : "Créer l'invitation"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Dialog : modification du rôle ───────────────────────────── */}
      <Dialog
        open={roleTarget !== null}
        onOpenChange={(value) => {
          if (!value) setRoleTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier le rôle</DialogTitle>
            <DialogDescription>
              {roleTarget ? `${roleTarget.display_name} — ${roleTarget.email}` : null}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submitRoleChange();
            }}
          >
            <RoleAndCategoriesFields
              roleOptions={roleOptions}
              roleKey={roleKey}
              onRoleKeyChange={setRoleKey}
              categories={categories}
              selected={roleCats}
              onToggleCategory={toggleRoleCategory}
              onAllCategories={() => setRoleCats([])}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRoleTarget(null)} disabled={busy}>
                Annuler
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
