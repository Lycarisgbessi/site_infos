import type { Config } from "tailwindcss";

/**
 * INFOSPRO.NET — configuration Tailwind (§03).
 *
 * Tailwind 4 configure le thème en CSS (`@theme` dans src/app/globals.css,
 * jetons normatifs dans src/styles/tokens.css — voir DECISIONS.md D-09).
 * Ce fichier conserve les globs de contenu et la stratégie darkMode.
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
