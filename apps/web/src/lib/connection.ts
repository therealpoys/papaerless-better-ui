export type ConnectionStatus = "ok" | "serverUnreachable" | "unauthorized" | "paperlessUnreachable" | "notServer";

/**
 * Prüft Backend, Anmeldung und Paperless getrennt über die geschützte Route /api/status:
 * kein Netz -> serverUnreachable, 401/403 -> unauthorized, sonstige Fehler/ungültige Antwort -> notServer,
 * Backend ok aber Paperless nicht erreichbar -> paperlessUnreachable.
 */
export async function checkConnection(
  baseUrl: string,
  fetchFn: typeof fetch = fetch,
  headers: Record<string, string> = {},
): Promise<ConnectionStatus> {
  let res: Response;
  try {
    res = await fetchFn(`${baseUrl}/api/status`, { headers });
  } catch {
    return "serverUnreachable";
  }
  if (res.status === 401 || res.status === 403) return "unauthorized";
  if (!res.ok) return "notServer";
  try {
    const body = (await res.json()) as { backend?: unknown; paperless?: unknown };
    if (body.backend !== "ok") return "notServer";
    return body.paperless === "ok" ? "ok" : "paperlessUnreachable";
  } catch {
    return "notServer";
  }
}
