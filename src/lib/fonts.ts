import {
  Inter,
  JetBrains_Mono,
  Source_Serif_4,
} from "next/font/google";

/**
 * Polices du design system (§05.2) :
 * - Source Serif 4 : titraille (serif)
 * - Inter : interface et corps d'article (sans)
 * - JetBrains Mono : code, données (mono)
 *
 * WOFF2 auto-hébergé par next/font, sous-ensemble latin, font-display: swap,
 * métriques de repli ajustées (adjustFontFallback) pour CLS = 0 (§05.2, §16.1).
 * 2 graisses préchargées maximum par famille.
 */

export const fontSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-source-serif",
  display: "swap",
  adjustFontFallback: true,
});

export const fontSans = Inter({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-inter",
  display: "swap",
  adjustFontFallback: true,
});

export const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  adjustFontFallback: true,
});

export const fontVariables = `${fontSerif.variable} ${fontSans.variable} ${fontMono.variable}`;
