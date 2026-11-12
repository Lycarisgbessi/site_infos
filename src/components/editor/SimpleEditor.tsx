"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { VideoEmbed } from "./VideoEmbed";
import { MediaPicker } from "@/components/admin/MediaPicker";
import {
  Bold, Italic, Underline as UnderlineIcon, Highlighter, Strikethrough, Link2,
  Heading1, Heading2, Heading3, List, ListOrdered, Quote, ImagePlus, Video,
  Undo2, Redo2, DriveIcon,
} from "./simple-icons";

/**
 * « Mode simple » de rédaction — interface type Word : une seule surface
 * de texte riche avec barre d'outils complète (gras, italique, souligné,
 * surligné, barré, liens, titres H1/H2/H3, listes, citations, insertion
 * d'images de la médiathèque et de vidéos YouTube/Drive).
 *
 * Le contenu vit en HTML ; la conversion vers les blocs §06.4 (à la
 * sauvegarde ou au retour au mode blocs) est assurée par htmlToBlocks,
 * qui reconnaît les marqueurs data-media-id / data-video / data-audio.
 */

export interface SimpleEditorVideoLabels {
  insertVideo: string;
  videoUrl: string;
  confirm: string;
  cancel: string;
  pickImage: string;
}

export function SimpleEditor({
  initialHtml,
  onChange,
  labels,
}: {
  initialHtml: string;
  onChange: (html: string) => void;
  labels: SimpleEditorVideoLabels;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const lastEmit = useRef(initialHtml);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] }, // H1/H2/H3 de l'UI → niveaux corps
      }),
      Underline,
      Highlight,
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false, allowBase64: false }),
      VideoEmbed,
      Placeholder.configure({ placeholder: "Rédigez ou collez votre article ici — le formatage de Word est conservé…" }),
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        class: "prose-simple min-h-[420px] focus:outline-none px-4 py-5",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastEmit.current = html;
      onChange(html);
    },
  });

  // Resynchronisation si le contenu externe change (ex. import Word)
  useEffect(() => {
    if (editor && initialHtml !== lastEmit.current && initialHtml !== "<p></p>") {
      lastEmit.current = initialHtml;
      editor.commands.setContent(initialHtml, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialHtml]);

  const insertImage = useCallback(
    (mediaId: string, url: string, alt: string) => {
      if (!editor) return;
      editor
        .chain()
        .focus()
        .insertContent(
          `<img src="${url}" data-media-id="${mediaId}" alt="${alt.replace(/"/g, "&quot;")}" />`
        )
        .run();
    },
    [editor]
  );

  const insertVideo = useCallback(() => {
    if (!editor || !videoUrl.trim()) {
      setVideoOpen(false);
      return;
    }
    const url = videoUrl.trim();
    editor.chain().focus().insertContent({ type: "videoEmbed", attrs: { url } }).run();
    editor.chain().focus().insertContent("<p></p>").run();
    setVideoOpen(false);
    setVideoUrl("");
  }, [editor, videoUrl]);

  if (!editor) {
    return <div className="h-[480px] animate-pulse rounded-md border border-rule bg-paper-alt" />;
  }

  const Btn = ({
    onClick,
    active,
    title,
    children,
  }: {
    onClick: () => void;
    active?: boolean;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`flex h-9 w-9 items-center justify-center rounded-md border transition-colors duration-150 ${
        active
          ? "border-brand-red bg-brand-red text-white"
          : "border-transparent text-ink-soft hover:border-rule hover:bg-paper-alt hover:text-ink"
      }`}
    >
      {children}
    </button>
  );

  const Sep = () => <span aria-hidden className="mx-1 h-6 w-px bg-rule" />;

  return (
    <div className="overflow-hidden rounded-lg border border-rule bg-paper shadow-sm">
      {/* ── Barre d'outils ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-rule bg-paper-alt/95 px-2 py-1.5 backdrop-blur">
        <Btn title="Annuler" onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 />
        </Btn>
        <Btn title="Rétablir" onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 />
        </Btn>
        <Sep />
        <Btn title="Titre H1" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading1 />
        </Btn>
        <Btn title="Sous-titre H2" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading2 />
        </Btn>
        <Btn title="Sous-sous-titre H3" active={editor.isActive("heading", { level: 4 })} onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}>
          <Heading3 />
        </Btn>
        <Sep />
        <Btn title="Gras (Ctrl+B)" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold />
        </Btn>
        <Btn title="Italique (Ctrl+I)" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic />
        </Btn>
        <Btn title="Souligné (Ctrl+U)" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon />
        </Btn>
        <Btn title="Surligné" active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()}>
          <Highlighter />
        </Btn>
        <Btn title="Barré" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough />
        </Btn>
        <Sep />
        <Btn
          title="Insérer un lien"
          active={editor.isActive("link")}
          onClick={() => {
            if (editor.isActive("link")) {
              editor.chain().focus().unsetLink().run();
              return;
            }
            const href = window.prompt("URL du lien (https://…)");
            if (href) editor.chain().focus().setLink({ href }).run();
          }}
        >
          <Link2 />
        </Btn>
        <Btn title="Liste à puces" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List />
        </Btn>
        <Btn title="Liste numérotée" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered />
        </Btn>
        <Btn title="Citation" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote />
        </Btn>
        <Sep />
        <Btn title={labels.pickImage} onClick={() => setPickerOpen(true)}>
          <ImagePlus />
        </Btn>
        <Btn title={labels.insertVideo} onClick={() => setVideoOpen(true)}>
          <Video />
        </Btn>
      </div>

      {/* ── Surface de rédaction ───────────────────────────────────── */}
      <EditorContent editor={editor} />

      {/* ── Sélecteur d'image (médiathèque) ────────────────────────── */}
      <MediaPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        filterType="image"
        title={labels.pickImage}
        onSelect={(media) => {
          insertImage(media.id, media.url, media.alt_text ?? media.title ?? "");
          setPickerOpen(false);
        }}
      />

      {/* ── Dialogue vidéo ─────────────────────────────────────────── */}
      {videoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm" onClick={() => setVideoOpen(false)}>
          <div className="w-full max-w-md rounded-lg border border-rule bg-paper p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="font-serif text-lg font-bold">{labels.insertVideo}</p>
            <p className="mt-1 text-sm text-ink-soft">
              <DriveIcon /> YouTube, Google Drive ou lien MP4 direct.
            </p>
            <input
              autoFocus
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://…"
              className="mt-3 w-full rounded-md border border-rule bg-paper-alt px-3 py-2 text-sm outline-none focus:border-brand-red"
              onKeyDown={(e) => e.key === "Enter" && insertVideo()}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setVideoOpen(false)} className="rounded-md border border-rule px-3 py-1.5 text-sm font-semibold text-ink-soft hover:bg-paper-alt">
                {labels.cancel}
              </button>
              <button type="button" onClick={insertVideo} className="rounded-md bg-brand-red px-4 py-1.5 text-sm font-bold text-white hover:bg-red-deep">
                {labels.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
