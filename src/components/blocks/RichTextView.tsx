import type { RichText, RichTextFragment } from "@/types/blocks";

/**
 * Rendu serveur des fragments RichText (§06.4) en éléments React.
 * Marques : bold, italic, underline, strike, code, sup, sub + liens.
 * Les href ne sont rendus en <a> que s'ils sont sûrs : http, https,
 * mailto, tel, ancres (#…) et chemins relatifs — sinon texte simple.
 */

const SAFE_URL_PATTERN = /^(https?:|mailto:|tel:|\/|#|\.\.?\/)/i;

function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  if (trimmed === "" || /\s/.test(trimmed)) return false;
  // Blocage des tentatives de contournement type "java\nscript:" ou "javascript&colon;"
  if (/[\u0000-\u001f]/.test(trimmed)) return false;
  return SAFE_URL_PATTERN.test(trimmed);
}

function FragmentSpan({ fragment }: { fragment: RichTextFragment }) {
  let node: React.ReactNode = fragment.text;

  if (fragment.marks?.includes("code")) {
    node = <code className="rounded bg-paper-alt px-1 py-0.5 font-mono text-[0.92em]">{node}</code>;
  }
  if (fragment.marks?.includes("sup")) node = <sup>{node}</sup>;
  if (fragment.marks?.includes("sub")) node = <sub>{node}</sub>;
  if (fragment.marks?.includes("bold")) node = <strong className="font-bold">{node}</strong>;
  if (fragment.marks?.includes("italic")) node = <em>{node}</em>;
  if (fragment.marks?.includes("underline")) node = <u>{node}</u>;
  if (fragment.marks?.includes("strike")) node = <s>{node}</s>;

  if (fragment.link && isSafeHref(fragment.link.href)) {
    const isExternal = /^(https?:)?\/\//i.test(fragment.link.href.trim()) || fragment.link.external;
    return (
      <a
        href={fragment.link.href}
        className="text-brand-red underline decoration-1 underline-offset-2 hover:decoration-2"
        {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {node}
      </a>
    );
  }
  return <>{node}</>;
}

export function RichTextView({ value }: { value: RichText }) {
  if (value.length === 0) return null;
  return (
    <>
      {value.map((fragment, i) => (
        <FragmentSpan key={i} fragment={fragment} />
      ))}
    </>
  );
}
