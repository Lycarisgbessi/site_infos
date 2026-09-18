"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Info, Loader2, RotateCcw, Save, Search, SearchX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch, errorMessage } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Écran « Textes d'interface » (§11.2 /admin/textes) : libellés du site
 * public (table translations) éditables en ligne, avec recherche, suivi des
 * modifications et enregistrement en lot (PUT /api/admin/translations).
 * Seule la langue française (fr) est éditable pour l'instant — les autres
 * langues arrivent en Phase 8.
 */

interface TranslationRow {
  key: string;
  locale: string;
  value: string;
  context: string | null;
  updated_at: string;
}

const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return DATE_FORMAT.format(date);
}

export function TextesClient() {
  const { toast } = useToast();

  const [rows, setRows] = useState<TranslationRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [locale, setLocale] = useState("fr");

  const load = useCallback(async (loc: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await apiFetch<TranslationRow[]>(
        `/api/admin/translations?locale=${encodeURIComponent(loc)}`
      );
      setRows(data);
      setDrafts({});
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(locale);
  }, [load, locale]);

  const query = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      query === ""
        ? rows
        : rows.filter(
            (r) =>
              r.key.toLowerCase().includes(query) ||
              r.value.toLowerCase().includes(query)
          ),
    [rows, query]
  );

  const modifiedRows = useMemo(
    () =>
      rows.filter(
        (r) => drafts[r.key] !== undefined && drafts[r.key] !== r.value
      ),
    [rows, drafts]
  );

  const draftValue = (row: TranslationRow): string => drafts[row.key] ?? row.value;

  const setDraft = (key: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [key]: value }));
  };

  const resetAll = () => setDrafts({});

  const save = async () => {
    if (modifiedRows.length === 0) return;
    const translations = modifiedRows.map((r) => ({
      key: r.key,
      locale: r.locale,
      value: drafts[r.key] ?? "",
    }));

    setSaving(true);
    try {
      await apiFetch("/api/admin/translations", {
        method: "PUT",
        json: { translations },
      });
      const savedKeys = new Set(translations.map((t) => t.key));
      setRows((prev) =>
        prev.map((r) =>
          savedKeys.has(r.key)
            ? { ...r, value: drafts[r.key] ?? r.value, updated_at: new Date().toISOString() }
            : r
        )
      );
      setDrafts((prev) => {
        const next = { ...prev };
        for (const t of translations) delete next[t.key];
        return next;
      });
      toast({
        title: `${translations.length} libellé${translations.length > 1 ? "s" : ""} enregistré${translations.length > 1 ? "s" : ""}`,
        description: "Prise d'effet immédiate sur le site public.",
      });
    } catch (error) {
      toast({
        title: "Enregistrement impossible",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <span className="sr-only">Chargement des textes d&apos;interface…</span>
        <div className="rounded-[2px] border border-rule bg-paper p-4 md:p-6">
          <Skeleton className="h-5 w-64" />
          <div className="mt-5 space-y-3">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        role="alert"
        className="rounded-[2px] border border-danger bg-red-wash p-8 text-center"
      >
        <AlertTriangle className="mx-auto size-6 text-brand-red" aria-hidden />
        <p className="mt-3 font-serif text-lg font-semibold text-ink">
          Chargement impossible
        </p>
        <p className="mt-1 text-sm text-ink-soft">{loadError}</p>
        <Button className="mt-5" onClick={() => void load(locale)}>
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-[2px] border border-rule bg-paper-alt p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-brand-red" aria-hidden />
        <p className="text-sm text-ink-soft">
          Tous les libellés du site public (boutons, messages, mentions de
          consentement, erreurs) sont modifiables ici — prise d&apos;effet
          immédiate.
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une clé ou un texte…"
            aria-label="Rechercher un texte d'interface par clé ou valeur"
            className="bg-paper pl-8"
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-xs text-ink-faint" aria-live="polite">
            {query === ""
              ? `${rows.length} texte${rows.length > 1 ? "s" : ""}`
              : `${filtered.length} / ${rows.length} texte${rows.length > 1 ? "s" : ""}`}
          </p>

          <div className="flex items-center gap-2">
            <Label htmlFor="textes-locale" className="text-xs text-ink-faint">
              Langue
            </Label>
            <Select
              value={locale}
              onValueChange={(value) => setLocale(value)}
            >
              <SelectTrigger
                id="textes-locale"
                aria-label="Langue des textes d'interface"
                className="w-56 bg-paper"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fr">Français (fr)</SelectItem>
                <SelectItem value="phase-8" disabled>
                  Autres langues : Phase 8
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {modifiedRows.length > 0 ? (
            <Button variant="ghost" onClick={() => resetAll()} disabled={saving}>
              <RotateCcw aria-hidden />
              Annuler
            </Button>
          ) : null}

          <Button
            onClick={() => void save()}
            disabled={modifiedRows.length === 0 || saving}
          >
            {saving ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Save aria-hidden />
            )}
            Enregistrer{modifiedRows.length > 0 ? ` (${modifiedRows.length})` : ""}
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[2px] border border-rule bg-paper py-16 text-center">
          <SearchX className="mx-auto size-6 text-ink-faint" aria-hidden />
          <p className="mt-3 text-sm text-ink-soft">
            Aucun texte d&apos;interface pour cette langue.
          </p>
        </div>
      ) : (
        <div className="rounded-[2px] border border-rule bg-paper">
          <div
            role="region"
            aria-label="Liste des textes d'interface"
            tabIndex={0}
            className="max-h-[60vh] overflow-y-auto"
            style={{ scrollbarWidth: "thin" }}
          >
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-paper-alt">
                <TableRow className="border-b border-rule hover:bg-paper-alt">
                  <TableHead className="w-[36%] text-ink-soft">Clé</TableHead>
                  <TableHead className="text-ink-soft">Valeur</TableHead>
                  <TableHead className="w-36 text-right text-ink-soft">
                    État
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => {
                  const dirty =
                    drafts[row.key] !== undefined &&
                    drafts[row.key] !== row.value;
                  return (
                    <TableRow key={row.key} className="border-b border-rule">
                      <TableCell className="w-[36%] py-2.5 align-top">
                        <p className="break-all font-mono text-xs leading-5 text-ink-faint">
                          {row.key}
                        </p>
                        {row.context ? (
                          <p className="mt-1 text-[11px] italic leading-4 text-ink-faint">
                            {row.context}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="py-2.5 align-top">
                        <Input
                          value={draftValue(row)}
                          onChange={(e) => setDraft(row.key, e.target.value)}
                          aria-label={`Valeur du texte ${row.key}`}
                          className={
                            dirty
                              ? "border-warning bg-warning/5"
                              : "bg-paper"
                          }
                        />
                      </TableCell>
                      <TableCell className="py-2.5 text-right align-top">
                        {dirty ? (
                          <Badge
                            variant="outline"
                            className="border-warning bg-warning/10 text-warning"
                          >
                            Modifié
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-ink-faint">
                            maj {formatDate(row.updated_at)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {filtered.length === 0 ? (
              <div className="border-t border-rule py-14 text-center">
                <SearchX className="mx-auto size-6 text-ink-faint" aria-hidden />
                <p className="mt-3 text-sm text-ink-soft">
                  Aucun texte ne correspond à « {search.trim()} ».
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  onClick={() => setSearch("")}
                >
                  Effacer la recherche
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
