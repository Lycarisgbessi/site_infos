"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";

/**
 * Écran « Sécurité » (§08.3, §11.1) : activation de la 2FA TOTP avec QR
 * et codes de secours affichés une seule fois ; liste des sessions actives
 * avec révocation ; changement de mot de passe (politique 12 car. + HIBP).
 */

interface SessionRow {
  id: string;
  ipHash: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

interface TwoFactorSetupPayload {
  secret: string;
  otpauthUri: string;
  qrDataUrl: string;
  backupCodes: string[];
}

export function SecurityClient({
  twoFactorEnabled,
  enforced,
  labels,
}: {
  twoFactorEnabled: boolean;
  enforced: boolean;
  labels: Record<string, string>;
}) {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [setup, setSetup] = useState<TwoFactorSetupPayload | null>(null);
  const [code, setCode] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/sessions", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const json = (await response.json()) as { data: SessionRow[] };
      setSessions(json.data);
    } catch {
      toast.error(labels.sessionsError);
    }
  }, [labels.sessionsError]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  async function startSetup() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/2fa/setup", { method: "POST" });
      if (!response.ok) throw new Error();
      const json = (await response.json()) as { data: TwoFactorSetupPayload };
      setSetup(json.data);
    } catch {
      toast.error(labels.setupError);
    } finally {
      setBusy(false);
    }
  }

  async function confirmActivation() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/2fa/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const json = (await response.json()) as {
        data?: { enabled: boolean };
        error?: { message: string };
      };
      if (!response.ok) {
        toast.error(json.error?.message ?? labels.activateError);
        return;
      }
      toast.success(labels.activated);
      setOpen(false);
      setSetup(null);
      setCode("");
      // La 2FA vient d'être activée : rechargement pour lever la barrière
      if (enforced) {
        window.location.href = "/admin";
        return;
      }
      window.location.reload();
    } catch {
      toast.error(labels.activateError);
    } finally {
      setBusy(false);
    }
  }

  async function revokeSession(id: string) {
    try {
      const response = await fetch(`/api/auth/sessions/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error();
      toast.success(labels.sessionRevoked);
      void loadSessions();
    } catch {
      toast.error(labels.sessionError);
    }
  }

  return (
    <div className="space-y-8">
      <section
        aria-labelledby="2fa-title"
        className="border border-rule bg-paper p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="2fa-title"
              className="flex items-center gap-2 font-serif text-lg font-bold"
            >
              {twoFactorEnabled ? (
                <ShieldCheck className="size-5 text-success" />
              ) : (
                <ShieldAlert className="size-5 text-brand-red" />
              )}
              {labels.twoFactorTitle}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-ink-soft">
              {labels.twoFactorDesc}
            </p>
          </div>
          {twoFactorEnabled ? (
            <Badge className="bg-success/10 text-success hover:bg-success/10">
              {labels.enabledBadge}
            </Badge>
          ) : (
            <Badge variant="destructive">{labels.disabledBadge}</Badge>
          )}
        </div>

        {!twoFactorEnabled ? (
          <Dialog
            open={open}
            onOpenChange={(value) => {
              setOpen(value);
              if (!value) setSetup(null);
            }}
          >
            <DialogTrigger asChild>
              <Button className="mt-4" disabled={busy} onClick={() => setOpen(true)}>
                {labels.activateButton}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{labels.activateButton}</DialogTitle>
                <DialogDescription>{labels.setupSteps}</DialogDescription>
              </DialogHeader>

              {!setup ? (
                <DialogFooter>
                  <Button onClick={startSetup} disabled={busy}>
                    {labels.generateButton}
                  </Button>
                </DialogFooter>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <Image
                      src={setup.qrDataUrl}
                      alt={labels.qrAlt}
                      width={140}
                      height={140}
                      unoptimized
                      className="border border-rule"
                    />
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">{labels.manualEntry}</p>
                      <code className="mt-1 block break-all rounded-[2px] border border-rule bg-paper-alt px-2 py-1 font-mono text-xs">
                        {setup.secret}
                      </code>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="totp-code">{labels.codeLabel}</Label>
                    <Input
                      id="totp-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      value={code}
                      onChange={(event) =>
                        setCode(event.target.value.replace(/[^\d]/g, "").slice(0, 6))
                      }
                      className="mt-1 max-w-40 font-mono tracking-[0.3em]"
                    />
                  </div>

                  <div className="border border-rule bg-red-wash p-3">
                    <p className="text-sm font-semibold">{labels.backupTitle}</p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {labels.backupOnce}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-xs">
                      {setup.backupCodes.map((backup) => (
                        <span key={backup}>{backup}</span>
                      ))}
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      onClick={confirmActivation}
                      disabled={busy || code.length !== 6}
                    >
                      {labels.confirmButton}
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </DialogContent>
          </Dialog>
        ) : null}
      </section>

      <section aria-labelledby="sessions-title" className="border border-rule">
        <h2 id="sessions-title" className="border-b border-rule bg-paper-alt px-4 py-3 font-serif text-base font-bold">
          {labels.sessionsTitle}
        </h2>
        {sessions === null ? (
          <p className="px-4 py-6 text-center text-sm text-ink-faint">
            {labels.loading}
          </p>
        ) : sessions.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-ink-faint">
            {labels.noSessions}
          </p>
        ) : (
          <ul className="divide-y divide-rule">
            {sessions.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.userAgent ?? labels.unknownDevice}
                    {item.current ? (
                      <span className="ms-2 rounded-[2px] border border-success/30 bg-success/10 px-1 text-[10px] font-semibold uppercase text-success">
                        {labels.currentSession}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-faint tabular-nums">
                    {new Intl.DateTimeFormat("fr-FR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Africa/Conakry",
                    }).format(new Date(item.createdAt))}
                  </p>
                </div>
                {!item.current ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revokeSession(item.id)}
                    className="text-brand-red hover:text-brand-red"
                  >
                    <Trash2 className="size-4" />
                    {labels.revoke}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
