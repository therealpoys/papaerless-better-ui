import type { MetadataSuggestion, PaperlessDocument } from "@papaerless/shared-types";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    throw new Error(`API-Fehler ${res.status} bei ${path}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export const api = {
  uploadDocument: async (fileUri: string, fileName: string): Promise<{ taskId: string }> => {
    const form = new FormData();
    // React Native FormData akzeptiert ein {uri, name, type}-Objekt statt eines Blobs
    form.append("document", {
      uri: fileUri,
      name: fileName,
      type: "application/pdf",
    } as unknown as Blob);

    const res = await fetch(`${API_URL}/api/documents/upload`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      throw new Error(`Upload fehlgeschlagen (${res.status}): ${await res.text()}`);
    }
    return (await res.json()) as { taskId: string };
  },

  listDocuments: () => request<PaperlessDocument[]>("/api/documents?pageSize=10"),

  aiStatus: () => request<{ enabled: boolean }>("/api/ai/status"),
  listSuggestions: () => request<MetadataSuggestion[]>("/api/ai/inbox"),
  applySuggestion: (documentId: number, suggestion: MetadataSuggestion) =>
    request<PaperlessDocument>(`/api/ai/documents/${documentId}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(suggestion),
    }),
  dismissSuggestion: (documentId: number) =>
    request<void>(`/api/ai/documents/${documentId}/dismiss`, { method: "POST" }),

  registerExpoPush: (token: string) =>
    request<void>("/api/push/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "expo", token }),
    }),
};
