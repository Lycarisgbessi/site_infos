"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  EyeOff,
  FileText,
  Handshake,
  Image as ImageIcon,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  RotateCw,
  Save,
  Search,
  Trash2,
  Users,
} from "lucide-react";

import { apiFetch, errorMessage } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import { parseBlocks, type Block } from "@/types/blocks";
import { MediaPicker } from "@/components/admin/MediaPicker";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SimpleEditor } from "@/components/editor/SimpleEditor";
import { blocksToHtml } from "@/lib/import/blocks-to-html";
import { htmlToBlocks } from "@/lib/import/html-to-blocks";

/**
 * Écran « Pages & bannières » (§11.2, Phase 2) :
 * - onglet Pages : liste des pages statiques, éditeur pleine largeur avec
 *   corps édité en « mode simple » (blocs §06.4 au repos) — un changement
 *   de slug déclenche une redirection 301 automatique côté serveur ;
 * - onglet Bannières : bandeaux du site (alerte / info / promo) avec lien
 *   facultatif, ciblage de chemins, fenêtre d'affichage et refermabilité ;
 * - onglet Redirections : gestion des redirections (§20 Phase 2 tâche 7) —
 *   créées automatiquement par les renommages (is_auto, non supprimables)
 *   ou ajoutées manuellement, avec recherche et pagination ;
 * - onglets Partenaires et Équipe : logos/noms des partenaires (page
 *   « Nos partenaires », défilement automatique) et membres de la rédaction
 *   (page « Notre équipe ») — photo/logo issus de la médiathèque.
 * Le corps des pages est édité en « mode simple » (SimpleEditor) : le HTML
 * est converti en blocs §06.4 à la sauvegarde via htmlToBlocks.
 *
 * Toutes les requêtes passent par apiFetch (enveloppe {data,meta} §07.1) ;
 * les erreurs sont signalées par des toasts français.
 */

interface PageRow {
  id: string;
  title: string;
  slug: string;
  template: string;
  is_published: boolean;
  updated_at: string;
  locale: string;
}

interface PageFull extends PageRow {
  body: string | null;
  seo: Record<string, unknown> | null;
}

interface BannerRow {
  id: string;
  message: string;
  link_url: string | null;
  link_label: string | null;
  style: string;
  is_dismissible: boolean;
  /** Tableau JSON sérialisé en chaîne côté API (colonne texte, D-01). */
  target_paths: string | string[];
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
}

interface PageFormState {
  title: string;
  slug: string;
  template: string;
  is_published: boolean;
  blocks: Block[];
}

interface BannerFormState {
  message: string;
  link_url: string;
  link_label: string;
  style: string;
  is_dismissible: boolean;
  /** Chemins saisis séparés par des virgules. */
  target_paths: string;
  /** Valeurs datetime-local. */
  starts_at: string;
  ends_at: string;
  is_active: boolean;
}

interface RedirectRow {
  id: string;
  source_path: string;
  target_path: string;
  status_code: number;
  hit_count: number;
  is_auto: boolean;
  created_at: string;
}

interface RedirectFormState {
  /** Vide en édition : la source d'une redirection n'est pas modifiable. */
  source_path: string;
  target_path: string;
  /** Chaîne pour le Select (« 301 » / « 302 »). */
  status_code: string;
}

interface TeamMemberRow {
  id: string;
  name: string;
  role: string;
  bio: string | null;
  email: string | null;
  photo_media_id: string | null;
  photo_url: string | null;
  position: number;
  is_active: boolean;
  created_at: string;
}

interface TeamFormState {
  name: string;
  role: string;
  bio: string;
  email: string;
  /** Champ nombre saisi en chaîne (conversion à l'enregistrement). */
  position: string;
  is_active: boolean;
  photo_media_id: string | null;
  photo_preview_url: string | null;
}

interface PartnerRow {
  id: string;
  name: string;
  category: string | null;
  url: string | null;
  logo_media_id: string | null;
  logo_url: string | null;
  position: number;
  is_active: boolean;
  created_at: string;
}

interface PartnerFormState {
  name: string;
  category: string;
  url: string;
  /** Champ nombre saisi en chaîne (conversion à l'enregistrement). */
  position: string;
  is_active: boolean;
  logo_media_id: string | null;
  logo_preview_url: string | null;
}

interface EditorState {
  /** null = création. */
  id: string | null;
  loading: boolean;
  originalSlug: string | null;
}

const TEMPLATES: { value: string; label: string }[] = [
  { value: "default", label: "Standard" },
  { value: "contact", label: "Contact" },
  { value: "about", label: "À propos" },
  { value: "advertising", label: "Publicité / Régie" },
  { value: "legal", label: "Mentions légales" },
];

const TEMPLATE_LABELS: Record<string, string> = {
  default: "Standard",
  contact: "Contact",
  about: "À propos",
  advertising: "Publicité",
  legal: "Légal",
};

const BANNER_STYLES: { value: string; label: string }[] = [
  { value: "alert", label: "Alerte" },
  { value: "info", label: "Information" },
  { value: "promo", label: "Promotion" },
];

const BANNER_STYLE_BADGES: Record<string, string> = {
  alert: "border-red-bright/30 bg-red-wash text-brand-red",
  info: "border-rule bg-paper-sunk text-ink-soft",
  promo: "border-success/30 bg-success/10 text-success",
};

const EMPTY_BANNER_FORM: BannerFormState = {
  message: "",
  link_url: "",
  link_label: "",
  style: "info",
  is_dismissible: true,
  target_paths: "",
  starts_at: "",
  ends_at: "",
  is_active: true,
};

/** Taille de page de l'onglet Redirections (pagination simple). */
const REDIRECT_PAGE_SIZE = 50;

const REDIRECT_CODE_BADGES: Record<number, string> = {
  301: "border-success/30 bg-success/10 text-success",
  302: "border-warning/30 bg-warning/10 text-warning",
};

const REDIRECT_CODE_LABELS: Record<number, string> = {
  301: "Permanente",
  302: "Temporaire",
};

const EMPTY_REDIRECT_FORM: RedirectFormState = {
  source_path: "",
  target_path: "",
  status_code: "301",
};

const EMPTY_TEAM_FORM: TeamFormState = {
  name: "",
  role: "",
  bio: "",
  email: "",
  position: "0",
  is_active: true,
  photo_media_id: null,
  photo_preview_url: null,
};

const EMPTY_PARTNER_FORM: PartnerFormState = {
  name: "",
  category: "",
  url: "",
  position: "0",
  is_active: true,
  logo_media_id: null,
  logo_preview_url: null,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const HTTP_URL_RE = /^https?:\/\/\S+$/;

/** Position saisie → entier ≥ 0 (0 si vide/invalide). */
function parsePosition(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/** Deux initiales pour la vignette sans image (logo / photo). */
function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
  return letters || "?";
}

/** Normalise un chemin côté client (aperçu live) : trim + « / » initial. */
function previewPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const DATETIME_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : DATE_FORMAT.format(date);
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : DATETIME_FORMAT.format(date);
}

/** ISO → valeur datetime-local (heure locale du navigateur). */
function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** datetime-local → ISO 8601 (UTC), ou null si vide/invalide. */
function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Normalise target_paths (chaîne JSON ou tableau) en liste de chemins. */
function parseTargetPaths(raw: string | string[]): string[] {
  let value: unknown = raw;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      value = JSON.parse(trimmed) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0
  );
}

