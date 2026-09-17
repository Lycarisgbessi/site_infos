import { parseJsonObject, parseJsonArrayObjects } from "@/lib/json";
import { RichTextView } from "./RichTextView";
import type { Block } from "@/types/blocks";

/**
 * Rendu des blocs de contenu (§06.4) — utilisé par la prévisualisation
 * /admin/preview/[id] (Phase 2) puis par le front-office (Phase 4).
 *
 * Les blocs `ad` sont insérés automatiquement au rendu après le 3ᵉ et le
 * 7ᵉ paragraphe si aucun bloc ad manuel n'existe (§06.4).
 */

export interface MediaLike {
  id: string;
  url: string;
  alt_text: string | null;
  credit: string | null;
  caption: string | null;
  mime_type?: string | null;
  width: number | null;
  height: number | null;
  variants: string;
  focal_point?: string | null;
}

export interface BlockRendererProps {
  blocks: Block[];
  mediaById: Map<string, MediaLike>;
  articleTitles: Map<string, string>;
  adsEnabled?: boolean;
}

interface FocalPoint {
  x: number;
  y: number;
}

/** <picture> avec variantes AVIF/WebP (§16.1 srcset) + point focal. */
export function MediaPicture({ media, sizes }: { media: MediaLike; sizes?: string }) {
  const isVariant = (v: unknown): v is { w: number; format: string; url: string } =>
    typeof v === "object" && v !== null && "url" in v && "format" in v && "w" in v;
  const variants = parseJsonArrayObjects(media.variants, isVariant);
  const focal = parseJsonObject<FocalPoint>(media.focal_point ? media.focal_point : "{}", { x: 0.5, y: 0.5 });
  const avif = variants.filter((v) => v.format === "avif" && v.w > 0);
  const webp = variants.filter((v) => v.format === "webp" && v.w > 0);
  const src = webp.length > 0 ? webp[webp.length - 1].url : media.url;
  return (
    <picture>
      {avif.length > 0 && (
        <source type="image/avif" srcSet={avif.map((v) => `${v.url} ${v.w}w`).join(", ")} sizes={sizes} />
      )}
      {webp.length > 0 && (
        <source type="image/webp" srcSet={webp.map((v) => `${v.url} ${v.w}w`).join(", ")} sizes={sizes} />
      )}
      <img
        src={src}
        alt={media.alt_text ?? ""}
        width={media.width ?? undefined}
        height={media.height ?? undefined}
        loading="lazy"
        decoding="async"
        style={{ objectPosition: `${Math.round(focal.x * 100)}% ${Math.round(focal.y * 100)}%` }}
        className="h-auto w-full object-cover"
      />
    </picture>
  );
}

/** Insère les blocs publicitaires automatiques (§06.4) au rendu. */
export function withAutoAdBlocks(blocks: Block[]): Block[] {
  if (blocks.some((b) => b.type === "ad")) return blocks;
  const paragraphIndexes = blocks.reduce<number[]>((acc, b, i) => {
    if (b.type === "paragraph") acc.push(i);
    return acc;
  }, []);
  const adAfter = new Set([paragraphIndexes[2], paragraphIndexes[6]].filter((i): i is number => i !== undefined));
  if (adAfter.size === 0) return blocks;
  const out: Block[] = [];
  blocks.forEach((b, i) => {
    out.push(b);
    if (adAfter.has(i)) {
      out.push({ id: `ad-auto-${i}`, type: "ad", slotCode: "AD-04" });
    }
  });
  return out;
}

export function BlockRenderer({ blocks, mediaById, articleTitles, adsEnabled = true }: BlockRendererProps) {
  const list = adsEnabled ? withAutoAdBlocks(blocks) : blocks;

  return (
    <div className="article-blocks">
      {list.map((block) => (
        <BlockView key={block.id} block={block} mediaById={mediaById} articleTitles={articleTitles} />
      ))}
    </div>
  );
}

function AdPlaceholder({ slotCode }: { slotCode: string }) {
  return (
    <div className="my-8 border border-dashed border-rule bg-paper-alt p-6 text-center text-xs tracking-widest text-ink-faint">
      PUBLICITÉ · {slotCode}
    </div>
  );
}

