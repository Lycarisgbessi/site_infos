import type { NextConfig } from "next";

/**
 * Configuration Next.js — INFOSPRO.NET.
 *
 * En-têtes de sécurité (§17.1) : la CSP stricte avec nonce sera posée en
 * PHASE 4 (front-office) avec le plumbing nonce/streaming complet ; les
 * autres en-têtes sont actifs dès le socle. HSTS n'est émis qu'en
 * production (TLS terminé par la plateforme).
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=()",
  },
  ...(process.env.NODE_ENV === "production"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
