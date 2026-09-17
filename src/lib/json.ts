/**
 * Helpers typés pour les colonnes JSON adaptées (DECISIONS.md D-01).
 *
 * En production PostgreSQL, ces colonnes sont `jsonb` / `text[]` natifs.
 * En développement SQLite, elles sont stockées en `String` sérialisée.
 * Toute lecture/écriture passe par ces helpers : parse à la lecture,
 * stringify à l'écriture, avec repli sûr si la valeur est corrompue.
 */

export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) return parsed.map((v) => String(v));
    return [];
  } catch {
    return [];
  }
}

export function parseJsonArrayObjects<T>(
  value: string | null | undefined,
  guard: (item: unknown) => item is T
): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) return parsed.filter(guard);
    return [];
  } catch {
    return [];
  }
}

export function parseJsonObject<T>(
  value: string | null | undefined,
  fallback: T
): T {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as T;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function stringifyJsonArray(value: readonly unknown[]): string {
  return JSON.stringify(value ?? []);
}

export function stringifyJsonObject(value: Record<string, unknown>): string {
  return JSON.stringify(value ?? {});
}
