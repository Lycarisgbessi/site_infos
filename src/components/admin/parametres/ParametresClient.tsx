"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, RotateCcw, Save } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, errorMessage } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Écran « Autonomie totale » (§11.2 /admin/parametres) : les 9 groupes de
 * réglages du site, éditables par l'équipe éditoriale sans intervention
 * technique. Chaque groupe suit ses propres modifications (dirty tracking)
 * et s'enregistre séparément via PUT /api/admin/settings-groups — toute
 * valeur est sérialisée en chaîne JSON (adaptation jsonb, D-01).
 * Une erreur 403 (permission settings.manage manquante) est affichée telle
 * quelle via le toast d'erreur.
 */

type FieldType =
  | "text"
  | "textarea"
  | "boolean"
  | "number"
  | "json"
  | "color"
  | "list";

interface SettingField {
  key: string;
  label: string;
  type: FieldType;
  help?: string;
}

interface SettingGroup {
  group: string;
  label: string;
  fields: SettingField[];
}

interface SettingValueRow {
  key: string;
  value: string;
  group_key: string;
  label: string | null;
  updated_at: string;
}

interface SettingsPayload {
  groups: SettingGroup[];
  values: SettingValueRow[];
}

function defaultDisplay(type: FieldType): string {
  return type === "boolean" ? "false" : "";
}

function isParsableJson(text: string): boolean {
  try {
    JSON.parse(text) as unknown;
    return true;
  } catch {
    return false;
  }
}

/** Décode la valeur sérialisée (chaîne JSON) vers le texte affiché/éditable. */
function decodeValue(type: FieldType, raw: string | null | undefined): string {
  if (raw == null || raw === "") return defaultDisplay(type);
  try {
    const parsed: unknown = JSON.parse(raw);
    switch (type) {
      case "boolean":
        return typeof parsed === "boolean"
          ? String(parsed)
          : raw === "true"
            ? "true"
            : "false";
      case "number":
        return typeof parsed === "number" ? String(parsed) : raw;
      case "list":
        return Array.isArray(parsed)
          ? parsed.map((v) => String(v)).join("\n")
          : raw;
      case "json":
        return JSON.stringify(parsed, null, 2);
      default:
        return typeof parsed === "string" ? parsed : raw;
    }
  } catch {
    // Repli sûr : valeur brute si la sérialisation est corrompue
    return raw;
  }
}

/** Encode le texte édité vers la valeur sérialisée (toujours une chaîne). */
function encodeValue(field: SettingField, display: string): string {
  switch (field.type) {
    case "boolean":
      return display === "true" ? "true" : "false";
    case "number": {
      const trimmed = display.trim();
      return trimmed === "" ? JSON.stringify("") : trimmed;
    }
    case "json": {
      const trimmed = display.trim();
      return trimmed === ""
        ? JSON.stringify("")
        : JSON.stringify(JSON.parse(trimmed) as unknown);
    }
    case "list":
      return JSON.stringify(
        display
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
      );
    default:
      return JSON.stringify(display);
  }
}

const COLOR_HEX = /^#[0-9a-fA-F]{6}$/;

