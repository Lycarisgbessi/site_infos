"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { apiFetch, errorMessage } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Trash2, Archive, CalendarClock, FolderInput, Save, X } from "lucide-react";

/**
 * Liste des articles (§11.2 /admin/articles) : colonnes titre, rubrique,
 * auteur(s), statut, date, vues, score SEO ; filtres complets ; actions
 * groupées ; vues enregistrées par utilisateur (user_preferences, D-13) ;
 * corbeille.
 */

interface ArticleRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  format: string;
  published_at: string | null;
  scheduled_at: string | null;
  updated_at: string;
  view_count: number;
  seo_score: number | null;
  importance: number;
  cover_media_id: string | null;
  category: { id: string; name: string } | null;
  createdBy: { display_name: string } | null;
  authors: { user: { display_name: string } }[];
}

interface SavedView {
  name: string;
  filters: Record<string, string>;
}

const STATUS_FR: Record<string, string> = {
  draft: "Brouillon", in_review: "À relire", changes_requested: "Retour",
  approved: "Approuvé", scheduled: "Programmé", published: "Publié", updated: "Publié (maj)",
  archived: "Archivé", unpublished: "Dépublié",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-paper-alt text-ink-soft border-rule",
  in_review: "bg-amber-50 text-amber-800 border-amber-200",
  changes_requested: "bg-red-50 text-red-800 border-red-200",
  approved: "bg-green-50 text-green-800 border-green-200",
  scheduled: "bg-blue-50 text-blue-800 border-blue-200",
  published: "bg-ink text-paper border-ink",
  updated: "bg-ink text-paper border-ink",
  archived: "bg-paper-alt text-ink-faint border-rule",
  unpublished: "bg-paper-alt text-ink-faint border-rule",
};