function BlockView({
  block,
  mediaById,
  articleTitles,
}: {
  block: Block;
  mediaById: Map<string, MediaLike>;
  articleTitles: Map<string, string>;
}) {
  switch (block.type) {
    case "paragraph":
      return (
        <p className="my-5 text-[1.075rem] leading-[1.75]">
          <RichTextView value={block.text} />
        </p>
      );

    case "heading":
      return block.level === 2 ? (
        <h2 id={block.anchor ?? undefined} className="mt-10 mb-4 font-serif text-2xl font-bold">{block.text}</h2>
      ) : block.level === 3 ? (
        <h3 id={block.anchor ?? undefined} className="mt-8 mb-3 font-serif text-xl font-bold">{block.text}</h3>
      ) : (
        <h4 id={block.anchor ?? undefined} className="mt-6 mb-2 font-serif text-lg font-bold">{block.text}</h4>
      );

    case "list": {
      const items = block.items.map((item, i) => (
        <li key={i} className="my-1.5 leading-relaxed"><RichTextView value={item} /></li>
      ));
      return block.style === "number" ? (
        <ol className="my-5 list-decimal space-y-1 pl-6">{items}</ol>
      ) : (
        <ul className="my-5 list-disc space-y-1 pl-6">{items}</ul>
      );
    }

    case "quote":
      return (
        <blockquote className="my-7 border-l-2 border-brand-red pl-5">
          <p className="font-serif text-xl leading-relaxed">« {block.text} »</p>
          {(block.author || block.role) && (
            <footer className="mt-2 text-sm text-ink-soft">
              {block.author}
              {block.role ? ` — ${block.role}` : ""}
            </footer>
          )}
        </blockquote>
      );

    case "pullquote":
      return (
        <aside className="my-9 px-2 text-center">
          <p className="font-serif text-2xl font-bold leading-snug">« {block.text} »</p>
          {block.author && <p className="mt-3 kicker">{block.author}</p>}
        </aside>
      );

    case "keypoints":
      return (
        <section className="my-8 border border-rule bg-paper-alt p-5">
          <p className="kicker">{block.title ?? "À retenir"}</p>
          <ul className="mt-3 space-y-2">
            {block.items.map((item, i) => (
              <li key={i} className="flex gap-2 text-[1.02rem] leading-relaxed">
                <span aria-hidden className="mt-2 inline-block size-1.5 shrink-0 rounded-full bg-brand-red" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      );

    case "image": {
      const media = mediaById.get(block.mediaId);
      if (!media) return null;
      return (
        <figure className={`my-8 ${block.size === "full" ? "w-screen relative left-1/2 -translate-x-1/2 max-w-[100vw]" : block.size === "wide" ? "" : ""}`}>
          <MediaPicture media={media} />
          {(media.caption || media.credit) && (
            <figcaption className="mt-2 text-xs text-ink-faint">
              {media.caption}
              {media.credit ? ` · ${media.credit}` : ""}
            </figcaption>
          )}
          {block.caption && <figcaption className="mt-1 text-xs text-ink-faint">{block.caption}</figcaption>}
        </figure>
      );
    }

    case "gallery": {
      const medias = block.mediaIds.map((id) => mediaById.get(id)).filter((m): m is MediaLike => Boolean(m));
      if (medias.length === 0) return null;
      if (block.layout === "carousel") {
        return (
          <div className="my-8 flex snap-x gap-3 overflow-x-auto pb-2">
            {medias.map((m) => (
              <figure key={m.id} className="min-w-[85%] snap-start">
                <MediaPicture media={m} sizes="(max-width: 768px) 85vw, 600px" />
                {m.caption && <figcaption className="mt-1 text-xs text-ink-faint">{m.caption}</figcaption>}
              </figure>
            ))}
          </div>
        );
      }
      return (
        <div className={`my-8 grid gap-2 ${block.layout === "mosaic" ? "grid-cols-2 md:grid-cols-3" : "grid-cols-2"}`}>
          {medias.map((m) => (
            <MediaPicture key={m.id} media={m} sizes="(max-width: 768px) 50vw, 33vw" />
          ))}
        </div>
      );
    }

    case "video": {
      if (block.provider === "youtube") {
        const url = block.playbackId ? `https://www.youtube-nocookie.com/embed/${block.playbackId}` : "";
        if (!url) return null;
        return (
          <figure className="my-8 aspect-video w-full">
            <iframe src={url} title={block.caption ?? "Vidéo"} allowFullScreen loading="lazy" className="h-full w-full border-0" />
            {block.caption && <figcaption className="mt-2 text-xs text-ink-faint">{block.caption}</figcaption>}
          </figure>
        );
      }
      const media = block.mediaId ? mediaById.get(block.mediaId) : undefined;
      if (!media) return null;
      return (
        <figure className="my-8">
          <video controls preload="metadata" className="h-auto w-full">
            <source src={media.url} type={media.mime_type ?? undefined} />
          </video>
          {block.caption && <figcaption className="mt-2 text-xs text-ink-faint">{block.caption}</figcaption>}
        </figure>
      );
    }

    case "audio": {
      const media = mediaById.get(block.mediaId);
      if (!media) return null;
      return (
        <figure className="my-8 border border-rule p-4">
          {block.title && <figcaption className="mb-2 text-sm font-semibold">{block.title}</figcaption>}
          <audio controls preload="metadata" className="w-full">
            <source src={media.url} type={media.mime_type ?? undefined} />
          </audio>
        </figure>
      );
    }

    case "table":
      return (
        <figure className="my-8 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {block.headers.map((h, i) => (
                  <th key={i} className="border-b-2 border-rule bg-paper-alt px-3 py-2 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="border-b border-rule">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2 align-top">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {(block.caption || block.source) && (
            <figcaption className="mt-2 text-xs text-ink-faint">
              {block.caption}
              {block.source ? ` · Source : ${block.source}` : ""}
            </figcaption>
          )}
        </figure>
      );

    case "embed": {
      const embedSrc = embedUrl(block.provider, block.url);
      if (!embedSrc) {
        return (
          <p className="my-6 border border-rule bg-paper-alt p-4 text-sm">
            <a href={block.url} target="_blank" rel="noopener noreferrer" className="text-brand-red underline">
              Contenu intégré — {block.provider}
            </a>
          </p>
        );
      }
      return (
        <figure className="my-8 mx-auto aspect-video w-full max-w-2xl">
          <iframe
            src={embedSrc}
            title="Contenu intégré"
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-popups"
            referrerPolicy="no-referrer"
            className="h-full w-full border-0"
          />
        </figure>
      );
    }

    case "chart":
      return <ChartBlock block={block} />;

    case "map": {
      const d = 0.02;
      const bbox = `${block.lng - d}%2C${block.lat - d}%2C${block.lng + d}%2C${block.lat + d}`;
      return (
        <figure className="my-8">
          <iframe
            title="Carte"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${block.lat}%2C${block.lng}`}
            loading="lazy"
            className="aspect-[4/3] w-full border-0"
          />
        </figure>
      );
    }

    case "timeline":
      return (
        <ol className="my-8 space-y-4 border-l-2 border-rule pl-5">
          {block.events.map((ev, i) => (
            <li key={i} className="relative">
              <span aria-hidden className="absolute -left-[26px] top-1.5 size-2.5 rounded-full bg-brand-red" />
              <p className="kicker">{ev.date}</p>
              <p className="font-serif font-bold">{ev.title}</p>
              {ev.text && <p className="mt-1 text-sm leading-relaxed text-ink-soft">{ev.text}</p>}
            </li>
          ))}
        </ol>
      );

    case "beforeafter": {
      const before = mediaById.get(block.beforeMediaId);
      const after = mediaById.get(block.afterMediaId);
      if (!before || !after) return null;
      return (
        <figure className="my-8 grid grid-cols-2 gap-1">
          <div>
            <MediaPicture media={before} />
            <figcaption className="mt-1 text-center text-xs text-ink-faint">{block.labels?.[0] ?? "Avant"}</figcaption>
          </div>
          <div>
            <MediaPicture media={after} />
            <figcaption className="mt-1 text-center text-xs text-ink-faint">{block.labels?.[1] ?? "Après"}</figcaption>
          </div>
        </figure>
      );
    }

    case "definition":
      return (
        <dl className="my-6 border-l-2 border-rule pl-4">
          <dt className="font-semibold">{block.term}</dt>
          <dd className="mt-1 text-[1.02rem] leading-relaxed text-ink-soft">{block.definition}</dd>
        </dl>
      );

    case "readmore":
      return (
        <section className="my-8 border border-rule p-5">
          <p className="kicker">À lire aussi</p>
          <ul className="mt-3 space-y-2">
            {block.articleIds.map((id) => {
              const title = articleTitles.get(id);
              if (!title) return null;
              return (
                <li key={id} className="font-serif font-semibold leading-snug">
                  {title}
                </li>
              );
            })}
          </ul>
        </section>
      );

    case "qa":
      return (
        <div className="my-6">
          <p className="font-serif text-lg font-bold">« {block.question} »</p>
          <p className="mt-2 pl-4 text-[1.05rem] leading-relaxed">
            <RichTextView value={block.answer} />
          </p>
        </div>
      );

    case "factcheck":
      return (
        <section className="my-8 border border-rule">
          <div className="flex items-center gap-2 border-b border-rule bg-paper-alt px-4 py-2">
            <span className="kicker">Vérification</span>
            <span className="rounded-sm bg-brand-red px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
              {verdictLabel(block.verdict)}
            </span>
          </div>
          <div className="px-4 py-3">
            <p className="font-semibold">« {block.claim} »</p>
            <p className="mt-2 text-[1.02rem] leading-relaxed">{block.explanation}</p>
            {block.sources.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {block.sources.map((s, i) => (
                  <li key={i}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-brand-red underline">
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      );

    case "divider":
      return <hr className="my-10 border-0 border-t border-rule" />;

    case "code":
      return (
        <pre className="my-6 overflow-x-auto rounded-sm bg-ink p-4 text-sm leading-relaxed text-paper">
          <code>{block.code}</code>
        </pre>
      );

    case "newsletter":
      return (
        <section className="my-8 border border-rule bg-paper-alt p-6 text-center">
          <p className="font-serif text-lg font-bold">Recevez notre newsletter</p>
          <p className="mt-1 text-sm text-ink-soft">Inscription disponible prochainement.</p>
        </section>
      );

    case "ad":
      return <AdPlaceholder slotCode={block.slotCode} />;

    default:
      return null;
  }
}

function verdictLabel(verdict: string): string {
  switch (verdict) {
    case "true": return "Vrai";
    case "misleading": return "Trompeur";
    case "false": return "Faux";
    default: return "Invérifiable";
  }
}

function embedUrl(provider: string, url: string): string | null {
  try {
    const u = new URL(url);
    switch (provider) {
      case "youtube": {
        const id = u.searchParams.get("v") ?? u.pathname.split("/").pop();
        return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
      }
      case "x":
        return `https://twitframe.com/show?url=${encodeURIComponent(url)}`;
      case "facebook":
        return `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}`;
      case "instagram":
        return `https://www.instagram.com/p/${u.pathname.split("/")[2]}/embed`;
      case "tiktok":
        return `https://www.tiktok.com/embed/${u.pathname.split("/").pop()}`;
      case "iframe":
        return url;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/** Graphique SVG minimal (line/bar/area) rendu côté serveur. */
function ChartBlock({ block }: { block: Extract<Block, { type: "chart" }> }) {
  const data = block.data;
  const points: { label: string; value: number }[] = (Array.isArray(data) ? data : []).map((d: unknown) =>
    typeof d === "number" ? { label: "", value: d } : { label: String((d as { label?: unknown })?.label ?? ""), value: Number((d as { value?: unknown })?.value ?? 0) }
  );

  if (points.length === 0) return null;
  const max = Math.max(...points.map((p) => p.value), 1);
  const w = 600;
  const h = 220;

  if (block.chartType === "pie") {
    let acc = 0;
    const total = points.reduce((s, p) => s + p.value, 0) || 1;
    const colors = ["#C8102E", "#14110F", "#6B6560", "#A39C94", "#D9D4CE"];
    return (
      <figure className="my-8">
        <svg viewBox="0 0 200 200" className="mx-auto h-56" role="img" aria-label="Graphique circulaire">
          {points.map((p, i) => {
            const frac = p.value / total;
            const start = acc * 2 * Math.PI;
            acc += frac;
            const end = acc * 2 * Math.PI;
            const large = frac > 0.5 ? 1 : 0;
            const x1 = 100 + 90 * Math.cos(start - Math.PI / 2);
            const y1 = 100 + 90 * Math.sin(start - Math.PI / 2);
            const x2 = 100 + 90 * Math.cos(end - Math.PI / 2);
            const y2 = 100 + 90 * Math.sin(end - Math.PI / 2);
            return (
              <path key={i} d={`M100,100 L${x1},${y1} A90,90 0 ${large} 1 ${x2},${y2} Z`} fill={colors[i % colors.length]} />
            );
          })}
        </svg>
        <figcaption className="mt-2 text-center text-xs text-ink-faint">Source : {block.source}</figcaption>
      </figure>
    );
  }

  const barW = w / points.length;
  const path = points
    .map((p, i) => `${(i + 0.5) * barW},${h - (p.value / max) * (h - 20) - 10}`)
    .join(" ");

  return (
    <figure className="my-8">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label="Graphique">
        {block.chartType === "bar" &&
          points.map((p, i) => (
            <rect
              key={i}
              x={i * barW + barW * 0.15}
              y={h - (p.value / max) * (h - 20) - 10}
              width={barW * 0.7}
              height={(p.value / max) * (h - 20)}
              fill="#C8102E"
            />
          ))}
        {(block.chartType === "line" || block.chartType === "area") && (
          <>
            {block.chartType === "area" && (
              <polygon points={`0,${h} ${path} ${w},${h}`} fill="#C8102E" opacity="0.15" />
            )}
            <polyline points={path} fill="none" stroke="#C8102E" strokeWidth="2.5" />
          </>
        )}
      </svg>
      <figcaption className="mt-2 text-center text-xs text-ink-faint">Source : {block.source}</figcaption>
    </figure>
  );
}
