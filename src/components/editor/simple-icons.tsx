/**
 * Icônes légères du mode simple (SVG inline — pas de dépendance).
 * Taille uniforme 18px, trait 2.
 */
const S = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

export const Bold = () => (
  <svg {...S}><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" /></svg>
);
export const Italic = () => (
  <svg {...S}><path d="M14 5h-4m4 0-3 14m3 0h-4" /></svg>
);
export const Underline = () => (
  <svg {...S}><path d="M7 4v6a5 5 0 0 0 10 0V4M5 20h14" /></svg>
);
export const Highlighter = () => (
  <svg {...S}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
);
export const Strikethrough = () => (
  <svg {...S}><path d="M16 4H9a3 3 0 0 0-2.83 4M14 12a4 4 0 0 1 0 8H6M4 12h16" /></svg>
);
export const Link2 = () => (
  <svg {...S}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
);
export const Heading1 = () => (
  <svg {...S}><path d="M4 12h8M4 18V6M12 18V6M17 18v-8l-2 1.5" /></svg>
);
export const Heading2 = () => (
  <svg {...S}><path d="M4 12h8M4 18V6M12 18V6M15 11a2.5 2.5 0 0 1 4.5 1.5c0 1.5-4.5 3.5-4.5 5.5h5" /></svg>
);
export const Heading3 = () => (
  <svg {...S}><path d="M4 12h8M4 18V6M12 18V6M15.5 10.5a2 2 0 1 1 3.5 1.5c-.6 1-3.5 1.6-3.5 3.5h4" /></svg>
);
export const List = () => (
  <svg {...S}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
);
export const ListOrdered = () => (
  <svg {...S}><path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M4 14l2-1v4H4" /></svg>
);
export const Quote = () => (
  <svg {...S}><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" transform="scale(0.9) translate(1.5 1)" /><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" transform="scale(0.9) translate(1.5 1)" /></svg>
);
export const ImagePlus = () => (
  <svg {...S}><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7M16 3h5v5M8 15l2-2 3 3 3-3 5 5" /></svg>
);
export const Video = () => (
  <svg {...S}><path d="m22 8-6 4 6 4V8zM14 6H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z" /></svg>
);
export const Undo2 = () => (
  <svg {...S}><path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" /></svg>
);
export const Redo2 = () => (
  <svg {...S}><path d="m15 14 5-5-5-5M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13" /></svg>
);
export const DriveIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="inline">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