export function ArticleListClient({
  categories,
  formats,
}: {
  categories: { id: string; name: string; depth: number }[];
  formats: readonly string[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [rows, setRows] = useState<ArticleRow[]>([]);
  const [meta, setMeta] = useState<{ total: number; page: number; pages: number }>({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [trash, setTrash] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [viewName, setViewName] = useState("");
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [format, setFormat] = useState("all");
  const [noImage, setNoImage] = useState("all");
  const [noKeyword, setNoKeyword] = useState("all");

  const filters = useMemo(
    () => ({
      ...(q ? { q } : {}),
      ...(status !== "all" ? { status } : {}),
      ...(categoryId !== "all" ? { category_id: categoryId } : {}),
      ...(format !== "all" ? { format } : {}),
      ...(noImage === "1" ? { no_image: "1" } : {}),
      ...(noKeyword === "1" ? { no_keyword: "1" } : {}),
    }),
    [q, status, categoryId, format, noImage, noKeyword]
  );

  const load = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), per_page: "20" });
        for (const [k, v] of Object.entries(filters)) params.set(k, v);
        if (trash) params.set("trash", "1");
        const { data, meta: m } = await apiFetch<ArticleRow[]>(`/api/admin/articles?${params}`);
        setRows(data);
        setMeta({ total: Number(m?.total ?? 0), page: Number(m?.page ?? 1), pages: Number(m?.pages ?? 1) });
      } catch (error) {
        toast({ title: "Chargement impossible", description: errorMessage(error), variant: "destructive" });
      } finally {
        setLoading(false);
      }
    },
    [filters, trash, toast]
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  // Vues enregistrées (préférences utilisateur)
  useEffect(() => {
    void (async () => {
      try {
        const { data } = await apiFetch<SavedView[] | null>("/api/admin/preferences?key=articles.saved_views");
        if (Array.isArray(data)) setSavedViews(data);
      } catch {
        // préférences absentes : liste vide
      }
    })();
  }, []);

  const saveCurrentView = async () => {
    const view: SavedView = { name: viewName.trim() || "Vue", filters: filters as Record<string, string> };
    const next = [...savedViews.filter((v) => v.name !== view.name), view];
    await apiFetch("/api/admin/preferences", { method: "PUT", json: { key: "articles.saved_views", value: next } });
    setSavedViews(next);
    setSaveViewOpen(false);
    setViewName("");
    toast({ title: "Vue enregistrée" });
  };

  const applyView = (view: SavedView) => {
    setQ(view.filters.q ?? "");
    setStatus(view.filters.status ?? "all");
    setCategoryId(view.filters.category_id ?? "all");
    setFormat(view.filters.format ?? "all");
    setNoImage(view.filters.no_image ?? "all");
    setNoKeyword(view.filters.no_keyword ?? "all");
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const bulk = async (action: string, extra?: Record<string, string>) => {
    try {
      await apiFetch("/api/admin/articles/bulk", {
        method: "POST",
        json: { ids: [...selected], action, ...extra },
      });
      toast({ title: "Action groupée appliquée" });
      setSelected(new Set());
      void load(meta.page);
    } catch (error) {
      toast({ title: "Action refusée", description: errorMessage(error), variant: "destructive" });
    }
  };

  const createArticle = async (title: string, catId: string) => {
    try {
      const { data } = await apiFetch<{ id: string }>("/api/admin/articles", {
        method: "POST",
        json: { title, category_id: catId },
      });
      router.push(`/admin/articles/${data.id}`);
    } catch (error) {
      toast({ title: "Création refusée", description: errorMessage(error), variant: "destructive" });
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-2xl font-bold">Articles</h1>
        <span className="text-sm text-ink-faint">{meta.total} article(s)</span>
        <div className="ml-auto flex gap-2">
          <Button variant={trash ? "default" : "outline"} size="sm" onClick={() => { setTrash((t) => !t); setSelected(new Set()); }}>
            <Trash2 className="mr-1 size-4" aria-hidden /> Corbeille
          </Button>
          <Button size="sm" className="bg-brand-red text-white hover:bg-red-deep" onClick={() => setNewOpen(true)}>
            <Plus className="mr-1 size-4" aria-hidden /> Nouvel article
          </Button>
        </div>
      </div>

      {/* Filtres */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-sm border border-rule bg-paper-alt p-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-ink-faint" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Titre, chapô, slug…" className="pl-8" aria-label="Recherche" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40" aria-label="Statut"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            {Object.entries(STATUS_FR).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="w-44" aria-label="Rubrique"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes rubriques</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{"—".repeat(c.depth)} {c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={format} onValueChange={setFormat}>
          <SelectTrigger className="w-40" aria-label="Format"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous formats</SelectItem>
            {formats.map((f) => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={noImage} onValueChange={setNoImage}>
          <SelectTrigger className="w-36" aria-label="Sans image"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Avec/sans image</SelectItem>
            <SelectItem value="1">Sans image</SelectItem>
          </SelectContent>
        </Select>
        <Select value={noKeyword} onValueChange={setNoKeyword}>
          <SelectTrigger className="w-44" aria-label="Sans mot-clé cible"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Avec/sans mot-clé</SelectItem>
            <SelectItem value="1">Sans mot-clé cible</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setSaveViewOpen(true)}>
          <Save className="mr-1 size-4" aria-hidden /> Enregistrer la vue
        </Button>
        {savedViews.length > 0 && (
          <Select onValueChange={(name) => { const v = savedViews.find((s) => s.name === name); if (v) applyView(v); }}>
            <SelectTrigger className="w-44" aria-label="Vues enregistrées"><SelectValue placeholder="Vues enregistrées…" /></SelectTrigger>
            <SelectContent>
              {savedViews.map((v) => (
                <SelectItem key={v.name} value={v.name}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Actions groupées */}
      {selected.size > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-sm border border-brand-red bg-red-50 p-2 text-sm dark:bg-red-950/20">
          <span className="font-semibold">{selected.size} sélectionné(s)</span>
          <BulkButton label="Déplacer vers rubrique…" icon={<FolderInput className="size-4" aria-hidden />}
            renderPick={(pick) => (
              <Select onValueChange={(id) => { void bulk("move_category", { category_id: id }); pick(); }}>
                <SelectTrigger className="w-52" aria-label="Rubrique cible"><SelectValue placeholder="Choisir la rubrique…" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{"—".repeat(c.depth)} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <BulkButton label="Programmer…" icon={<CalendarClock className="size-4" aria-hidden />}
            renderPick={(pick) => (
              <Input
                type="datetime-local"
                aria-label="Date de programmation groupée"
                onChange={(e) => {
                  if (e.target.value) {
                    void bulk("schedule", { scheduled_at: new Date(e.target.value).toISOString() });
                    pick();
                  }
                }}
              />
            )}
          />
          <Button variant="outline" size="sm" onClick={() => void bulk("archive")}><Archive className="mr-1 size-4" aria-hidden /> Archiver</Button>
          <Button variant="outline" size="sm" onClick={() => void bulk(trash ? "restore" : "trash")}>
            <Trash2 className="mr-1 size-4" aria-hidden /> {trash ? "Restaurer" : "Mettre à la corbeille"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}><X className="mr-1 size-4" aria-hidden /> Désélectionner</Button>
        </div>
      )}

      {/* Tableau */}
      <div className="mt-4 overflow-x-auto rounded-sm border border-rule" style={{ scrollbarWidth: "thin" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule bg-paper-alt text-left text-xs tracking-wider text-ink-faint">
              <th className="p-3"><input type="checkbox" checked={allSelected} onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} aria-label="Tout sélectionner" className="accent-[#C8102E]" /></th>
              <th className="p-3">TITRE</th>
              <th className="p-3">RUBRIQUE</th>
              <th className="p-3">AUTEUR(S)</th>
              <th className="p-3">STATUT</th>
              <th className="p-3">DATE</th>
              <th className="p-3 text-right">VUES</th>
              <th className="p-3 text-right">SEO</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-rule">
                  <td colSpan={8} className="p-3"><div className="h-4 animate-pulse rounded bg-paper-alt" /></td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="p-10 text-center text-ink-faint">Aucun article pour ces filtres.</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className={`border-b border-rule transition-colors hover:bg-paper-alt ${selected.has(row.id) ? "bg-red-50/40 dark:bg-red-950/10" : ""}`}>
                  <td className="p-3">
                    <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelect(row.id)} aria-label={`Sélectionner ${row.title}`} className="accent-[#C8102E]" />
                  </td>
                  <td className="max-w-md p-3">
                    <a href={`/admin/articles/${row.id}`} className="font-semibold hover:text-brand-red hover:underline">{row.title}</a>
                    <div className="text-xs text-ink-faint">/{row.slug} · {row.format}</div>
                  </td>
                  <td className="p-3 text-ink-soft">{row.category?.name ?? "—"}</td>
                  <td className="p-3 text-ink-soft">
                    {row.authors.map((a) => a.user.display_name).join(", ") || row.createdBy?.display_name || "—"}
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className={STATUS_COLOR[row.status] ?? ""}>{STATUS_FR[row.status] ?? row.status}</Badge>
                  </td>
                  <td className="p-3 text-xs text-ink-faint">
                    {row.published_at
                      ? new Date(row.published_at).toLocaleDateString("fr-FR")
                      : row.scheduled_at
                        ? `prog. ${new Date(row.scheduled_at).toLocaleDateString("fr-FR")}`
                        : `maj ${new Date(row.updated_at).toLocaleDateString("fr-FR")}`}
                  </td>
                  <td className="p-3 text-right tabular-nums">{Number(row.view_count).toLocaleString("fr-FR")}</td>
                  <td className="p-3 text-right tabular-nums">
                    {row.seo_score !== null ? (
                      <span className={row.seo_score >= 60 ? "text-success" : "text-brand-red"}>{row.seo_score}</span>
                    ) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta.pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => void load(meta.page - 1)}>← Précédent</Button>
          <span className="text-sm text-ink-soft">Page {meta.page} / {meta.pages}</span>
          <Button variant="outline" size="sm" disabled={meta.page >= meta.pages} onClick={() => void load(meta.page + 1)}>Suivant →</Button>
        </div>
      )}

      {/* Dialogue nouvel article */}
      <NewArticleDialog open={newOpen} onOpenChange={setNewOpen} categories={categories} onCreate={createArticle} />

      {/* Dialogue enregistrer la vue */}
      <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}>
        <DialogContent className="bg-paper sm:max-w-sm">
          <DialogHeader><DialogTitle className="font-serif">Enregistrer la vue</DialogTitle></DialogHeader>
          <Label htmlFor="view-name">Nom de la vue</Label>
          <Input id="view-name" value={viewName} onChange={(e) => setViewName(e.target.value)} placeholder="Ex. : À relire cette semaine" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveViewOpen(false)}>Annuler</Button>
            <Button onClick={() => void saveCurrentView()} disabled={!viewName.trim()}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BulkButton({ label, icon, renderPick }: { label: string; icon: React.ReactNode; renderPick: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>{icon} {label}</Button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-sm border border-rule bg-paper p-2 shadow-lg">
          {renderPick(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function NewArticleDialog({
  open, onOpenChange, categories, onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: { id: string; name: string; depth: number }[];
  onCreate: (title: string, categoryId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [catId, setCatId] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-paper sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">Nouvel article</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="new-title">Titre de travail *</Label>
            <Input id="new-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. : Baux miniers : ce qui change en 2026" />
          </div>
          <div>
            <Label htmlFor="new-cat">Rubrique *</Label>
            <Select value={catId} onValueChange={setCatId}>
              <SelectTrigger id="new-cat" aria-label="Rubrique"><SelectValue placeholder="Choisir…" /></SelectTrigger>
              <SelectContent className="max-h-64">
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{"—".repeat(c.depth)} {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button className="bg-brand-red text-white hover:bg-red-deep" disabled={!title.trim() || !catId} onClick={() => onCreate(title.trim(), catId)}>
            Créer et ouvrir l'éditeur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
