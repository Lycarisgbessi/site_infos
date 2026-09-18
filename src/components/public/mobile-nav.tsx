"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span className="size-9" />;
  const isDark = resolvedTheme === "dark";
  return (
    <button
      aria-label={isDark ? "Mode clair" : "Mode sombre"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex size-9 items-center justify-center text-ink-soft transition-colors hover:text-brand-red"
    >
      {isDark ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      )}
    </button>
  );
}

interface NavItem { label: string; href: string; }

export function MobileMenu({ items, deskLabel, deskHref }: { items: NavItem[]; deskLabel: string; deskHref: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  return (
    <>
      <button aria-label={open ? "Fermer" : "Menu"} aria-expanded={open} onClick={() => setOpen(!open)} className="flex size-9 items-center justify-center text-ink transition-colors hover:text-brand-red md:hidden">
        {open ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
        )}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <nav className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-paper shadow-2xl">
            <div className="flex h-14 items-center justify-between border-b border-rule px-4">
              <span className="font-serif text-lg font-black tracking-tight">INFOS<span className="text-brand-red">PRO</span></span>
              <button aria-label="Fermer" onClick={() => setOpen(false)} className="flex size-8 items-center justify-center text-ink-soft hover:text-brand-red">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <ul className="divide-y divide-rule overflow-y-auto px-2 py-2">
              {items.map((item) => (
                <li key={item.label}><a href={item.href} onClick={() => setOpen(false)} className="block px-3 py-3 text-sm font-semibold text-ink transition-colors hover:bg-paper-alt hover:text-brand-red">{item.label}</a></li>
              ))}
            </ul>
            <div className="border-t border-rule p-4">
              <a href={deskHref} className="block bg-brand-red px-4 py-2.5 text-center text-sm font-bold text-white transition-colors hover:bg-red-deep">{deskLabel}</a>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
