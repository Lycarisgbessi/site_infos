"use client";

import { useState } from "react";
import Link from "next/link";
import type { SiteBannerView } from "@/lib/public/homepage-data";

/**
 * Bandeaux du site (type alerte/info/promo) — bandeau fin en haut de page,
 * couleur adaptée au style, lien cliquable, fermeture côté client.
 */

const STYLES: Record<string, string> = {
  alert: "bg-brand-red text-white",
  info: "bg-ink text-paper",
  promo: "bg-paper-alt text-ink border-b border-rule",
};

export function SiteBannerBar({ banners, closeLabel }: { banners: SiteBannerView[]; closeLabel: string }) {
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const visible = banners.filter((b) => !closed.has(b.id));
  if (visible.length === 0) return null;

  return (
    <>
      {visible.map((b) => {
        const style = STYLES[b.style] ?? STYLES.info;
        const isInternal = b.linkUrl ? b.linkUrl.startsWith("/") : false;
        return (
          <div key={b.id} role="status" className={`${style} text-sm`}>
            <div className="container-page flex items-center justify-center gap-3 py-1.5 text-center">
              <p className="min-w-0 flex-1 truncate font-medium">
                {b.message}
                {b.linkUrl && b.linkLabel && (
                  <>
                    {" "}
                    {isInternal ? (
                      <Link href={b.linkUrl} className="font-bold underline underline-offset-2 hover:decoration-2">
                        {b.linkLabel}
                      </Link>
                    ) : (
                      <a
                        href={b.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold underline underline-offset-2 hover:decoration-2"
                      >
                        {b.linkLabel}
                      </a>
                    )}
                  </>
                )}
              </p>
              {b.isDismissible && (
                <button
                  type="button"
                  aria-label={closeLabel}
                  onClick={() => setClosed((prev) => new Set(prev).add(b.id))}
                  className="shrink-0 opacity-70 transition-opacity duration-200 hover:opacity-100"
                >
                  <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 fill-none stroke-current" strokeWidth="1.8">
                    <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