/** « /a, /b » → ["/a", "/b"]. */
function splitTargetPaths(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function bannerPeriod(banner: BannerRow): string {
  if (!banner.starts_at && !banner.ends_at) return "Affichage permanent";
  if (banner.starts_at && banner.ends_at) {
    return `Du ${formatDateTime(banner.starts_at)} au ${formatDateTime(banner.ends_at)}`;
  }
  if (banner.starts_at) return `À partir du ${formatDateTime(banner.starts_at)}`;
  return `Jusqu'au ${formatDateTime(banner.ends_at)}`;
}

function ListSkeleton() {
  return (
    <div className="space-y-0" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-4 border-b border-rule px-4 py-4"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3 max-w-56" />
            <Skeleton className="h-3 w-1/4 max-w-40" />
          </div>
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

function LoadErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <p className="text-sm text-ink-soft">
        Chargement impossible. Vérifiez votre connexion puis réessayez.
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RotateCw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
        Réessayer
      </Button>
    </div>
  );
}

export function PagesClient() {
  const { toast } = useToast();

  const [tab, setTab] = useState("pages");

  // ── Pages ────────────────────────────────────────────────────────────────
  const [pages, setPages] = useState<PageRow[] | null>(null);
  const [pagesError, setPagesError] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [form, setForm] = useState<PageFormState>({
    title: "",
    slug: "",
    template: "default",
    is_published: false,
    blocks: [],
  });
  /** HTML du « mode simple » du contenu de la page (SimpleEditor). */
  const [pageHtml, setPageHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<PageRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // ── Bannières ────────────────────────────────────────────────────────────
  const [banners, setBanners] = useState<BannerRow[] | null>(null);
  const [bannersError, setBannersError] = useState(false);
  const bannersRequested = useRef(false);
  const [bannerDialogOpen, setBannerDialogOpen] = useState(false);
  const [bannerEditing, setBannerEditing] = useState<BannerRow | null>(null);
  const [bannerForm, setBannerForm] =
    useState<BannerFormState>(EMPTY_BANNER_FORM);
  const [bannerSaving, setBannerSaving] = useState(false);
  const [bannerDeleting, setBannerDeleting] = useState<BannerRow | null>(null);
  const [bannerDeleteBusy, setBannerDeleteBusy] = useState(false);

  // ── Redirections ──────────────────────────────────────────────────────
  const [redirects, setRedirects] = useState<RedirectRow[] | null>(null);
  const [redirectsError, setRedirectsError] = useState(false);
  const [redirectsQuery, setRedirectsQuery] = useState("");
  const [redirectsPage, setRedirectsPage] = useState(1);
  const [redirectsTotal, setRedirectsTotal] = useState(0);
  const redirectsRequested = useRef(false);
  const [redirectDialogOpen, setRedirectDialogOpen] = useState(false);
  const [redirectEditing, setRedirectEditing] = useState<RedirectRow | null>(null);
  const [redirectForm, setRedirectForm] =
    useState<RedirectFormState>(EMPTY_REDIRECT_FORM);
  const [redirectSaving, setRedirectSaving] = useState(false);
  const [redirectDeleting, setRedirectDeleting] = useState<RedirectRow | null>(null);
  const [redirectDeleteBusy, setRedirectDeleteBusy] = useState(false);

  // ── Équipe ─────────────────────────────────────────────────────────────
  const [team, setTeam] = useState<TeamMemberRow[] | null>(null);
  const [teamError, setTeamError] = useState(false);
  const teamRequested = useRef(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [teamEditing, setTeamEditing] = useState<TeamMemberRow | null>(null);
  const [teamForm, setTeamForm] = useState<TeamFormState>(EMPTY_TEAM_FORM);
  const [teamSaving, setTeamSaving] = useState(false);
  const [teamPickerOpen, setTeamPickerOpen] = useState(false);
  const [teamTogglingId, setTeamTogglingId] = useState<string | null>(null);
  const [teamDeleting, setTeamDeleting] = useState<TeamMemberRow | null>(null);
  const [teamDeleteBusy, setTeamDeleteBusy] = useState(false);

  // ── Partenaires ────────────────────────────────────────────────────────
  const [partners, setPartners] = useState<PartnerRow[] | null>(null);
  const [partnersError, setPartnersError] = useState(false);
  const partnersRequested = useRef(false);
  const [partnerDialogOpen, setPartnerDialogOpen] = useState(false);
  const [partnerEditing, setPartnerEditing] = useState<PartnerRow | null>(null);
  const [partnerForm, setPartnerForm] = useState<PartnerFormState>(EMPTY_PARTNER_FORM);
  const [partnerSaving, setPartnerSaving] = useState(false);
  const [partnerPickerOpen, setPartnerPickerOpen] = useState(false);
  const [partnerTogglingId, setPartnerTogglingId] = useState<string | null>(null);
  const [partnerDeleting, setPartnerDeleting] = useState<PartnerRow | null>(null);
  const [partnerDeleteBusy, setPartnerDeleteBusy] = useState(false);

  const loadPages = useCallback(async () => {
    setPagesError(false);
    try {
      const { data } = await apiFetch<PageRow[]>("/api/admin/pages");
      setPages(Array.isArray(data) ? data : []);
    } catch (error) {
      setPagesError(true);
      toast({
        title: "Chargement des pages impossible",
        description: errorMessage(error),
        variant: "destructive",
      });
    }
  }, [toast]);

  const loadBanners = useCallback(async () => {
    setBannersError(false);
    try {
      const { data } = await apiFetch<BannerRow[]>(
        "/api/admin/banners?kind=banners"
      );
      setBanners(Array.isArray(data) ? data : []);
    } catch (error) {
      setBannersError(true);
      toast({
        title: "Chargement des bannières impossible",
        description: errorMessage(error),
        variant: "destructive",
      });
    }
  }, [toast]);

  const loadRedirects = useCallback(
    async (query: string, page: number) => {
      setRedirectsError(false);
      try {
        const params = new URLSearchParams({
          page: String(page),
          per_page: String(REDIRECT_PAGE_SIZE),
        });
        if (query.trim()) params.set("q", query.trim());
        const { data, meta } = await apiFetch<RedirectRow[]>(
          `/api/admin/redirects?${params.toString()}`
        );
        setRedirects(Array.isArray(data) ? data : []);
        setRedirectsTotal(
          typeof meta?.total === "number"
            ? meta.total
            : Array.isArray(data)
              ? data.length
              : 0
        );
      } catch (error) {
        setRedirectsError(true);
        toast({
          title: "Chargement des redirections impossible",
          description: errorMessage(error),
          variant: "destructive",
        });
      }
    },
    [toast]
  );

  const loadTeam = useCallback(async () => {
    setTeamError(false);
    try {
      const { data } = await apiFetch<TeamMemberRow[]>("/api/admin/team");
      setTeam(Array.isArray(data) ? data : []);
    } catch (error) {
      setTeamError(true);
      toast({
        title: "Chargement de l'équipe impossible",
        description: errorMessage(error),
        variant: "destructive",
      });
    }
  }, [toast]);

  const loadPartners = useCallback(async () => {
    setPartnersError(false);
    try {
      const { data } = await apiFetch<PartnerRow[]>("/api/admin/partners");
      setPartners(Array.isArray(data) ? data : []);
    } catch (error) {
      setPartnersError(true);
      toast({
        title: "Chargement des partenaires impossible",
        description: errorMessage(error),
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    void loadPages();
  }, [loadPages]);

  // Recherche et pagination des redirections (une fois l'onglet ouvert).
  useEffect(() => {
    if (!redirectsRequested.current) return;
    const timer = setTimeout(() => {
      void loadRedirects(redirectsQuery, redirectsPage);
    }, 250);
    return () => clearTimeout(timer);
  }, [redirectsQuery, redirectsPage, loadRedirects]);

  function handleTabChange(value: string) {
    setTab(value);
    if (value === "banners" && !bannersRequested.current) {
      bannersRequested.current = true;
      void loadBanners();
    }
    if (value === "redirects" && !redirectsRequested.current) {
      redirectsRequested.current = true;
      void loadRedirects(redirectsQuery, redirectsPage);
    }
    if (value === "partners" && !partnersRequested.current) {
      partnersRequested.current = true;
      void loadPartners();
    }
    if (value === "team" && !teamRequested.current) {
      teamRequested.current = true;
      void loadTeam();
    }
  }

  // ── Éditeur de page ──────────────────────────────────────────────────────

  function openCreatePage() {
    setForm({
      title: "",
      slug: "",
      template: "default",
      is_published: false,
      blocks: [],
    });
    setPageHtml("");
    setEditor({ id: null, loading: false, originalSlug: null });
  }

  async function openEditPage(id: string) {
    setForm({
      title: "",
      slug: "",
      template: "default",
      is_published: false,
      blocks: [],
    });
    setPageHtml("");
    setEditor({ id, loading: true, originalSlug: null });
    try {
      const { data } = await apiFetch<PageFull>(
        `/api/admin/pages?id=${encodeURIComponent(id)}`
      );
      // Le corps arrive en chaîne JSON → tableau de blocs typés, puis HTML
      // pour l'édition en « mode simple » (SimpleEditor).
      const blocks = parseBlocks(data.body);
      setForm({
        title: data.title ?? "",
        slug: data.slug ?? "",
        template: data.template ?? "default",
        is_published: Boolean(data.is_published),
        blocks,
      });
      setPageHtml(blocksToHtml(blocks));
      setEditor({ id, loading: false, originalSlug: data.slug ?? null });
    } catch (error) {
      setEditor(null);
      toast({
        title: "Chargement de la page impossible",
        description: errorMessage(error),
        variant: "destructive",
      });
    }
  }

  async function savePage() {
    if (!editor) return;
    const title = form.title.trim();
    if (!title) {
      toast({
        title: "Le titre est obligatoire.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const slug = form.slug.trim();
      // Le « mode simple » vit en HTML : conversion en blocs §06.4 avant
      // l'envoi (reconnaît data-media-id / data-video / data-audio).
      const result = await htmlToBlocks(pageHtml);
      await apiFetch("/api/admin/pages", {
        method: "POST",
        json: {
          ...(editor.id ? { id: editor.id } : {}),
          title,
          ...(slug ? { slug } : {}),
          body: result.blocks,
          template: form.template,
          is_published: form.is_published,
        },
      });
      toast({
        title: editor.id ? "Page enregistrée." : "Page créée en BROUILLON.",
        description: [
          !form.is_published
            ? "Activez l'interrupteur « Publiée » (en haut à droite) pour la rendre visible sur le site."
            : null,
          editor.id && form.slug.trim() !== editor.originalSlug
            ? "Une redirection 301 a été créée depuis l'ancienne adresse."
            : null,
        ]
          .filter(Boolean)
          .join(" "),
      });
      setEditor(null);
      await loadPages();
    } catch (error) {
      toast({
        title: "Enregistrement impossible",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeletePage() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await apiFetch(`/api/admin/pages?id=${encodeURIComponent(deleting.id)}`, {
        method: "DELETE",
      });
      toast({ title: "Page supprimée." });
      setDeleting(null);
      await loadPages();
    } catch (error) {
      toast({
        title: "Suppression impossible",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setDeleteBusy(false);
    }
  }

  const slugChanged =
    editor !== null &&
    editor.id !== null &&
    editor.originalSlug !== null &&
    form.slug.trim() !== editor.originalSlug;

  /**
   * Encadré contextuel : la page ouverte concerne les partenaires ou
   * l'équipe → pointer vers l'onglet dédié (contenus gérés à part).
   */
  const calloutTab: "partners" | "team" | null = (() => {
    const key = `${form.slug} ${form.title}`.toLowerCase();
    if (key.includes("nos-partenaires")) return "partners";
    if (key.includes("notre-equipe")) return "team";
    return null;
  })();

  function goToCalloutTab(value: "partners" | "team") {
    setEditor(null);
    handleTabChange(value);
  }

  // ── Bannières ────────────────────────────────────────────────────────────

  function openCreateBanner() {
    setBannerEditing(null);
    setBannerForm(EMPTY_BANNER_FORM);
    setBannerDialogOpen(true);
  }

  function openEditBanner(banner: BannerRow) {
    setBannerEditing(banner);
    setBannerForm({
      message: banner.message ?? "",
      link_url: banner.link_url ?? "",
      link_label: banner.link_label ?? "",
      style: banner.style ?? "info",
      is_dismissible: Boolean(banner.is_dismissible),
      target_paths: parseTargetPaths(banner.target_paths).join(", "),
      starts_at: toDatetimeLocal(banner.starts_at),
      ends_at: toDatetimeLocal(banner.ends_at),
      is_active: Boolean(banner.is_active),
    });
    setBannerDialogOpen(true);
  }

  function closeBannerDialog() {
    setBannerDialogOpen(false);
    setBannerEditing(null);
    setBannerForm(EMPTY_BANNER_FORM);
  }

  async function saveBanner() {
    const message = bannerForm.message.trim();
    if (!message) {
      toast({ title: "Le message est obligatoire.", variant: "destructive" });
      return;
    }
    const linkUrl = bannerForm.link_url.trim();
    if (linkUrl && !/^https?:\/\/\S+$/.test(linkUrl)) {
      toast({
        title: "Lien invalide",
        description: "Le lien de la bannière doit être une URL valide commençant par http:// ou https:// (ou rester vide).",
        variant: "destructive",
      });
      return;
    }
    setBannerSaving(true);
    try {
      await apiFetch("/api/admin/banners", {
        method: "POST",
        json: {
          kind: "banner",
          ...(bannerEditing ? { id: bannerEditing.id } : {}),
          message,
          link_url: linkUrl || null,
          link_label: bannerForm.link_label.trim() || null,
          style: bannerForm.style,
          is_dismissible: bannerForm.is_dismissible,
          target_paths: splitTargetPaths(bannerForm.target_paths),
          starts_at: fromDatetimeLocal(bannerForm.starts_at),
          ends_at: fromDatetimeLocal(bannerForm.ends_at),
          is_active: bannerForm.is_active,
        },
      });
      toast({
        title: bannerEditing ? "Bannière enregistrée." : "Bannière créée.",
      });
      closeBannerDialog();
      await loadBanners();
    } catch (error) {
      toast({
        title: "Enregistrement impossible",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setBannerSaving(false);
    }
  }

  async function confirmDeleteBanner() {
    if (!bannerDeleting) return;
    setBannerDeleteBusy(true);
    try {
      await apiFetch(
        `/api/admin/banners?kind=banner&id=${encodeURIComponent(bannerDeleting.id)}`,
        { method: "DELETE" }
      );
      toast({ title: "Bannière supprimée." });
      setBannerDeleting(null);
      await loadBanners();
    } catch (error) {
      toast({
        title: "Suppression impossible",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setBannerDeleteBusy(false);
    }
  }

  // ── Redirections ─────────────────────────────────────────────────────────

  function openCreateRedirect() {
    setRedirectEditing(null);
    setRedirectForm(EMPTY_REDIRECT_FORM);
    setRedirectDialogOpen(true);
  }

  function openEditRedirect(row: RedirectRow) {
    setRedirectEditing(row);
    setRedirectForm({
      source_path: row.source_path,
      target_path: row.target_path,
      status_code: String(row.status_code),
    });
    setRedirectDialogOpen(true);
  }

  function closeRedirectDialog() {
    setRedirectDialogOpen(false);
    setRedirectEditing(null);
    setRedirectForm(EMPTY_REDIRECT_FORM);
  }

  async function saveRedirectEntry() {
    const source = previewPath(redirectForm.source_path);
    const target = previewPath(redirectForm.target_path);
    if (!redirectEditing && !source) {
      toast({
        title: "Le chemin source est obligatoire.",
        variant: "destructive",
      });
      return;
    }
    if (!target) {
      toast({
        title: "Le chemin cible est obligatoire.",
        variant: "destructive",
      });
      return;
    }
    if (source === target) {
      toast({
        title: "La source et la cible doivent être différentes.",
        variant: "destructive",
      });
      return;
    }
    setRedirectSaving(true);
    try {
      if (redirectEditing) {
        await apiFetch("/api/admin/redirects", {
          method: "PATCH",
          json: {
            id: redirectEditing.id,
            target_path: target,
            status_code: Number(redirectForm.status_code),
          },
        });
        toast({ title: "Redirection enregistrée." });
      } else {
        await apiFetch("/api/admin/redirects", {
          method: "POST",
          json: {
            source_path: source,
            target_path: target,
            status_code: Number(redirectForm.status_code),
          },
        });
        toast({ title: "Redirection créée." });
      }
      closeRedirectDialog();
      await loadRedirects(redirectsQuery, redirectsPage);
    } catch (error) {
      toast({
        title: "Enregistrement impossible",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setRedirectSaving(false);
    }
  }

  async function confirmDeleteRedirect() {
    if (!redirectDeleting) return;
    setRedirectDeleteBusy(true);
    try {
      await apiFetch(
        `/api/admin/redirects?id=${encodeURIComponent(redirectDeleting.id)}`,
        { method: "DELETE" }
      );
      toast({ title: "Redirection supprimée." });
      setRedirectDeleting(null);
      await loadRedirects(redirectsQuery, redirectsPage);
    } catch (error) {
      toast({
        title: "Suppression impossible",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setRedirectDeleteBusy(false);
    }
  }

  // ── Partenaires (logique) ────────────────────────────────────────────────

  function openCreatePartner() {
    setPartnerEditing(null);
    setPartnerForm(EMPTY_PARTNER_FORM);
    setPartnerDialogOpen(true);
  }

  function openEditPartner(partner: PartnerRow) {
    setPartnerEditing(partner);
    setPartnerForm({
      name: partner.name ?? "",
      category: partner.category ?? "",
      url: partner.url ?? "",
      position: String(partner.position ?? 0),
      is_active: Boolean(partner.is_active),
      logo_media_id: partner.logo_media_id,
      logo_preview_url: partner.logo_url,
    });
    setPartnerDialogOpen(true);
  }

  function closePartnerDialog() {
    setPartnerDialogOpen(false);
    setPartnerEditing(null);
    setPartnerForm(EMPTY_PARTNER_FORM);
  }

  async function savePartner() {
    const name = partnerForm.name.trim();
    if (!name) {
      toast({ title: "Le nom est obligatoire.", variant: "destructive" });
      return;
    }
    const url = partnerForm.url.trim();
    if (url && !HTTP_URL_RE.test(url)) {
      toast({
        title: "Lien invalide",
        description:
          "Le lien web doit commencer par http:// ou https:// (ou rester vide).",
        variant: "destructive",
      });
      return;
    }
    setPartnerSaving(true);
    try {
      const payload = {
        name,
        category: partnerForm.category.trim() || null,
        url: url || null,
        logo_media_id: partnerForm.logo_media_id,
        position: parsePosition(partnerForm.position),
        is_active: partnerForm.is_active,
      };
      if (partnerEditing) {
        await apiFetch(
          `/api/admin/partners/${encodeURIComponent(partnerEditing.id)}`,
          { method: "PATCH", json: payload }
        );
        toast({ title: "Partenaire enregistré." });
      } else {
        await apiFetch("/api/admin/partners", {
          method: "POST",
          json: payload,
        });
        toast({ title: "Partenaire créé." });
      }
      closePartnerDialog();
      await loadPartners();
    } catch (error) {
      toast({
        title: "Enregistrement impossible",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setPartnerSaving(false);
    }
  }

  async function togglePartnerActive(partner: PartnerRow, checked: boolean) {
    setPartnerTogglingId(partner.id);
    try {
      await apiFetch(
        `/api/admin/partners/${encodeURIComponent(partner.id)}`,
        { method: "PATCH", json: { is_active: checked } }
      );
      setPartners((rows) =>
        rows
          ? rows.map((row) =>
              row.id === partner.id ? { ...row, is_active: checked } : row
            )
          : rows
      );
      toast({ title: checked ? "Partenaire activé." : "Partenaire masqué." });
    } catch (error) {
      toast({
        title: "Action impossible",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setPartnerTogglingId(null);
    }
  }

  async function confirmDeletePartner() {
    if (!partnerDeleting) return;
    setPartnerDeleteBusy(true);
    try {
      await apiFetch(
        `/api/admin/partners/${encodeURIComponent(partnerDeleting.id)}`,
        { method: "DELETE" }
      );
      toast({ title: "Partenaire supprimé." });
      setPartnerDeleting(null);
      await loadPartners();
    } catch (error) {
      toast({
        title: "Suppression impossible",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setPartnerDeleteBusy(false);
    }
  }

  // ── Équipe (logique) ─────────────────────────────────────────────────────

  function openCreateTeamMember() {
    setTeamEditing(null);
    setTeamForm(EMPTY_TEAM_FORM);
    setTeamDialogOpen(true);
  }

  function openEditTeamMember(member: TeamMemberRow) {
    setTeamEditing(member);
    setTeamForm({
      name: member.name ?? "",
      role: member.role ?? "",
      bio: member.bio ?? "",
      email: member.email ?? "",
      position: String(member.position ?? 0),
      is_active: Boolean(member.is_active),
      photo_media_id: member.photo_media_id,
      photo_preview_url: member.photo_url,
    });
    setTeamDialogOpen(true);
  }

  function closeTeamDialog() {
    setTeamDialogOpen(false);
    setTeamEditing(null);
    setTeamForm(EMPTY_TEAM_FORM);
  }

  async function saveTeamMember() {
    const name = teamForm.name.trim();
    if (!name) {
      toast({ title: "Le nom est obligatoire.", variant: "destructive" });
      return;
    }
    const role = teamForm.role.trim();
    if (!role) {
      toast({ title: "La fonction est obligatoire.", variant: "destructive" });
      return;
    }
    const email = teamForm.email.trim();
    if (email && !EMAIL_RE.test(email)) {
      toast({
        title: "Adresse e-mail invalide",
        description: "Saisissez une adresse valide (ou laissez le champ vide).",
        variant: "destructive",
      });
      return;
    }
    setTeamSaving(true);
    try {
      const payload = {
        name,
        role,
        bio: teamForm.bio.trim() || null,
        email: email || null,
        photo_media_id: teamForm.photo_media_id,
        position: parsePosition(teamForm.position),
        is_active: teamForm.is_active,
      };
      if (teamEditing) {
        await apiFetch(
          `/api/admin/team/${encodeURIComponent(teamEditing.id)}`,
          { method: "PATCH", json: payload }
        );
        toast({ title: "Membre enregistré." });
      } else {
        await apiFetch("/api/admin/team", { method: "POST", json: payload });
        toast({ title: "Membre ajouté à l'équipe." });
      }
      closeTeamDialog();
      await loadTeam();
    } catch (error) {
      toast({
        title: "Enregistrement impossible",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setTeamSaving(false);
    }
  }

  async function toggleTeamActive(member: TeamMemberRow, checked: boolean) {
    setTeamTogglingId(member.id);
    try {
      await apiFetch(`/api/admin/team/${encodeURIComponent(member.id)}`, {
        method: "PATCH",
        json: { is_active: checked },
      });
      setTeam((rows) =>
        rows
          ? rows.map((row) =>
              row.id === member.id ? { ...row, is_active: checked } : row
            )
          : rows
      );
      toast({
        title: checked
          ? "Membre affiché sur le site."
          : "Membre masqué du site.",
      });
    } catch (error) {
      toast({
        title: "Action impossible",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setTeamTogglingId(null);
    }
  }

  async function confirmDeleteTeamMember() {
    if (!teamDeleting) return;
    setTeamDeleteBusy(true);
    try {
      await apiFetch(`/api/admin/team/${encodeURIComponent(teamDeleting.id)}`, {
        method: "DELETE",
      });
      toast({ title: "Membre supprimé." });
      setTeamDeleting(null);
      await loadTeam();
    } catch (error) {
      toast({
        title: "Suppression impossible",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setTeamDeleteBusy(false);
    }
  }

  const redirectsPageCount = Math.max(
    1,
    Math.ceil(redirectsTotal / REDIRECT_PAGE_SIZE)
  );

  // ── Rendu ────────────────────────────────────────────────────────────────

  return (
    <>
      <Tabs
        value={tab}
        onValueChange={handleTabChange}
        className="space-y-4"
      >
        <TabsList aria-label="Sections de l'écran">
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="banners">Bannières</TabsTrigger>
          <TabsTrigger value="redirects">Redirections</TabsTrigger>
          <TabsTrigger value="partners">Partenaires</TabsTrigger>
          <TabsTrigger value="team">Équipe</TabsTrigger>
        </TabsList>

        {/* ── Onglet Pages ─────────────────────────────────────────────── */}
        <TabsContent value="pages" className="space-y-4">
          {editor === null ? (
            <section
              aria-label="Liste des pages"
              className="border border-rule bg-paper"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3">
                <div>
                  <h2 className="font-serif text-lg font-semibold">
                    Pages statiques
                  </h2>
                  <p className="text-xs text-ink-faint">
                    {pages === null
                      ? "Chargement…"
                      : `${pages.length} page${pages.length > 1 ? "s" : ""}`}
                  </p>
                </div>
                <Button size="sm" onClick={openCreatePage}>
                  <Plus aria-hidden />
                  Nouvelle page
                </Button>
              </div>

              {pages === null ? (
                pagesError ? (
                  <LoadErrorCard onRetry={() => void loadPages()} />
                ) : (
                  <ListSkeleton />
                )
              ) : pages.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
                  <FileText className="h-8 w-8 text-ink-faint" aria-hidden />
                  <p className="text-sm text-ink-soft">
                    Aucune page pour le moment. Créez la première page du site
                    (à propos, contact, mentions légales…).
                  </p>
                  <Button size="sm" variant="outline" onClick={openCreatePage}>
                    <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                    Nouvelle page
                  </Button>
                </div>
              ) : (
                <div className="max-h-[34rem] overflow-y-auto">
                  <ul className="divide-y divide-rule">
                    {pages.map((page) => (
                      <li
                        key={page.id}
                        className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-paper-alt sm:flex-row sm:items-center sm:gap-4"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {page.title}
                          </p>
                          <p className="truncate font-mono text-xs text-ink-faint">
                            /{page.slug}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="font-normal">
                            {TEMPLATE_LABELS[page.template] ?? page.template}
                          </Badge>
                          {page.is_published ? (
                            <Badge className="border-success/30 bg-success/10 text-success">
                              Publiée
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-ink-faint"
                            >
                              Brouillon
                            </Badge>
                          )}
                          <span className="hidden text-xs text-ink-faint lg:inline">
                            maj {formatDate(page.updated_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => void openEditPage(page.id)}
                            aria-label={`Modifier la page ${page.title}`}
                          >
                            <Pencil aria-hidden />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-danger hover:bg-red-wash hover:text-danger"
                            onClick={() => setDeleting(page)}
                            aria-label={`Supprimer la page ${page.title}`}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          ) : (
            <section
              aria-label="Éditeur de page"
              className="border border-rule bg-paper"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditor(null)}
                    disabled={saving}
                    aria-label="Retour à la liste des pages"
                  >
                    <ArrowLeft aria-hidden />
                    <span className="hidden sm:inline">Retour</span>
                  </Button>
                  <h2 className="font-serif text-lg font-semibold">
                    {editor.id ? "Modifier la page" : "Nouvelle page"}
                  </h2>
                  {editor.loading ? (
                    <Loader2
                      className="h-4 w-4 animate-spin text-ink-faint"
                      aria-hidden
                    />
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="page-published"
                    className="text-xs text-ink-soft"
                  >
                    Publiée
                  </Label>
                  <Switch
                    id="page-published"
                    checked={form.is_published}
                    onCheckedChange={(checked) =>
                      setForm((f) => ({ ...f, is_published: checked }))
                    }
                  />
                </div>
              </div>

              {editor.loading ? (
                <div className="space-y-4 p-4 lg:p-6" aria-hidden>
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-2/3" />
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : (
                <div className="space-y-5 p-4 lg:p-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="page-title">
                        Titre <span className="text-brand-red">*</span>
                      </Label>
                      <Input
                        id="page-title"
                        value={form.title}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, title: e.target.value }))
                        }
                        placeholder="Ex. : À propos d'INFOSPRO"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="page-template">Modèle <span className="font-normal text-ink-faint">(réservé à un usage futur — sans effet actuellement)</span></Label>
                      <Select
                        value={form.template}
                        onValueChange={(value) =>
                          setForm((f) => ({ ...f, template: value }))
                        }
                      >
                        <SelectTrigger
                          id="page-template"
                          aria-label="Modèle de page"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TEMPLATES.map((template) => (
                            <SelectItem
                              key={template.value}
                              value={template.value}
                            >
                              {template.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="page-slug">Slug (adresse)</Label>
                      <Input
                        id="page-slug"
                        value={form.slug}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, slug: e.target.value }))
                        }
                        placeholder="a-propos"
                        className="font-mono"
                      />
                      {slugChanged ? (
                        <p className="text-xs text-warning" role="status">
                          La modification du slug créera automatiquement une
                          redirection 301 depuis l&apos;ancienne adresse.
                        </p>
                      ) : (
                        <p className="text-xs text-ink-faint">
                          Laissez vide pour générer l&apos;adresse depuis le
                          titre.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Contenu de la page</Label>
                    <p className="text-xs text-ink-faint">
                      Rédigez librement : texte, images, titres — comme dans
                      Word.
                    </p>
                    {["contact", "publicite", "newsletters"].includes(form.slug) && (
                      <p className="rounded-md border border-amber-400/60 bg-amber-50/60 px-3 py-2 text-xs leading-relaxed text-ink-soft">
                        ⚠️ Page spéciale : une fois <strong>publiée</strong>, cette
                        page remplace la page « {form.slug} » par défaut du site
                        {form.slug === "newsletters"
                          ? " (y compris le formulaire d'inscription à la newsletter)"
                          : ""}
                        . Si vous la dépubliez ou la supprimez, le site affichera à
                        nouveau la page par défaut
                        {form.slug === "contact"
                          ? " (coordonnées définies dans Paramètres)"
                          : ""}
                        .
                      </p>
                    )}
                    <SimpleEditor
                      initialHtml={pageHtml}
                      onChange={setPageHtml}
                      labels={{
                        insertVideo: "Insérer une vidéo",
                        videoUrl: "URL de la vidéo",
                        confirm: "Insérer",
                        cancel: "Annuler",
                        pickImage: "Choisir une image (médiathèque)",
                      }}
                    />
                  </div>

                  {calloutTab !== null ? (
                    <div
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-rule bg-paper-sunk px-4 py-3"
                      role="note"
                    >
                      <p className="text-sm text-ink-soft">
                        {calloutTab === "partners"
                          ? "Logos et noms des partenaires : onglet « Partenaires »."
                          : "Photos, noms et fonctions de l'équipe : onglet « Équipe »."}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToCalloutTab(calloutTab)}
                      >
                        {calloutTab === "partners"
                          ? "Gérer les partenaires"
                          : "Gérer l'équipe"}
                        <ArrowRight aria-hidden />
                      </Button>
                    </div>
                  ) : null}

                  <div className="flex items-center justify-end gap-2 border-t border-rule pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setEditor(null)}
                      disabled={saving}
                    >
                      Annuler
                    </Button>
                    <Button
                      onClick={() => void savePage()}
                      disabled={saving || form.title.trim().length === 0}
                    >
                      {saving ? (
                        <Loader2 className="animate-spin" aria-hidden />
                      ) : (
                        <Save aria-hidden />
                      )}
                      {editor.id ? "Enregistrer" : "Créer la page"}
                    </Button>
                  </div>
                </div>
              )}
            </section>
          )}
        </TabsContent>

        {/* ── Onglet Bannières ─────────────────────────────────────────── */}
        <TabsContent value="banners" className="space-y-4">
          <section
            aria-label="Liste des bannières"
            className="border border-rule bg-paper"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3">
              <div>
                <h2 className="font-serif text-lg font-semibold">
                  Bannières du site
                </h2>
                <p className="text-xs text-ink-faint">
                  Bandeaux affichés en tête du site public.
                </p>
              </div>
              <Button size="sm" onClick={openCreateBanner}>
                <Plus aria-hidden />
                Nouvelle bannière
              </Button>
            </div>

            {banners === null ? (
              bannersError ? (
                <LoadErrorCard onRetry={() => void loadBanners()} />
              ) : (
                <ListSkeleton />
              )
            ) : banners.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
                <Megaphone className="h-8 w-8 text-ink-faint" aria-hidden />
                <p className="text-sm text-ink-soft">
                  Aucune bannière. Créez un bandeau d&apos;alerte,
                  d&apos;information ou promotionnel.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openCreateBanner}
                >
                  <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                  Nouvelle bannière
                </Button>
              </div>
            ) : (
              <div className="max-h-[34rem] overflow-y-auto">
                <ul className="divide-y divide-rule">
                  {banners.map((banner) => {
                    const paths = parseTargetPaths(banner.target_paths);
                    return (
                      <li
                        key={banner.id}
                        className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-paper-alt sm:flex-row sm:items-center sm:gap-4"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {banner.message}
                          </p>
                          <p className="truncate text-xs text-ink-faint">
                            {bannerPeriod(banner)}
                            {paths.length > 0
                              ? ` · ${paths.length} chemin${paths.length > 1 ? "s" : ""} ciblé${paths.length > 1 ? "s" : ""}`
                              : " · tout le site"}
                            {banner.link_url
                              ? ` · lien : ${banner.link_label || banner.link_url}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            className={
                              BANNER_STYLE_BADGES[banner.style] ??
                              BANNER_STYLE_BADGES.info
                            }
                          >
                            {banner.style === "alert"
                              ? "Alerte"
                              : banner.style === "promo"
                                ? "Promo"
                                : "Info"}
                          </Badge>
                          {banner.is_active ? (
                            <Badge className="border-success/30 bg-success/10 text-success">
                              Active
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-ink-faint"
                            >
                              <EyeOff
                                className="mr-1 h-3 w-3"
                                aria-hidden
                              />
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditBanner(banner)}
                            aria-label={`Modifier la bannière : ${banner.message}`}
                          >
                            <Pencil aria-hidden />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-danger hover:bg-red-wash hover:text-danger"
                            onClick={() => setBannerDeleting(banner)}
                            aria-label={`Supprimer la bannière : ${banner.message}`}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        </TabsContent>

        {/* ── Onglet Redirections ──────────────────────────────────────── */}
        <TabsContent value="redirects" className="space-y-4">
          <section
            aria-label="Liste des redirections"
            className="border border-rule bg-paper"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3">
              <div>
                <h2 className="font-serif text-lg font-semibold">
                  Redirections
                </h2>
                <p className="text-xs text-ink-faint">
                  Les renommages de pages et de rubriques créent des
                  redirections automatiques ; ajoutez ici les vôtres.
                </p>
              </div>
              <Button size="sm" onClick={openCreateRedirect}>
                <Plus aria-hidden />
                Nouvelle redirection
              </Button>
            </div>

            <div className="border-b border-rule px-4 py-3">
              <div className="relative max-w-sm">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
                  aria-hidden
                />
                <Input
                  value={redirectsQuery}
                  onChange={(e) => {
                    setRedirectsQuery(e.target.value);
                    setRedirectsPage(1);
                  }}
                  placeholder="Rechercher une source ou une cible…"
                  aria-label="Rechercher une redirection"
                  className="pl-8"
                />
              </div>
            </div>

            {redirects === null ? (
              redirectsError ? (
                <LoadErrorCard
                  onRetry={() => void loadRedirects(redirectsQuery, redirectsPage)}
                />
              ) : (
                <ListSkeleton />
              )
            ) : redirects.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
                <ArrowRightLeft
                  className="h-8 w-8 text-ink-faint"
                  aria-hidden
                />
                {redirectsQuery.trim() ? (
                  <>
                    <p className="text-sm text-ink-soft">
                      Aucune redirection ne correspond à la recherche.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setRedirectsQuery("");
                        setRedirectsPage(1);
                      }}
                    >
                      Effacer la recherche
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-ink-soft">
                      Aucune redirection. Les renommages en créent
                      automatiquement ; vous pouvez aussi en ajouter
                      manuellement.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={openCreateRedirect}
                    >
                      <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                      Nouvelle redirection
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                <ul className="divide-y divide-rule">
                  {redirects.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-paper-alt sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex min-w-0 items-center gap-1.5 font-mono text-sm">
                          <span className="truncate">{row.source_path}</span>
                          <ArrowRight
                            className="h-3.5 w-3.5 shrink-0 text-ink-faint"
                            aria-hidden
                          />
                          <span className="truncate">{row.target_path}</span>
                        </p>
                        <p className="truncate text-xs text-ink-faint">
                          créée le {formatDate(row.created_at)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          className={
                            REDIRECT_CODE_BADGES[row.status_code] ??
                            REDIRECT_CODE_BADGES[301]
                          }
                        >
                          {row.status_code} ·{" "}
                          {REDIRECT_CODE_LABELS[row.status_code] ??
                            row.status_code}
                        </Badge>
                        {row.is_auto ? (
                          <Badge
                            variant="outline"
                            className="text-ink-soft"
                            title="Créée automatiquement lors d'un renommage : non supprimable."
                          >
                            Auto
                          </Badge>
                        ) : null}
                        {row.hit_count > 0 ? (
                          <Badge
                            variant="outline"
                            className="font-normal text-ink-soft"
                          >
                            {row.hit_count} utilisation
                            {row.hit_count > 1 ? "s" : ""}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditRedirect(row)}
                          aria-label={`Modifier la redirection ${row.source_path}`}
                        >
                          <Pencil aria-hidden />
                        </Button>
                        {row.is_auto ? null : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-danger hover:bg-red-wash hover:text-danger"
                            onClick={() => setRedirectDeleting(row)}
                            aria-label={`Supprimer la redirection ${row.source_path}`}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {redirects !== null && redirectsTotal > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule px-4 py-3">
                <p className="text-xs text-ink-faint" aria-live="polite">
                  {redirectsQuery.trim()
                    ? `${redirectsTotal} résultat${redirectsTotal > 1 ? "s" : ""}`
                    : `${redirectsTotal} redirection${redirectsTotal > 1 ? "s" : ""}`}
                  {redirectsPageCount > 1
                    ? ` · page ${redirectsPage} / ${redirectsPageCount}`
                    : ""}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={redirectsPage <= 1}
                    onClick={() =>
                      setRedirectsPage((p) => Math.max(1, p - 1))
                    }
                  >
                    Précédent
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={redirectsPage >= redirectsPageCount}
                    onClick={() =>
                      setRedirectsPage((p) => Math.min(redirectsPageCount, p + 1))
                    }
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            ) : null}
          </section>
        </TabsContent>

        {/* ── Onglet Partenaires ──────────────────────────────────────── */}
        <TabsContent value="partners" className="space-y-4">
          <section
            aria-label="Liste des partenaires"
            className="border border-rule bg-paper"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3">
              <div>
                <h2 className="font-serif text-lg font-semibold">
                  Partenaires
                </h2>
                <p className="text-xs text-ink-faint">
                  Nom, logo et lien de chaque partenaire — ils défilent
                  automatiquement sur le site.
                </p>
              </div>
              <Button size="sm" onClick={openCreatePartner}>
                <Plus aria-hidden />
                Ajouter un partenaire
              </Button>
            </div>

            {partners === null ? (
              partnersError ? (
                <LoadErrorCard onRetry={() => void loadPartners()} />
              ) : (
                <ListSkeleton />
              )
            ) : partners.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
                <Handshake className="h-8 w-8 text-ink-faint" aria-hidden />
                <p className="text-sm text-ink-soft">
                  Aucun partenaire. Ajoutez les institutions, médias et
                  entreprises qui soutiennent le journal.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openCreatePartner}
                >
                  <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                  Ajouter un partenaire
                </Button>
              </div>
            ) : (
              <div className="max-h-[34rem] overflow-y-auto">
                <ul className="divide-y divide-rule">
                  {partners.map((partner) => (
                    <li
                      key={partner.id}
                      className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-paper-alt sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        {partner.logo_url ? (
                          <img
                            src={partner.logo_url}
                            alt={`Logo ${partner.name}`}
                            className="h-10 w-10 shrink-0 rounded-sm border border-rule bg-paper-sunk object-contain p-0.5"
                            loading="lazy"
                          />
                        ) : (
                          <span
                            aria-hidden
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-rule bg-paper-sunk text-xs font-bold uppercase text-ink-soft"
                          >
                            {initials(partner.name)}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {partner.name}
                          </p>
                          <p
                            className="truncate font-mono text-xs text-ink-faint"
                            title={partner.url ?? undefined}
                          >
                            {partner.url ?? "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {partner.category ? (
                          <Badge
                            variant="outline"
                            className="font-normal text-ink-soft"
                          >
                            {partner.category}
                          </Badge>
                        ) : null}
                        <Badge
                          variant="outline"
                          className="font-normal text-ink-faint"
                        >
                          n° {partner.position}
                        </Badge>
                        <Switch
                          checked={partner.is_active}
                          onCheckedChange={(checked) =>
                            void togglePartnerActive(partner, checked)
                          }
                          disabled={partnerTogglingId === partner.id}
                          aria-label={
                            partner.is_active
                              ? `Masquer le partenaire ${partner.name}`
                              : `Afficher le partenaire ${partner.name}`
                          }
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditPartner(partner)}
                          aria-label={`Modifier le partenaire ${partner.name}`}
                        >
                          <Pencil aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-danger hover:bg-red-wash hover:text-danger"
                          onClick={() => setPartnerDeleting(partner)}
                          aria-label={`Supprimer le partenaire ${partner.name}`}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </TabsContent>

        {/* ── Onglet Équipe ───────────────────────────────────────────── */}
        <TabsContent value="team" className="space-y-4">
          <section
            aria-label="Liste des membres de l'équipe"
            className="border border-rule bg-paper"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3">
              <div>
                <h2 className="font-serif text-lg font-semibold">
                  Équipe de la rédaction
                </h2>
                <p className="text-xs text-ink-faint">
                  Photo, fonction et bio de chaque membre — affichés sur la
                  page « Notre équipe ».
                </p>
              </div>
              <Button size="sm" onClick={openCreateTeamMember}>
                <Plus aria-hidden />
                Ajouter un membre
              </Button>
            </div>

            {team === null ? (
              teamError ? (
                <LoadErrorCard onRetry={() => void loadTeam()} />
              ) : (
                <ListSkeleton />
              )
            ) : team.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
                <Users className="h-8 w-8 text-ink-faint" aria-hidden />
                <p className="text-sm text-ink-soft">
                  Aucun membre. Ajoutez les journalistes et collaborateurs de
                  la rédaction.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openCreateTeamMember}
                >
                  <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                  Ajouter un membre
                </Button>
              </div>
            ) : (
              <div className="max-h-[34rem] overflow-y-auto">
                <ul className="divide-y divide-rule">
                  {team.map((member) => (
                    <li
                      key={member.id}
                      className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-paper-alt sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        {member.photo_url ? (
                          <img
                            src={member.photo_url}
                            alt={`Photo de ${member.name}`}
                            className="h-10 w-10 shrink-0 rounded-full border border-rule bg-paper-sunk object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span
                            aria-hidden
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-rule bg-paper-sunk text-xs font-bold uppercase text-ink-soft"
                          >
                            {initials(member.name)}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {member.name}
                          </p>
                          <p className="truncate text-xs text-ink-faint">
                            {member.role}
                            {member.email ? ` · ${member.email}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className="font-normal text-ink-faint"
                        >
                          n° {member.position}
                        </Badge>
                        <Switch
                          checked={member.is_active}
                          onCheckedChange={(checked) =>
                            void toggleTeamActive(member, checked)
                          }
                          disabled={teamTogglingId === member.id}
                          aria-label={
                            member.is_active
                              ? `Masquer ${member.name} du site`
                              : `Afficher ${member.name} sur le site`
                          }
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditTeamMember(member)}
                          aria-label={`Modifier le membre ${member.name}`}
                        >
                          <Pencil aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-danger hover:bg-red-wash hover:text-danger"
                          onClick={() => setTeamDeleting(member)}
                          aria-label={`Supprimer le membre ${member.name}`}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </TabsContent>
      </Tabs>

      {/* ── Dialogue bannière (création / édition) ─────────────────────── */}
      <Dialog
        open={bannerDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeBannerDialog();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {bannerEditing ? "Modifier la bannière" : "Nouvelle bannière"}
            </DialogTitle>
            <DialogDescription>
              Bandeau affiché en tête du site public. Le style « alerte »
              utilise le rouge de marque.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="banner-message">
                Message <span className="text-brand-red">*</span>
              </Label>
              <Textarea
                id="banner-message"
                rows={2}
                value={bannerForm.message}
                onChange={(e) =>
                  setBannerForm((f) => ({ ...f, message: e.target.value }))
                }
                placeholder="Ex. : Nos rédactions seront fermées du 24 au 26 décembre."
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="banner-link-url">Lien (URL)</Label>
                <Input
                  id="banner-link-url"
                  value={bannerForm.link_url}
                  onChange={(e) =>
                    setBannerForm((f) => ({ ...f, link_url: e.target.value }))
                  }
                  placeholder="/special/abonnement"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="banner-link-label">Libellé du lien</Label>
                <Input
                  id="banner-link-label"
                  value={bannerForm.link_label}
                  onChange={(e) =>
                    setBannerForm((f) => ({
                      ...f,
                      link_label: e.target.value,
                    }))
                  }
                  placeholder="En savoir plus"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="banner-style">Style</Label>
              <Select
                value={bannerForm.style}
                onValueChange={(value) =>
                  setBannerForm((f) => ({ ...f, style: value }))
                }
              >
                <SelectTrigger id="banner-style" aria-label="Style de bannière">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BANNER_STYLES.map((style) => (
                    <SelectItem key={style.value} value={style.value}>
                      {style.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="banner-paths">Chemins ciblés</Label>
              <Input
                id="banner-paths"
                value={bannerForm.target_paths}
                onChange={(e) =>
                  setBannerForm((f) => ({
                    ...f,
                    target_paths: e.target.value,
                  }))
                }
                placeholder="/, /politique, /economie"
                className="font-mono"
              />
              <p className="text-xs text-ink-faint">
                Chemins où afficher la bannière, séparés par des virgules.
                Vide = tout le site.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="banner-starts">Début d&apos;affichage</Label>
                <Input
                  id="banner-starts"
                  type="datetime-local"
                  value={bannerForm.starts_at}
                  onChange={(e) =>
                    setBannerForm((f) => ({
                      ...f,
                      starts_at: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="banner-ends">Fin d&apos;affichage</Label>
                <Input
                  id="banner-ends"
                  type="datetime-local"
                  value={bannerForm.ends_at}
                  onChange={(e) =>
                    setBannerForm((f) => ({ ...f, ends_at: e.target.value }))
                  }
                />
              </div>
              <p className="text-xs text-ink-faint sm:col-span-2">
                Fenêtre d&apos;affichage facultative. Vide = affichage
                permanent.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-md border border-rule p-3">
                <Label
                  htmlFor="banner-dismissible"
                  className="text-sm font-normal"
                >
                  Refermable par le lecteur
                </Label>
                <Switch
                  id="banner-dismissible"
                  checked={bannerForm.is_dismissible}
                  onCheckedChange={(checked) =>
                    setBannerForm((f) => ({ ...f, is_dismissible: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-md border border-rule p-3">
                <Label htmlFor="banner-active" className="text-sm font-normal">
                  Active
                </Label>
                <Switch
                  id="banner-active"
                  checked={bannerForm.is_active}
                  onCheckedChange={(checked) =>
                    setBannerForm((f) => ({ ...f, is_active: checked }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeBannerDialog}
              disabled={bannerSaving}
            >
              Annuler
            </Button>
            <Button
              onClick={() => void saveBanner()}
              disabled={bannerSaving || bannerForm.message.trim().length === 0}
            >
              {bannerSaving ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : null}
              {bannerEditing ? "Enregistrer" : "Créer la bannière"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialogue redirection (création / édition) ──────────────────── */}
      <Dialog
        open={redirectDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeRedirectDialog();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {redirectEditing
                ? "Modifier la redirection"
                : "Nouvelle redirection"}
            </DialogTitle>
            <DialogDescription>
              Les visiteurs qui ouvrent l&apos;adresse source sont renvoyés
              vers la cible. 301 = permanente (moteurs de recherche), 302 =
              temporaire.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="redirect-source">
                Adresse source <span className="text-brand-red">*</span>
              </Label>
              <Input
                id="redirect-source"
                value={redirectForm.source_path}
                onChange={(e) =>
                  setRedirectForm((f) => ({
                    ...f,
                    source_path: e.target.value,
                  }))
                }
                placeholder="ancienne-adresse"
                className="font-mono"
                disabled={redirectEditing !== null}
                required
              />
              {previewPath(redirectForm.source_path) ? (
                <p className="font-mono text-xs text-ink-faint" role="status">
                  Aperçu : {previewPath(redirectForm.source_path)}
                </p>
              ) : (
                <p className="text-xs text-ink-faint">
                  {redirectEditing
                    ? "L'adresse source ne peut pas être modifiée. Supprimez la redirection pour en recréer une."
                    : "Le « / » initial est ajouté automatiquement."}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="redirect-target">
                Adresse cible <span className="text-brand-red">*</span>
              </Label>
              <Input
                id="redirect-target"
                value={redirectForm.target_path}
                onChange={(e) =>
                  setRedirectForm((f) => ({
                    ...f,
                    target_path: e.target.value,
                  }))
                }
                placeholder="nouvelle-adresse"
                className="font-mono"
                required
              />
              {previewPath(redirectForm.target_path) ? (
                <p className="font-mono text-xs text-ink-faint" role="status">
                  Aperçu : {previewPath(redirectForm.target_path)}
                </p>
              ) : (
                <p className="text-xs text-ink-faint">
                  Le « / » initial est ajouté automatiquement.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="redirect-status">Type de redirection</Label>
              <Select
                value={redirectForm.status_code}
                onValueChange={(value) =>
                  setRedirectForm((f) => ({ ...f, status_code: value }))
                }
              >
                <SelectTrigger
                  id="redirect-status"
                  aria-label="Type de redirection"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="301">301 — Permanente</SelectItem>
                  <SelectItem value="302">302 — Temporaire</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeRedirectDialog}
              disabled={redirectSaving}
            >
              Annuler
            </Button>
            <Button
              onClick={() => void saveRedirectEntry()}
              disabled={
                redirectSaving ||
                (redirectEditing === null &&
                  redirectForm.source_path.trim().length === 0) ||
                redirectForm.target_path.trim().length === 0
              }
            >
              {redirectSaving ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : null}
              {redirectEditing ? "Enregistrer" : "Créer la redirection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialogue partenaire (création / édition) ─────────────────── */}
      <Dialog
        open={partnerDialogOpen}
        onOpenChange={(open) => {
          if (!open) closePartnerDialog();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {partnerEditing ? "Modifier le partenaire" : "Nouveau partenaire"}
            </DialogTitle>
            <DialogDescription>
              Nom, logo et lien affichés sur la page « Nos partenaires » et
              dans le défilement automatique du site.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="partner-name">
                Nom <span className="text-brand-red">*</span>
              </Label>
              <Input
                id="partner-name"
                value={partnerForm.name}
                onChange={(e) =>
                  setPartnerForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Ex. : Fondation INFOSPRO"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="partner-category">Catégorie</Label>
              <Input
                id="partner-category"
                value={partnerForm.category}
                onChange={(e) =>
                  setPartnerForm((f) => ({ ...f, category: e.target.value }))
                }
                placeholder="Institutions, Médias, Entreprises…"
              />
              <p className="text-xs text-ink-faint">
                Catégorie libre utilisée pour grouper les partenaires sur la
                page publique.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="partner-url">Lien web</Label>
              <Input
                id="partner-url"
                value={partnerForm.url}
                onChange={(e) =>
                  setPartnerForm((f) => ({ ...f, url: e.target.value }))
                }
                placeholder="https://www.exemple.com"
                className="font-mono"
              />
              <p className="text-xs text-ink-faint">
                URL optionnelle commençant par http:// ou https://.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Logo</Label>
              {partnerForm.logo_preview_url ? (
                <div className="flex items-center gap-4 rounded-md border border-rule p-3">
                  <img
                    src={partnerForm.logo_preview_url}
                    alt="Aperçu du logo"
                    className="h-16 w-16 shrink-0 object-contain"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPartnerPickerOpen(true)}
                    >
                      Changer
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger hover:bg-red-wash hover:text-danger"
                      onClick={() =>
                        setPartnerForm((f) => ({
                          ...f,
                          logo_media_id: null,
                          logo_preview_url: null,
                        }))
                      }
                    >
                      Retirer
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPartnerPickerOpen(true)}
                  className="flex w-full flex-col items-center gap-2 rounded-md border border-dashed border-rule bg-paper-alt px-4 py-8 text-ink-soft transition-colors hover:border-brand-red hover:text-ink"
                >
                  <ImageIcon className="h-6 w-6" aria-hidden />
                  <span className="text-sm">
                    Choisir le logo (médiathèque)
                  </span>
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="partner-position">Position</Label>
                <Input
                  id="partner-position"
                  type="number"
                  min={0}
                  value={partnerForm.position}
                  onChange={(e) =>
                    setPartnerForm((f) => ({
                      ...f,
                      position: e.target.value,
                    }))
                  }
                  className="w-24"
                />
                <p className="text-xs text-ink-faint">
                  Ordre d&apos;affichage croissant.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-md border border-rule p-3">
                <Label htmlFor="partner-active" className="text-sm font-normal">
                  Actif
                </Label>
                <Switch
                  id="partner-active"
                  checked={partnerForm.is_active}
                  onCheckedChange={(checked) =>
                    setPartnerForm((f) => ({ ...f, is_active: checked }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closePartnerDialog}
              disabled={partnerSaving}
            >
              Annuler
            </Button>
            <Button
              onClick={() => void savePartner()}
              disabled={partnerSaving || partnerForm.name.trim().length === 0}
            >
              {partnerSaving ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : null}
              {partnerEditing ? "Enregistrer" : "Ajouter le partenaire"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MediaPicker
        open={partnerPickerOpen}
        onOpenChange={setPartnerPickerOpen}
        filterType="image"
        title="Choisir le logo"
        onSelect={(media) =>
          setPartnerForm((f) => ({
            ...f,
            logo_media_id: media.id,
            logo_preview_url: media.url,
          }))
        }
      />

      {/* ── Dialogue membre de l'équipe (création / édition) ─────────── */}
      <Dialog
        open={teamDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeTeamDialog();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {teamEditing ? "Modifier le membre" : "Nouveau membre"}
            </DialogTitle>
            <DialogDescription>
              Photo, fonction et bio affichés sur la page « Notre équipe ».
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Photo</Label>
              {teamForm.photo_preview_url ? (
                <div className="flex items-center gap-4 rounded-md border border-rule p-3">
                  <img
                    src={teamForm.photo_preview_url}
                    alt="Aperçu de la photo"
                    className="h-16 w-16 shrink-0 rounded-full object-cover"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTeamPickerOpen(true)}
                    >
                      Changer
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger hover:bg-red-wash hover:text-danger"
                      onClick={() =>
                        setTeamForm((f) => ({
                          ...f,
                          photo_media_id: null,
                          photo_preview_url: null,
                        }))
                      }
                    >
                      Retirer
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setTeamPickerOpen(true)}
                  className="flex w-full flex-col items-center gap-2 rounded-md border border-dashed border-rule bg-paper-alt px-4 py-8 text-ink-soft transition-colors hover:border-brand-red hover:text-ink"
                >
                  <ImageIcon className="h-6 w-6" aria-hidden />
                  <span className="text-sm">
                    Choisir la photo (médiathèque)
                  </span>
                </button>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="team-name">
                  Nom <span className="text-brand-red">*</span>
                </Label>
                <Input
                  id="team-name"
                  value={teamForm.name}
                  onChange={(e) =>
                    setTeamForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Ex. : Awa GBESSI"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="team-role">
                  Fonction <span className="text-brand-red">*</span>
                </Label>
                <Input
                  id="team-role"
                  value={teamForm.role}
                  onChange={(e) =>
                    setTeamForm((f) => ({ ...f, role: e.target.value }))
                  }
                  placeholder="Rédactrice en chef"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="team-bio">Bio</Label>
              <Textarea
                id="team-bio"
                rows={4}
                value={teamForm.bio}
                onChange={(e) =>
                  setTeamForm((f) => ({ ...f, bio: e.target.value }))
                }
                placeholder="Quelques lignes sur le parcours du membre…"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="team-email">E-mail</Label>
                <Input
                  id="team-email"
                  type="email"
                  value={teamForm.email}
                  onChange={(e) =>
                    setTeamForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="prenom.nom@infospro.example"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="team-position">Position</Label>
                <Input
                  id="team-position"
                  type="number"
                  min={0}
                  value={teamForm.position}
                  onChange={(e) =>
                    setTeamForm((f) => ({ ...f, position: e.target.value }))
                  }
                  className="w-24"
                />
                <p className="text-xs text-ink-faint">
                  Ordre d&apos;affichage croissant.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-rule p-3">
              <Label htmlFor="team-active" className="text-sm font-normal">
                Actif
              </Label>
              <Switch
                id="team-active"
                checked={teamForm.is_active}
                onCheckedChange={(checked) =>
                  setTeamForm((f) => ({ ...f, is_active: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeTeamDialog}
              disabled={teamSaving}
            >
              Annuler
            </Button>
            <Button
              onClick={() => void saveTeamMember()}
              disabled={
                teamSaving ||
                teamForm.name.trim().length === 0 ||
                teamForm.role.trim().length === 0
              }
            >
              {teamSaving ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : null}
              {teamEditing ? "Enregistrer" : "Ajouter le membre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MediaPicker
        open={teamPickerOpen}
        onOpenChange={setTeamPickerOpen}
        filterType="image"
        title="Choisir la photo"
        onSelect={(media) =>
          setTeamForm((f) => ({
            ...f,
            photo_media_id: media.id,
            photo_preview_url: media.url,
          }))
        }
      />

      {/* ── Confirmation de suppression (page) ────────────────────────── */}
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette page ?</AlertDialogTitle>
            <AlertDialogDescription>
              La page « {deleting?.title} » sera définitivement supprimée, y
              compris son contenu. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              disabled={deleteBusy}
              onClick={(e) => {
                e.preventDefault();
                void confirmDeletePage();
              }}
            >
              {deleteBusy ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : null}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirmation de suppression (bannière) ────────────────────── */}
      <AlertDialog
        open={bannerDeleting !== null}
        onOpenChange={(open) => {
          if (!open) setBannerDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette bannière ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le bandeau « {bannerDeleting?.message} » ne sera plus affiché
              sur le site. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bannerDeleteBusy}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              disabled={bannerDeleteBusy}
              onClick={(e) => {
                e.preventDefault();
                void confirmDeleteBanner();
              }}
            >
              {bannerDeleteBusy ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : null}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirmation de suppression (redirection) ──────────────── */}
      <AlertDialog
        open={redirectDeleting !== null}
        onOpenChange={(open) => {
          if (!open) setRedirectDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette redirection ?</AlertDialogTitle>
            <AlertDialogDescription>
              L&apos;adresse « {redirectDeleting?.source_path} » ne redirigera
              plus vers « {redirectDeleting?.target_path} ». Cette action est
              irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={redirectDeleteBusy}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              disabled={redirectDeleteBusy}
              onClick={(e) => {
                e.preventDefault();
                void confirmDeleteRedirect();
              }}
            >
              {redirectDeleteBusy ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : null}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirmation de suppression (partenaire) ─────────────────── */}
      <AlertDialog
        open={partnerDeleting !== null}
        onOpenChange={(open) => {
          if (!open) setPartnerDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce partenaire ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le partenaire « {partnerDeleting?.name} » ne sera plus affiché
              sur la page « Nos partenaires » ni dans le défilement du site.
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={partnerDeleteBusy}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              disabled={partnerDeleteBusy}
              onClick={(e) => {
                e.preventDefault();
                void confirmDeletePartner();
              }}
            >
              {partnerDeleteBusy ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : null}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirmation de suppression (membre de l'équipe) ────────── */}
      <AlertDialog
        open={teamDeleting !== null}
        onOpenChange={(open) => {
          if (!open) setTeamDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce membre ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {teamDeleting?.name} » ({teamDeleting?.role}) sera retiré de
              la page « Notre équipe ». Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={teamDeleteBusy}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              disabled={teamDeleteBusy}
              onClick={(e) => {
                e.preventDefault();
                void confirmDeleteTeamMember();
              }}
            >
              {teamDeleteBusy ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : null}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
