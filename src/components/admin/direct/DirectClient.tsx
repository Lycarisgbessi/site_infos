"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiFetch, errorMessage } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ExternalLink, Link2, Loader2, Radio, Save, Type } from "lucide-react";

/**
 * TV & Direct (/admin/direct) — configuration du direct :
 * - interrupteur features.live (module actif) ;
 * - direct.live_url : URL YouTube (watch/shorts/live) ou URL d'iframe
 *   http(s) — vide = section « En direct » masquée ;
 * - direct.live_title : titre affiché (défaut « En direct »).
 * Un direct actif s'affiche en tête de la page /video. L'écriture passe par
 * l'API générique /api/admin/settings-groups (permission settings.manage),
 * qui valide l'appartenance au registre et le format http(s) de l'URL.
 */

const DEFAULT_LIVE_TITLE = "En direct";

interface DirectClientProps {
  initialLiveEnabled: boolean;
  initialLiveUrl: string;
  initialLiveTitle: string;
  canManage: boolean;
}

export function DirectClient({ initialLiveEnabled, initialLiveUrl, initialLiveTitle, canManage }: DirectClientProps) {
  const { toast } = useToast();

  const [liveEnabled, setLiveEnabled] = useState(initialLiveEnabled);
  const [liveUrl, setLiveUrl] = useState(initialLiveUrl);
  const [liveTitle, setLiveTitle] = useState(initialLiveTitle);
  // Référence des valeurs « enregistrées » (les props serveur ne changent
  // pas après une sauvegarde côté client) — pilote l'état modifié.
  const [saved, setSaved] = useState({
    enabled: initialLiveEnabled,
    url: initialLiveUrl,
    title: initialLiveTitle,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLiveEnabled(initialLiveEnabled);
    setLiveUrl(initialLiveUrl);
    setLiveTitle(initialLiveTitle);
    setSaved({ enabled: initialLiveEnabled, url: initialLiveUrl, title: initialLiveTitle });
  }, [initialLiveEnabled, initialLiveUrl, initialLiveTitle]);

  const dirty =
    liveEnabled !== saved.enabled ||
    liveUrl.trim() !== saved.url.trim() ||
    (liveTitle.trim() || DEFAULT_LIVE_TITLE) !== (saved.title.trim() || DEFAULT_LIVE_TITLE);

  const liveVisible = liveEnabled && liveUrl.trim() !== "";

  const save = useCallback(async () => {
    const url = liveUrl.trim();
    if (url !== "" && !/^https?:\/\//i.test(url)) {
      toast({
        title: "URL du direct invalide",
        description: "Elle doit commencer par http:// ou https:// (lien YouTube live ou URL d'iframe), ou rester vide.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/admin/settings-groups", {
        method: "PUT",
        json: {
          updates: [
            // Valeurs sérialisées JSON (décodées par getSettingsValues)
            { key: "features.live", value: JSON.stringify(liveEnabled) },
            { key: "direct.live_url", value: JSON.stringify(url) },
            { key: "direct.live_title", value: JSON.stringify(liveTitle.trim() || DEFAULT_LIVE_TITLE) },
          ],
        },
      });
      setSaved({ enabled: liveEnabled, url, title: liveTitle.trim() || DEFAULT_LIVE_TITLE });
      toast({
        title: "Direct enregistré",
        description: liveEnabled && url !== ""
          ? "Le direct est actif et s'affiche en tête de la page /video."
          : "La section « En direct » est masquée sur /video (module inactif ou URL vide).",
      });
    } catch (error) {
      toast({ title: "Enregistrement impossible", description: errorMessage(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [liveEnabled, liveUrl, liveTitle, toast]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kicker text-brand-red">TV &amp; Direct</p>
          <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight">Direct</h1>
          <p className="mt-1 text-sm text-ink-faint">
            Un direct actif s&apos;affiche en tête de la page{" "}
            <a
              href="/video"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-ink-soft underline underline-offset-2 hover:text-brand-red"
              aria-label="Ouvrir la page vidéo dans un nouvel onglet"
            >
              /video
              <ExternalLink className="size-3" aria-hidden />
            </a>{" "}
            — module, flux vidéo et titre affiché.
          </p>
        </div>
        <Badge
          className={cn(
            liveVisible ? "border-brand-red bg-brand-red text-white" : "border-rule bg-paper-alt text-ink-faint"
          )}
          aria-live="polite"
        >
          {liveVisible ? "Direct actif" : "Direct masqué"}
        </Badge>
      </header>

      <section aria-label="Configuration du direct" className="border border-rule bg-paper">
        <div className="border-b border-rule px-4 py-3">
          <p className="kicker text-ink-faint">Configuration</p>
        </div>

        <div className="space-y-6 p-4">
          {/* ── Interrupteur du module ─────────────────────────────────── */}
          <div className="flex items-start gap-3">
            <Switch
              id="direct-live-enabled"
              checked={liveEnabled}
              onCheckedChange={canManage ? setLiveEnabled : undefined}
              disabled={!canManage}
              aria-label="Activer le module direct (features.live)"
            />
            <div className="min-w-0">
              <Label htmlFor="direct-live-enabled" className="text-sm font-semibold text-ink">
                Direct activé <span className="font-mono text-xs font-normal text-ink-faint">features.live</span>
              </Label>
              <p className="mt-0.5 text-xs text-ink-faint">
                Active le module direct du site. La section n&apos;apparaît sur /video que si une URL de flux est
                également renseignée ci-dessous.
              </p>
            </div>
          </div>

          {/* ── URL du flux ────────────────────────────────────────────── */}
          <div className="space-y-1">
            <Label htmlFor="direct-live-url" className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
              <Link2 className="size-3.5" aria-hidden />
              URL du direct <span className="font-mono text-xs font-normal text-ink-faint">direct.live_url</span>
            </Label>
            <Input
              id="direct-live-url"
              type="url"
              value={liveUrl}
              onChange={(e) => setLiveUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=… ou https://…/embed/…"
              aria-label="URL du direct (YouTube live ou iframe http(s))"
              autoComplete="off"
              disabled={!canManage}
            />
            <p className="text-xs text-ink-faint">
              Lien YouTube (watch / shorts / live) ou URL d&apos;iframe http(s). Vide = section « En direct » masquée
              sur /video.
            </p>
          </div>

          {/* ── Titre affiché ──────────────────────────────────────────── */}
          <div className="space-y-1">
            <Label htmlFor="direct-live-title" className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
              <Type className="size-3.5" aria-hidden />
              Titre affiché <span className="font-mono text-xs font-normal text-ink-faint">direct.live_title</span>
            </Label>
            <Input
              id="direct-live-title"
              value={liveTitle}
              onChange={(e) => setLiveTitle(e.target.value)}
              placeholder={DEFAULT_LIVE_TITLE}
              maxLength={120}
              aria-label="Titre affiché du direct"
              autoComplete="off"
              disabled={!canManage}
            />
            <p className="text-xs text-ink-faint">
              Titre de la section sur /video — « {DEFAULT_LIVE_TITLE} » si laissé vide.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-4">
            <Button
              type="button"
              onClick={() => void save()}
              disabled={!canManage || saving || !dirty}
              aria-label="Enregistrer la configuration du direct"
            >
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
              Enregistrer
            </Button>
            {dirty && (
              <Badge className="border-amber-200 bg-amber-50 text-amber-800" aria-live="polite">
                Modifications non enregistrées
              </Badge>
            )}
            {!canManage && (
              <p className="text-xs text-ink-faint">
                Lecture seule — la modification de ces réglages requiert la permission administrateur
                « settings.manage ».
              </p>
            )}
          </div>
        </div>
      </section>

      <p className="flex items-start gap-2 text-xs text-ink-faint">
        <Radio className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Prise d&apos;effet immédiate sur le site public : à l&apos;enregistrement, le cache des réglages est
        invalidé — la page /video affiche le lecteur en tête dès qu&apos;un direct actif est configuré.
      </p>
    </div>
  );
}
