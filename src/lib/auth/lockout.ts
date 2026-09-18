import { db } from "@/lib/db";

/**
 * Verrouillage de compte (§08.3) : 5 échecs → verrou 15 minutes.
 * Colonnes normatives : users.failed_attempts, users.locked_until.
 */

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_DURATION_MIN = 15;

export function isLocked(lockedUntil: Date | null): boolean {
  return lockedUntil !== null && lockedUntil.getTime() > Date.now();
}

export function lockRemainingSec(lockedUntil: Date | null): number {
  if (!lockedUntil) return 0;
  return Math.max(0, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000));
}

/** Enregistre un échec de connexion et verrouille si le seuil est atteint. */
export async function registerFailedAttempt(userId: string): Promise<{
  locked: boolean;
  attempts: number;
}> {
  const user = await db.user.update({
    where: { id: userId },
    data: { failed_attempts: { increment: 1 } },
    select: { failed_attempts: true },
  });

  if (user.failed_attempts >= MAX_FAILED_ATTEMPTS) {
    const locked_until = new Date(Date.now() + LOCK_DURATION_MIN * 60 * 1000);
    await db.user.update({
      where: { id: userId },
      data: { locked_until, failed_attempts: 0 },
    });
    return { locked: true, attempts: MAX_FAILED_ATTEMPTS };
  }

  return { locked: false, attempts: user.failed_attempts };
}

/** Réinitialise les compteurs après une connexion réussie. */
export async function resetFailedAttempts(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { failed_attempts: 0, locked_until: null },
  });
}
