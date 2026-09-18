"use client";

/**
 * Client fetch homogène pour le back-office : déplie l'enveloppe {data,meta}
 * (§07.1/§07.2) et transforme les erreurs {error:{code,message}} en exception
 * typée affichable (toast).
 */

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

interface ApiEnvelope<T> {
  data?: T;
  meta?: Record<string, unknown>;
  error?: { code: string; message: string };
}

export async function apiFetch<T>(
  url: string,
  init?: RequestInit & { json?: unknown }
): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const { json, ...rest } = init ?? {};
  const response = await fetch(url, {
    ...rest,
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(rest.headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.error) {
    throw new ApiError(
      response.status,
      payload?.error?.code ?? "UNKNOWN",
      payload?.error?.message ?? `Erreur ${response.status}`
    );
  }
  if (payload === null || payload.data === undefined) {
    throw new ApiError(response.status, "EMPTY", "Réponse vide du serveur.");
  }
  return { data: payload.data, meta: payload.meta };
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Erreur inconnue.";
}
