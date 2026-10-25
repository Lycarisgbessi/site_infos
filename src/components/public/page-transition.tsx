"use client";

import { usePathname } from "next/navigation";

/**
 * Transition de page — chaque navigation relance une entrée douce
 * (fondu + montée + flou de mouvement, 620 ms expo-out, cf. .page-enter
 * dans globals.css). Key sur le pathname : le contenu est re-monté à
 * chaque route, l'animation démarre donc naturellement.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
