import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { fontVariables } from "@/lib/fonts";
import { getTranslations, resolveLocale, localeDir, localeTag } from "@/lib/i18n";
import { AudioPlayerProvider } from "@/components/public/audio-player/context";
import { AudioFloatingBar } from "@/components/public/audio-player/floating-bar";
import { PwaRegister } from "@/components/public/pwa/pwa-register";
import { InstallBanner } from "@/components/public/pwa/install-banner";

/**
 * Layout racine. La langue du produit est le français (§00.2 règle 10).
 * Le titre/description finaux seront pilotés par la table `settings`
 * au moment du front-office (PHASE 4) — règle « aucune donnée en dur ».
 */
export const metadata: Metadata = {
  title: {
    default: "INFOSPRO",
    template: "%s · INFOSPRO",
  },
  description:
    "Plateforme média numérique INFOSPRO — l'information de Guinée et du monde.",
  applicationName: "INFOSPRO",
  robots: { index: true, follow: true },
};

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
