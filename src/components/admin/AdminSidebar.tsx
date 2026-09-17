"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icons from "lucide-react";

/**
 * Navigation latérale du back-office (§11.1).
 * Items filtrés côté serveur par permissions réelles ; les modules des
 * phases suivantes sont affichés désactivés (état réel, pas de façade).
 */

export interface SidebarItem {
  href: string;
  label: string;
  icon: string;
  enabled: boolean;
  phaseLabel: string | null;
}

function Icon({ name, className }: { name: string; className?: string }) {
  const IconComponent = (Icons as unknown as Record<string, Icons.LucideIcon>)[name];
  if (!IconComponent) return <Icons.Circle className={className} />;
  return <IconComponent className={className} />;
}

export function AdminSidebar({ items }: { items: SidebarItem[] }) {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Navigation du back-office"
      className="hidden w-60 shrink-0 border-e border-rule bg-paper-alt md:block"
    >
      <nav className="sticky top-[57px] max-h-[calc(100vh-57px)] overflow-y-auto px-2 py-4">
        <ul className="space-y-0.5">
          {items.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);

            if (!item.enabled) {
              return (
                <li key={item.href}>
                  <span
                    aria-disabled="true"
                    title={item.phaseLabel ?? undefined}
                    className="flex cursor-not-allowed items-center gap-2.5 rounded-[2px] px-3 py-2 text-sm text-ink-faint"
                  >
                    <Icon name={item.icon} className="size-4" />
                    <span className="flex-1">{item.label}</span>
                    <span className="text-[10px] font-medium uppercase tracking-wider">
                      {item.phaseLabel}
                    </span>
                  </span>
                </li>
              );
            }

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-[2px] px-3 py-2 text-sm transition-colors duration-[160ms] ${
                    active
                      ? "bg-paper-sunk font-semibold text-ink"
                      : "text-ink-soft hover:bg-paper-sunk hover:text-ink"
                  }`}
                >
                  <Icon name={item.icon} className="size-4" />
                  <span className="flex-1">{item.label}</span>
                  {active ? (
                    <span aria-hidden className="h-4 w-0.5 bg-brand-red" />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
