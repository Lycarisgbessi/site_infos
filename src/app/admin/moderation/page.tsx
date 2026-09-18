import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ModerationClient } from "@/components/admin/moderation/ModerationClient";

/**
 * Écran /admin/moderation — « Boîte unifiée » (§11.2) : file des
 * commentaires, boîte de réception (contacts, alertes info, droits de
 * réponse…), filtrage automatique haine/spam (mots bloqués), actions
 * groupées, bannissement et traçabilité des décisions.
 *
 * Garde serveur : session obligatoire ; les permissions comment.moderate
 * et inbox.read sont contrôlées par l'API (403 affiché tel quel).
 */

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Modération",
};

export default async function AdminModerationPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/moderation");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="kicker text-brand-red">Boîte unifiée</p>
        <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-ink">
          Modération
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-faint">
          Commentaires, contacts et alertes info réunis au même endroit :
          file d&apos;attente, actions groupées, mots bloqués, bannissement et
          réponse officielle identifiée. Chaque décision est enregistrée au
          journal d&apos;audit.
        </p>
      </header>
      <ModerationClient
        currentUserId={session.user.id}
        currentUserName={session.user.displayName}
      />
    </div>
  );
}
