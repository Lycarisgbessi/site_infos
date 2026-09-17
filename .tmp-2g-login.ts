/**
 * Temp (2-g) : session admin pour vérification navigateur — TOTP calculé
 * depuis le secret en base (aucune donnée modifiée).
 */
import { TOTP } from "otplib";
import { NobleCryptoPlugin } from "@otplib/plugin-crypto-noble";
import { ScureBase32Plugin } from "@otplib/plugin-base32-scure";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BASE = "http://localhost:3000";

const user = await db.user.findUnique({
  where: { email: "admin@infospro.net" },
  select: { id: true, two_factor_secret: true },
});
if (!user?.two_factor_secret) throw new Error("Admin/secret introuvable");

const totp = new TOTP({
  issuer: "INFOSPRO",
  crypto: new NobleCryptoPlugin(),
  base32: new ScureBase32Plugin(),
});
const code = await totp.generate({ secret: user.two_factor_secret });
console.log("TOTP:", code);

const headers = {
  "content-type": "application/json",
  "X-Forwarded-For": "10.7.0.77",
};

const step1 = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    email: "admin@infospro.net",
    password: "cKhs6MqHAa!yNLfOw",
  }),
});
console.log("login:", step1.status);
const body1 = (await step1.json()) as {
  data?: { mfaRequired: boolean; challengeToken?: string };
};
if (!body1.data?.mfaRequired || !body1.data.challengeToken) {
  throw new Error("Réponse inattendue: " + JSON.stringify(body1));
}

const step2 = await fetch(`${BASE}/api/auth/mfa`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    challengeToken: body1.data.challengeToken,
    code,
    rememberMe: false,
  }),
});
console.log("mfa:", step2.status);
const raw = step2.headers.getSetCookie?.() ?? [];
const sessionCookie = raw
  .map((c) => c.split(";")[0])
  .find((c) => c.startsWith("infospro_session="));
if (!sessionCookie) throw new Error("Cookie de session absent: " + JSON.stringify(raw));
await Bun.write("/tmp/2g-cookie.txt", sessionCookie);
console.log("COOKIE OK:", sessionCookie.slice(0, 40) + "…");
await db.$disconnect();
