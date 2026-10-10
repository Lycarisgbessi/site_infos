import webpush from "web-push";
import { db } from "@/lib/db";

/**
 * Service d'envoi Web Push (notifications nouvelle publication).
 * - Clés VAPID via VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (+ VAPID_SUBJECT optionnel).
 * - Si les clés sont absentes : log et retour silencieux (jamais bloquant).
 * - Les subscriptions expirées (404/410) sont purgées automatiquement.
 */

export interface PushNewPublicationPayload {
  titre: string;
  url: string;
  /** Optionnel : type de publication (article, vidéo, podcast) affiché dans le corps. */
  type?: "article" | "video" | "podcast";
}

function getVapidConfig(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.warn(
      "[push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY absents — envoi de notifications ignoré.",
    );
    return null;
  }
  return { publicKey, privateKey, subject: process.env.VAPID_SUBJECT ?? "mailto:contact@infospro.app" };
}

export async function sendPushNewPublication(payload: PushNewPublicationPayload): Promise<void> {
  try {
    const vapid = getVapidConfig();
    if (!vapid) return;

    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

    const subscriptions = await db.pushSubscription.findMany({
      select: { id: true, endpoint: true, keys: true },
    });
    if (subscriptions.length === 0) return;

    const message = JSON.stringify({
      title: "INFOSPRO",
      body:
        payload.type === "podcast"
          ? `Nouveau podcast : ${payload.titre}`
          : payload.type === "video"
            ? `Nouvelle vidéo : ${payload.titre}`
            : payload.titre,
      url: payload.url,
    });

    await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        let keys: { p256dh?: string; auth?: string } = {};
        try {
          keys = JSON.parse(subscription.keys) as typeof keys;
        } catch {
          keys = {};
        }
        if (!keys.p256dh || !keys.auth) return;

        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: keys.p256dh, auth: keys.auth },
            },
            message,
          );
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            // Subscription expirée → purge
            await db.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => {});
          }
        }
      }),
    );
  } catch (error) {
    // Jamais bloquant pour l'appelant (publication).
    console.error("[push] Échec de l'envoi des notifications:", error);
  }
}
