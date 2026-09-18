"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Search } from "lucide-react";
import { apiFetch, errorMessage } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * Sélecteur de média (§11.2 médiathèque) — réutilisé par le panneau Médias,
 * les blocs image/galerie, les couvertures de rubriques/dossiers, la une.
 * Téléversement par glisser-déposer + recherche + filtre type.
 */

export interface MediaItem {
  id: string;
  type: string;
  url: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  title: string | null;
  alt_text: string | null;
  credit: string;
  license: string | null;
  file_size: unknown;
  created_at: string;
}

export interface MediaPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (media: MediaItem) => void;
  filterType?: "image" | "video" | "audio" | "document";
  title?: string;
}

export function MediaPicker({ open, onOpenChange, onSelect, filterType, title }: MediaPickerProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [type, setType] = useState(filterType ?? "all");
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ per_page: "60" });
      if (q) params.set("q", q);
      if (type !== "all") params.set("type", type);
      const { data } = await apiFetch<MediaItem[]>(`/api/admin/media?${params}`);
      setItems(data);
    } catch (error) {
      toast({ title: "Erreur", description: errorMessage(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [q, type, toast]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          const form = new FormData();
          form.set("file", file);
          form.set("title", file.name.replace(/\.[a-z0-9]+$/i, ""));
          const res = await fetch("/api/admin/media", { method: "POST", body: form });
          const payload = (await res.json()) as {
            data?: { media: { id: string; url: string; duplicate?: boolean }; warning?: string };
            error?: { message: string };
          };
          if (!res.ok || payload.error) {
            toast({ title: "Téléversement refusé", description: payload.error?.message ?? `Erreur ${res.status}`, variant: "destructive" });
          } else if (payload.data?.media.duplicate) {
            toast({ title: "Doublon détecté", description: payload.data.warning ?? "Ce média existe déjà." });
          }
        }
        await load();
      } finally {
        setUploading(false);
      }
    },
    [load, toast]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-hidden bg-paper sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="font-serif">{title ?? "Choisir un média"}</DialogTitle>
        </DialogHeader>

        <div
          className="mb-3 rounded-sm border border-dashed border-rule bg-paper-alt p-4 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void uploadFiles(e.dataTransfer.files);
          }}
        >
          <input
            ref={fileInput}
            type="file"
            multiple
            accept="image/*,video/mp4,audio/*,application/pdf"
            className="hidden"
            onChange={(e) => e.target.files && void uploadFiles(e.target.files)}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={uploading}>
            <Upload className="mr-2 size-4" aria-hidden />
            {uploading ? "Téléversement…" : "Téléverser (ou glisser-déposer ici)"}
          </Button>
          <p className="mt-1 text-xs text-ink-faint">JPG, PNG, WebP, AVIF, MP4, MP3, PDF · 25 Mo max</p>
        </div>

        <div className="mb-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 size-4 text-ink-faint" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" className="pl-8" aria-label="Rechercher un média" />
          </div>
          {!filterType && (
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-32" aria-label="Type de média">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                <SelectItem value="image">Images</SelectItem>
                <SelectItem value="video">Vidéos</SelectItem>
                <SelectItem value="audio">Audios</SelectItem>
                <SelectItem value="document">Documents</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="max-h-[45vh] overflow-y-auto rounded-sm border border-rule p-2" style={{ scrollbarWidth: "thin" }}>
          {loading ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse bg-paper-alt" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-faint">Aucun média. Téléversez un fichier ci-dessus.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {items.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onSelect(m);
                    onOpenChange(false);
                  }}
                  className={cn(
                    "group relative aspect-square overflow-hidden rounded-sm border border-rule bg-paper-alt transition-shadow hover:ring-2 hover:ring-brand-red focus-visible:ring-2 focus-visible:ring-brand-red"
                  )}
                  title={m.title ?? m.id}
                >
                  {m.type === "image" ? (
                     
                    <img src={m.url} alt={m.alt_text ?? m.title ?? ""} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-xs font-semibold uppercase text-ink-faint">
                      {m.type}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
