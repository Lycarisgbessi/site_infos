"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Formulaire de connexion en 2 étapes (§08.3) : mot de passe, puis code
 * TOTP / code de secours si la 2FA est activée. Rate limit serveur 5/15 min.
 */

interface LoginResponse {
  data: {
    mfaRequired: boolean;
    challengeToken?: string;
    user?: { displayName: string };
  };
  error?: { code: string; message: string };
}

export function LoginForm({
  nextPath,
  labels,
}: {
  nextPath: string;
  labels: Record<string, string>;
}) {
  const router = useRouter();

  const [step, setStep] = useState<"password" | "mfa">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [code, setCode] = useState("");
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function handleError(message?: string) {
    toast.error(message ?? labels.genericError);
  }

  async function submitPassword(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      });
      const json = (await response.json()) as LoginResponse;
      if (!response.ok) {
        handleError(json.error?.message);
        return;
      }
      if (json.data.mfaRequired && json.data.challengeToken) {
        setChallengeToken(json.data.challengeToken);
        setStep("mfa");
        return;
      }
      router.replace(nextPath);
      router.refresh();
    } catch {
      handleError(labels.networkError);
    } finally {
      setBusy(false);
    }
  }

  async function submitMfa(event: React.FormEvent) {
    event.preventDefault();
    if (!challengeToken) return;
    setBusy(true);
    try {
      const response = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeToken, code, rememberMe }),
      });
      const json = (await response.json()) as LoginResponse;
      if (!response.ok) {
        handleError(json.error?.message);
        return;
      }
      router.replace(nextPath);
      router.refresh();
    } catch {
      handleError(labels.networkError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <p className="font-serif text-3xl font-bold tracking-tight">
          INFOS<span className="text-brand-red">PRO</span>
        </p>
        <p className="mt-1 text-sm text-ink-faint">{labels.subtitle}</p>
      </div>

      {step === "password" ? (
        <form onSubmit={submitPassword} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="email">{labels.email}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1"
              placeholder="prenom.nom@infospro.net"
            />
          </div>
          <div>
            <Label htmlFor="password">{labels.password}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
            />
            <Label htmlFor="remember" className="text-sm font-normal text-ink-soft">
              {labels.remember}
            </Label>
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? labels.signingIn : labels.signIn}
          </Button>
        </form>
      ) : (
        <form onSubmit={submitMfa} className="space-y-4" noValidate>
          <p className="text-sm text-ink-soft">{labels.mfaHint}</p>
          <div>
            <Label htmlFor="mfa-code">{labels.mfaCode}</Label>
            <Input
              id="mfa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(event) => setCode(event.target.value.trim())}
              className="mt-1 font-mono tracking-[0.25em]"
              placeholder="123456 ou XXXX-XXXX"
              maxLength={12}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy || code.length < 6}>
            {busy ? labels.verifying : labels.verify}
          </Button>
          <button
            type="button"
            className="w-full text-center text-xs text-ink-faint underline underline-offset-2"
            onClick={() => {
              setStep("password");
              setCode("");
              setChallengeToken(null);
            }}
          >
            {labels.backToLogin}
          </button>
        </form>
      )}
    </div>
  );
}
