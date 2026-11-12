"use client";

import { NodeViewWrapper, ReactNodeViewRenderer, Node } from "@tiptap/react";

/**
 * Nœud « vidéo intégrée » pour le mode simple : affiche le VRAI lecteur
 * (YouTube / Drive / MP4) directement dans la surface de rédaction, non
 * éditable, avec son URL en légende. Le HTML sérialisé reste
 * <figure data-video="url"> — reconverti en bloc embed/video par
 * htmlToBlocks à la sauvegarde.
 */

function playerSrc(url: string): { kind: "youtube" | "drive" | "file"; src: string } | null {
  const yt = url.match(/[?&]v=([\w-]{6,})/)?.[1] ?? url.match(/youtu\.be\/([\w-]{6,})/)?.[1] ?? url.match(/youtube(?:-nocookie)?\.com\/(?:embed|shorts)\/([\w-]{6,})/)?.[1];
  if (yt) return { kind: "youtube", src: `https://www.youtube-nocookie.com/embed/${yt}?rel=0&modestbranding=1` };
  const drive = url.match(/drive\.google\.com\/file\/d\/([\w-]{10,})/)?.[1] ?? url.match(/[?&]id=([\w-]{20,})/)?.[1];
  if (drive) return { kind: "drive", src: `https://drive.google.com/file/d/${drive}/preview` };
  if (/^https?:\/\//.test(url)) return { kind: "file", src: url };
  return null;
}

export const VideoEmbed = Node.create({
  name: "videoEmbed",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      url: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-video"),
        renderHTML: (attributes) => ({ "data-video": attributes.url }),
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'figure[data-video]' },
      { tag: 'iframe[data-video]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["figure", { ...HTMLAttributes, "data-video": HTMLAttributes["data-video"] ?? "" }, 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(({ node, selected, deleteNode }) => {
      const url: string = node.attrs.url ?? "";
      const player = playerSrc(url);
      return (
        <NodeViewWrapper
          as="figure"
          data-video={url}
          className={`my-3 rounded-lg border p-2 transition-shadow ${selected ? "border-[#A4161A] shadow-[0_0_0_2px_rgba(164,22,26,0.3)]" : "border-rule bg-paper-alt"}`}
        >
          <div className="relative aspect-video w-full overflow-hidden rounded-md bg-ink">
            {player?.kind === "youtube" && (
              <iframe src={player.src} title="Vidéo intégrée" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen className="h-full w-full" />
            )}
            {player?.kind === "drive" && (
              <iframe src={player.src} title="Vidéo Google Drive" allow="autoplay" className="h-full w-full" />
            )}
            {player?.kind === "file" && (
              <video src={player.src} controls muted playsInline className="h-full w-full" />
            )}
            {!player && (
              <div className="flex h-full items-center justify-center text-xs text-white/60">Vidéo : {url}</div>
            )}
          </div>
          <figcaption className="mt-1.5 flex items-center justify-between gap-2 text-[0.65rem] text-ink-faint">
            <span className="truncate">🎬 {url}</span>
            <button
              type="button"
              onClick={deleteNode}
              className="shrink-0 rounded border border-rule px-1.5 py-0.5 text-[0.6rem] font-bold text-ink-faint transition-colors hover:border-[#A4161A] hover:text-[#A4161A]"
            >
              Supprimer
            </button>
          </figcaption>
        </NodeViewWrapper>
      );
    });
  },
});
