import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { fontVariables } from "@/lib/fonts";
import { getTranslations, resolveLocale, localeDir, localeTag } from "@/lib/i18n";
import { getSettingsValues } from "@/server/services/settings";
import { AudioPlayerProvider } from "@/components/public/audio-player/context";
import { AudioFloatingBar } from "@/components/public/audio-player/floating-bar";
import { PwaRegister } from "@/components/public/pwa/pwa-register";
import { InstallBanner } from "@/components/public/pwa/install-banner";
import { AdCorner } from "@/components/public/ad-corner";
import { Chatbot } from "@/components/public/chatbot";
import { getAdCampaigns } from "@/lib/public/homepage-data";

/**
 * Layout racine. La langue du produit est le français (§00.2 règle 10).
 * Identité (titre, baseline) pilotée par la table `settings` — règle
 * « aucune donnée en dur » : identity.site_name, identity.baseline,
 * seo.default_title ; replis INFOSPRO si les clés sont absentes.
 */
const FALLBACK_SITE_NAME = "INFOSPRO";
const FALLBACK_DESCRIPTION =
  "Plateforme média numérique INFOSPRO — l'information de Guinée et du monde.";

export async function generateMetadata(): Promise<Metadata> {
  // Résilient : ce code s'exécute aussi au build (prérendu de la 404) —
  // une base indisponible ne doit jamais casser le build ou la page.
  let settings: Record<string, string> = {};
  try {
    settings = await getSettingsValues([
      "identity.site_name",
      "identity.baseline",
      "seo.default_title",
    ]);
  } catch {
    settings = {};
  }
  const siteName = settings["identity.site_name"] || FALLBACK_SITE_NAME;
  const defaultTitle = settings["seo.default_title"] || siteName;
  const description = settings["identity.baseline"] || FALLBACK_DESCRIPTION;

  return {
    title: {
      default: defaultTitle,
      template: `%s · ${siteName}`,
    },
    description,
    applicationName: siteName,
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0D0C" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { translate } = await getTranslations();
  const locale = await resolveLocale();

  // Campagnes du popup publicitaire (coin bas-gauche) — best-effort.
  const adCampaigns = await getAdCampaigns().catch(() => ({}) as Awaited<ReturnType<typeof getAdCampaigns>>);

  return (
    <html lang={localeTag(locale)} dir={localeDir(locale)} suppressHydrationWarning>
      <body className={`${fontVariables} antialiased bg-background text-foreground`}>
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* Lecteur audio flottant — état global persistant à travers la navigation */}
          <AudioPlayerProvider>
            {children}
            <AudioFloatingBar
              labels={{
                play: translate("public.audio.play"),
                pause: translate("public.audio.pause"),
                close: translate("public.audio.close"),
              }}
            />
            </AudioPlayerProvider>
          {/* Publicité flottante — coin inférieur gauche (fermable 24 h) */}
          <AdCorner campaigns={adCampaigns["AD-11"] ?? []} label={translate("public.ad.label")} />

          {/* Chatbot — coin inférieur droit */}
          <Chatbot />

          {/* PWA — service worker + bannière d'installation/notifications */}
          <PwaRegister />
          <InstallBanner
            labels={{
              installTitle: translate("public.pwa.installTitle"),
              installHint: translate("public.pwa.installHint"),
              notificationsHint: translate("public.pwa.notificationsHint"),
              notificationsOn: translate("public.pwa.notificationsOn"),
              enableNotifications: translate("public.pwa.enableNotifications"),
              install: translate("public.pwa.install"),
              close: translate("public.pwa.close"),
            }}
          />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
