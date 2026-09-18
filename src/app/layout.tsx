import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { fontVariables } from "@/lib/fonts";

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
  robots: { index: false, follow: false }, // PHASE 1 : socle interne, pas d'indexation
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0D0C" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${fontVariables} antialiased bg-background text-foreground`}>
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
