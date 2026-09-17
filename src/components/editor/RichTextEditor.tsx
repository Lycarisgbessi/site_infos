"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Superscript from "@tiptap/extension-superscript";
import Subscript from "@tiptap/extension-subscript";
import Placeholder from "@tiptap/extension-placeholder";
import { useCallback, useEffect } from "react";
import type { RichText, RichTextMark } from "@/types/blocks";

/**
 * Champ RichText TipTap (§11.2 « éditeur TipTap par blocs ») — édité au
 * niveau fragment (§06.4 RichText) : bold/italic/underline/strike/code/
 * sup/sub + liens internes/externes. Sortie : RichText[] (jamais HTML).
 */

// ─── Conversions RichText[] ⇄ HTML (TipTap) ────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const MARK_TAGS: Record<RichTextMark, string[]> = {
  bold: ["strong"],
  italic: ["em"],
  underline: ["u"],
  strike: ["s"],
  code: ["code"],
  sup: ["sup"],
  sub: ["sub"],
};

export function richTextToHtml(rich: RichText): string {
  return rich
    .map((fragment) => {
      let inner = escapeHtml(fragment.text).replace(/\n/g, "<br>");
      if (fragment.link) {
        inner = `<a href="${escapeHtml(fragment.link.href)}"${fragment.link.external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${inner}</a>`;
      }
      const marks = fragment.marks ?? [];
      // sup/sub enveloppent en premier (avant les marques en ligne)
      for (const mark of (["sub", "sup", "code", "underline", "strike", "italic", "bold"] as RichTextMark[]).reverse()) {
        if (marks.includes(mark)) {
          for (const tag of MARK_TAGS[mark]) inner = `<${tag}>${inner}</${tag}>`;
        }
      }
      return inner;
    })
    .join("");
}

interface HtmlNode {
  type: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
  content?: HtmlNode[];
}

const TIPTAP_MARK_TO_RICH: Record<string, RichTextMark> = {
  bold: "bold",
  italic: "italic",
  underline: "underline",
  strike: "strike",
  code: "code",
  superscript: "sup",
  subscript: "sub",
};

export function jsonToRichText(doc: HtmlNode): RichText {
  const fragments: RichText = [];

  const walk = (node: HtmlNode, marks: RichTextMark[], link?: { href: string; external?: boolean }) => {
    const nodeMarks = [...marks];
    let nodeLink = link;
    for (const mark of node.marks ?? []) {
      if (mark.type === "link") {
        nodeLink = {
          href: String(mark.attrs?.href ?? ""),
          external: /^(https?:)?\/\//i.test(String(mark.attrs?.href ?? "")),
        };
      } else if (TIPTAP_MARK_TO_RICH[mark.type]) {
        nodeMarks.push(TIPTAP_MARK_TO_RICH[mark.type]);
      }
    }
    if (node.text !== undefined) {
      if (node.text.length > 0) {
        fragments.push({
          text: node.text,
          ...(nodeMarks.length > 0 ? { marks: [...new Set(nodeMarks)] } : {}),
          ...(nodeLink ? { link: nodeLink } : {}),
        });
      }
      return;
    }
    for (const child of node.content ?? []) walk(child, nodeMarks, nodeLink);
  };

  walk(doc, []);
  return fragments;
}

// ─── Composant ─────────────────────────────────────────────────────────

export interface RichTextEditorProps {
  value: RichText;
  onChange: (value: RichText) => void;
  placeholder?: string;
  ariaLabel?: string;
}

export function RichTextEditor({ value, onChange, placeholder, ariaLabel }: RichTextEditorProps) {
  // Convertit la valeur initiale ; TipTap reçoit HTML équivalent
  const initialHtml = richTextToHtml(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Superscript,
      Subscript,
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: initialHtml || "",
    editorProps: {
      attributes: {
        class: "richtext-editor min-h-[3rem] rounded-sm border border-rule bg-paper px-3 py-2 text-[1.02rem] leading-relaxed focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-red",
        "aria-label": ariaLabel ?? "Texte enrichi",
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(jsonToRichText(ed.getJSON() as unknown as HtmlNode));
    },
  });

  useEffect(() => {
    // Synchronisation externe (restauration de version, import Word) :
    // remplace le contenu si différent de la sérialisation courante
    if (!editor) return;
    const current = jsonToRichText(editor.getJSON() as unknown as HtmlNode);
    if (JSON.stringify(current) !== JSON.stringify(value)) {
      editor.commands.setContent(richTextToHtml(value), { emitUpdate: false });
    }
     
  }, [JSON.stringify(value)]);

  const toggle = useCallback(
    (action: () => void, active: boolean) => (
      <button
        key={String(active)}
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          action();
        }}
        aria-pressed={active}
        className={`rounded-sm px-2 py-1 text-xs font-semibold ${active ? "bg-ink text-paper" : "bg-paper-alt text-ink-soft hover:bg-rule"}`}
      >
        {null}
      </button>
    ),
    []
  );
  void toggle;

  if (!editor) {
    return <div className="min-h-[3rem] rounded-sm border border-rule bg-paper px-3 py-2 text-sm text-ink-faint">Chargement…</div>;
  }

  const btn = (label: string, title: string, action: () => void, active: boolean) => (
    <button
      key={label + title}
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onMouseDown={(e) => {
        e.preventDefault();
        action();
      }}
      className={`min-w-7 rounded-sm px-2 py-1 text-xs font-semibold transition-colors ${
        active ? "bg-ink text-paper" : "bg-paper-alt text-ink-soft hover:bg-rule"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="mb-1 flex flex-wrap gap-1" role="toolbar" aria-label="Mise en forme du texte">
        {btn("G", "Gras", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}
        {btn("I", "Italique", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}
        {btn("S", "Souligné", () => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"))}
        {btn("B", "Barré", () => editor.chain().focus().toggleStrike().run(), editor.isActive("strike"))}
        {btn("</>", "Code", () => editor.chain().focus().toggleCode().run(), editor.isActive("code"))}
        {btn("x²", "Exposant", () => editor.chain().focus().toggleSuperscript().run(), editor.isActive("superscript"))}
        {btn("x₂", "Indice", () => editor.chain().focus().toggleSubscript().run(), editor.isActive("subscript"))}
        {btn("Lien", "Lien", () => {
          const href = window.prompt("URL du lien (interne ou externe) :", editor.getAttributes("link").href ?? "");
          if (href === null) return;
          if (href === "") {
            editor.chain().focus().unsetLink().run();
            return;
          }
          editor.chain().focus().setLink({ href }).run();
        }, editor.isActive("link"))}
        {editor.isActive("link") &&
          btn("⟲", "Retirer le lien", () => editor.chain().focus().unsetLink().run(), false)}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
