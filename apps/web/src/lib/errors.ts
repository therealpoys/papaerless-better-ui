import type { TFunction } from "i18next";

export type ErrorKind = "network" | "auth" | "notFound" | "server" | "unknown";

/** Ordnet einen technischen Fehler (z.B. "API-Fehler 502 bei /api/…") einer Kategorie zu. */
export function classifyError(err: unknown): ErrorKind {
  if (err instanceof TypeError) return "network"; // fetch() ohne Verbindung
  const message = err instanceof Error ? err.message : "";
  const status = /API-Fehler (\d{3})/.exec(message)?.[1];
  if (status) {
    const code = Number(status);
    if (code === 401 || code === 403) return "auth";
    if (code === 404) return "notFound";
    if (code >= 500) return "server";
  }
  if (/failed to fetch|networkerror|load failed/i.test(message)) return "network";
  return "unknown";
}

/**
 * Liefert eine verständliche Meldung mit Handlungshinweis statt der rohen err.message.
 * `fallback` ist der bereits übersetzte, aktionsspezifische Satz (z.B. "Das Speichern hat nicht geklappt.").
 */
export function friendlyError(err: unknown, t: TFunction, fallback: string): string {
  return `${fallback} ${t(`errors.hint.${classifyError(err)}`)}`;
}
