"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTheme } from "next-themes";
import { LogOut, Moon, Search, ShieldCheck, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * En-tête du back-office (§11.1) : masthead compact, recherche (palette
 * Ctrl+K), thème clair/sombre, menu utilisateur avec déconnexion.
 */

export interface AdminHeaderProps {
  user: {
    displayName: string;
    email: string;
    roles: string[];
    twoFactorEnabled: boolean;
  };
  labels: {
    signOut: string;
    theme: string;
    security: string;
    search: string;
  };
}

export function AdminHeader({ user, labels }: AdminHeaderProps) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("logout failed");
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error(labels.signOut);
      setSigningOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-[200] border-b border-rule bg-paper">
      <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
        <a href="/admin" className="flex items-baseline gap-1 font-serif text-lg font-bold tracking-tight">
          INFOS<span className="text-brand-red">PRO</span>
          <span className="hidden text-xs font-normal text-ink-faint sm:inline">
            · Back-office
          </span>
        </a>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-ink-soft"
          onClick={() => {
            // Ouvre la palette de commandes (§11.1 : Ctrl+K)
            const event = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true });
            window.dispatchEvent(event);
          }}
        >
          <Search className="size-4" />
          <span className="hidden sm:inline">{labels.search}</span>
          <kbd className="hidden rounded-[2px] border border-rule bg-paper-alt px-1.5 py-0.5 text-[10px] text-ink-faint sm:inline">
            Ctrl K
          </kbd>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          aria-label={labels.theme}
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {resolvedTheme === "dark" ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 rounded-[2px] px-2 py-1.5 text-sm hover:bg-paper-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-red"
              aria-haspopup="menu"
            >
              <span
                aria-hidden
                className="flex size-7 items-center justify-center rounded-full bg-ink font-serif text-xs font-bold text-paper"
              >
                {user.displayName
                  .split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </span>
              <span className="hidden font-medium sm:inline">{user.displayName}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="text-sm font-semibold">{user.displayName}</div>
              <div className="truncate text-xs font-normal text-muted-foreground">
                {user.email}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {user.roles.map((role) => (
                  <span
                    key={role}
                    className="rounded-[2px] border border-rule px-1 py-0.5 text-[10px] uppercase tracking-wide text-ink-faint"
                  >
                    {role}
                  </span>
                ))}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/admin/securite" className="flex items-center gap-2">
                <ShieldCheck className="size-4" />
                {labels.security}
                {user.twoFactorEnabled ? (
                  <span className="ms-auto rounded-[2px] bg-success/10 px-1 text-[10px] font-semibold text-success">
                    2FA
                  </span>
                ) : null}
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={signingOut}
              onSelect={(event) => {
                event.preventDefault();
                void handleSignOut();
              }}
              className="text-brand-red focus:text-brand-red"
            >
              <LogOut className="size-4" />
              {labels.signOut}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