export function ParametresClient() {
  const { toast } = useToast();

  const [groups, setGroups] = useState<SettingGroup[]>([]);
  const [initial, setInitial] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [invalidJson, setInvalidJson] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingGroup, setSavingGroup] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await apiFetch<SettingsPayload>(
        "/api/admin/settings-groups"
      );
      const valueByKey = new Map<string, string>(
        data.values.map((row) => [row.key, row.value])
      );
      const nextInitial: Record<string, string> = {};
      const nextValues: Record<string, string> = {};
      for (const group of data.groups) {
        for (const field of group.fields) {
          const display = decodeValue(field.type, valueByKey.get(field.key));
          nextInitial[field.key] = display;
          nextValues[field.key] = display;
        }
      }
      setGroups(data.groups);
      setInitial(nextInitial);
      setValues(nextValues);
      setInvalidJson({});
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalFields = useMemo(
    () => groups.reduce((acc, g) => acc + g.fields.length, 0),
    [groups]
  );

  const dirtyFieldsFor = useCallback(
    (group: SettingGroup): SettingField[] =>
      group.fields.filter(
        (f) => (values[f.key] ?? "") !== (initial[f.key] ?? "")
      ),
    [values, initial]
  );

  const totalDirty = useMemo(
    () => groups.reduce((acc, g) => acc + dirtyFieldsFor(g).length, 0),
    [groups, dirtyFieldsFor]
  );

  const setField = (key: string, display: string) => {
    setValues((prev) => ({ ...prev, [key]: display }));
  };

  /** Validation JSON « à la sortie du champ » (parse on blur). */
  const validateJsonOnBlur = (field: SettingField, display: string) => {
    if (field.type !== "json") return;
    const trimmed = display.trim();
    setInvalidJson((prev) => ({
      ...prev,
      [field.key]: trimmed !== "" && !isParsableJson(trimmed),
    }));
  };

  const resetGroup = (group: SettingGroup) => {
    setValues((prev) => {
      const next = { ...prev };
      for (const f of group.fields) {
        next[f.key] = initial[f.key] ?? defaultDisplay(f.type);
      }
      return next;
    });
    setInvalidJson((prev) => {
      const next = { ...prev };
      for (const f of group.fields) delete next[f.key];
      return next;
    });
  };

  const saveGroup = async (group: SettingGroup) => {
    const dirty = dirtyFieldsFor(group);
    if (dirty.length === 0) return;

    const invalid = dirty.filter(
      (f) =>
        f.type === "json" &&
        (values[f.key] ?? "").trim() !== "" &&
        !isParsableJson(values[f.key] ?? "")
    );
    if (invalid.length > 0) {
      toast({
        title: "JSON invalide",
        description: `Corrigez le champ « ${invalid[0]?.label ?? invalid[0]?.key ?? ""} » avant d'enregistrer.`,
        variant: "destructive",
      });
      return;
    }

    const encoded = dirty.map((f) => ({
      field: f,
      value: encodeValue(f, values[f.key] ?? ""),
    }));

    setSavingGroup(group.group);
    try {
      await apiFetch("/api/admin/settings-groups", {
        method: "PUT",
        json: { updates: encoded.map((e) => ({ key: e.field.key, value: e.value })) },
      });
      setInitial((prev) => {
        const next = { ...prev };
        for (const e of encoded) {
          next[e.field.key] = decodeValue(e.field.type, e.value);
        }
        return next;
      });
      setInvalidJson((prev) => {
        const next = { ...prev };
        for (const e of encoded) delete next[e.field.key];
        return next;
      });
      toast({
        title: "Groupe enregistré",
        description: `${group.label} — ${encoded.length} réglage${encoded.length > 1 ? "s" : ""} mis à jour. Prise d'effet immédiate.`,
      });
    } catch (error) {
      toast({
        title: "Enregistrement impossible",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSavingGroup(null);
    }
  };

  const renderHelper = (field: SettingField, invalid: boolean) => {
    if (invalid) {
      return (
        <p className="text-xs font-medium text-danger">JSON invalide</p>
      );
    }
    return (
      <>
        {field.help ? (
          <p className="text-xs text-ink-faint">{field.help}</p>
        ) : null}
        {field.type === "json" ? (
          <p className="text-xs text-ink-faint">
            Format JSON attendu — objet, tableau ou valeur entre guillemets.
          </p>
        ) : null}
        {field.type === "list" ? (
          <p className="text-xs text-ink-faint">Une valeur par ligne.</p>
        ) : null}
      </>
    );
  };

  const renderField = (field: SettingField) => {
    const value = values[field.key] ?? "";
    const id = `setting-${field.key}`;
    const keyLine = (
      <p className="font-mono text-[11px] leading-none text-ink-faint">
        {field.key}
      </p>
    );

    if (field.type === "boolean") {
      return (
        <div
          key={field.key}
          className="flex items-start justify-between gap-4 py-1"
        >
          <div className="space-y-1">
            <Label htmlFor={id} className="text-sm font-medium">
              {field.label}
            </Label>
            {keyLine}
            {field.help ? (
              <p className="text-xs text-ink-faint">{field.help}</p>
            ) : null}
          </div>
          <Switch
            id={id}
            checked={value === "true"}
            onCheckedChange={(checked) =>
              setField(field.key, checked ? "true" : "false")
            }
            aria-label={field.label}
          />
        </div>
      );
    }

    const invalid = field.type === "json" && invalidJson[field.key] === true;
    const fullWidth =
      field.type === "textarea" ||
      field.type === "json" ||
      field.type === "list";

    return (
      <div key={field.key} className={fullWidth ? "md:col-span-2" : undefined}>
        <Label htmlFor={id} className="text-sm font-medium">
          {field.label}
        </Label>
        <div className="mt-1.5 space-y-1.5">
          {field.type === "textarea" ? (
            <Textarea
              id={id}
              value={value}
              onChange={(e) => setField(field.key, e.target.value)}
              aria-label={field.label}
              className="min-h-20 bg-paper"
            />
          ) : field.type === "json" ? (
            <Textarea
              id={id}
              value={value}
              onChange={(e) => setField(field.key, e.target.value)}
              onBlur={(e) => validateJsonOnBlur(field, e.target.value)}
              aria-label={field.label}
              aria-invalid={invalid || undefined}
              className="max-h-64 min-h-24 overflow-y-auto bg-paper font-mono text-xs"
              style={{ scrollbarWidth: "thin" }}
            />
          ) : field.type === "list" ? (
            <Textarea
              id={id}
              value={value}
              onChange={(e) => setField(field.key, e.target.value)}
              aria-label={field.label}
              className="min-h-20 bg-paper"
            />
          ) : field.type === "color" ? (
            <div className="flex items-center gap-2">
              <Input
                id={id}
                type="color"
                value={COLOR_HEX.test(value) ? value : "#000000"}
                onChange={(e) => setField(field.key, e.target.value)}
                aria-label={field.label}
                className="h-9 w-14 cursor-pointer p-1"
              />
              <span className="font-mono text-xs text-ink-soft">
                {value || "— non définie"}
              </span>
            </div>
          ) : (
            <Input
              id={id}
              type={field.type === "number" ? "number" : "text"}
              value={value}
              onChange={(e) => setField(field.key, e.target.value)}
              aria-label={field.label}
              className="bg-paper"
            />
          )}
          {renderHelper(field, invalid)}
          {keyLine}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <span className="sr-only">Chargement des réglages…</span>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-[2px] border border-rule bg-paper p-4 md:p-6"
          >
            <Skeleton className="h-5 w-44" />
            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-20 w-full md:col-span-2" />
            </div>
          </div>
        ))}
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
        <Button className="mt-5" onClick={() => void load()}>
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-faint" aria-live="polite">
        {groups.length} groupes · {totalFields} réglages ·{" "}
        {totalDirty > 0
          ? `${totalDirty} modification${totalDirty > 1 ? "s" : ""} en attente d'enregistrement`
          : "aucune modification en attente"}
      </p>

      <div className="rounded-[2px] border border-rule bg-paper">
        <Accordion
          type="multiple"
          defaultValue={groups[0] ? [groups[0].group] : []}
        >
          {groups.map((group) => {
            const dirtyFields = dirtyFieldsFor(group);
            const saving = savingGroup === group.group;
            return (
              <AccordionItem
                key={group.group}
                value={group.group}
                className="border-b border-rule last:border-b-0"
              >
                <AccordionTrigger className="px-4 py-4 text-left hover:no-underline md:px-6">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-serif text-base font-semibold text-ink">
                      {group.label}
                    </span>
                    <span className="font-mono text-[11px] text-ink-faint">
                      {group.fields.length} réglage{group.fields.length > 1 ? "s" : ""}
                    </span>
                    {dirtyFields.length > 0 ? (
                      <span className="rounded-full bg-red-wash px-2 py-0.5 text-[11px] font-semibold text-brand-red">
                        {dirtyFields.length} modifié{dirtyFields.length > 1 ? "s" : ""}
                      </span>
                    ) : null}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-5 md:px-6">
                  <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
                    {group.fields.map(renderField)}
                  </div>
                  <div className="mt-6 flex flex-col gap-3 border-t border-rule pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-ink-faint" aria-live="polite">
                      {dirtyFields.length > 0
                        ? `${dirtyFields.length} modification${dirtyFields.length > 1 ? "s" : ""} non enregistrée${dirtyFields.length > 1 ? "s" : ""}`
                        : "À jour — aucune modification en attente."}
                    </p>
                    <div className="flex items-center gap-2">
                      {dirtyFields.length > 0 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => resetGroup(group)}
                          disabled={saving}
                        >
                          <RotateCcw aria-hidden />
                          Annuler
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        onClick={() => void saveGroup(group)}
                        disabled={dirtyFields.length === 0 || saving}
                      >
                        {saving ? (
                          <Loader2 className="animate-spin" aria-hidden />
                        ) : (
                          <Save aria-hidden />
                        )}
                        Enregistrer
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </div>
  );
}
