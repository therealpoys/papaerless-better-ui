import type {
  Correspondent,
  DocumentSearchParams,
  DocumentType,
  MetadataSuggestion,
  PaperlessDocument,
  Reminder,
  Tag,
} from "@papaerless/shared-types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
const API_TOKEN = import.meta.env.VITE_API_TOKEN as string | undefined;

function withAuth(init?: RequestInit): RequestInit {
  if (!API_TOKEN) return init ?? {};
  return {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${API_TOKEN}` },
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, withAuth(init));
  if (!res.ok) {
    throw new Error(`API-Fehler ${res.status} bei ${path}: ${await res.text()}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function toSearchString(params: DocumentSearchParams): string {
  const search = new URLSearchParams();
  if (params.query) search.set("query", params.query);
  if (params.correspondent) search.set("correspondent", String(params.correspondent));
  if (params.documentType) search.set("documentType", String(params.documentType));
  if (params.dateFrom) search.set("dateFrom", params.dateFrom);
  if (params.dateTo) search.set("dateTo", params.dateTo);
  for (const tagId of params.tags ?? []) search.append("tags", String(tagId));
  return search.toString();
}

export const api = {
  listDocuments: (params: DocumentSearchParams = {}) => {
    const qs = toSearchString(params);
    return request<PaperlessDocument[]>(`/api/documents${qs ? `?${qs}` : ""}`);
  },

  getDocument: (id: number) => request<PaperlessDocument>(`/api/documents/${id}`),

  updateDocument: (
    id: number,
    patch: Partial<Pick<PaperlessDocument, "title" | "correspondent" | "documentType" | "tags">>,
  ) =>
    request<PaperlessDocument>(`/api/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),

  uploadDocument: async (file: File) => {
    const form = new FormData();
    form.append("document", file, file.name);
    return request<{ taskId: string }>("/api/documents/upload", {
      method: "POST",
      body: form,
    });
  },

  deleteDocument: (id: number) => request<void>(`/api/documents/${id}`, { method: "DELETE" }),

  downloadDocument: async (id: number): Promise<{ blob: Blob; fileName: string }> => {
    const res = await fetch(`${API_URL}/api/documents/${id}/download`, withAuth());
    if (!res.ok) {
      throw new Error(`Download fehlgeschlagen (${res.status}): ${await res.text()}`);
    }
    const disposition = res.headers.get("content-disposition") ?? "";
    const match = /filename="?([^";]+)"?/i.exec(disposition);
    return { blob: await res.blob(), fileName: match ? match[1] : `dokument-${id}` };
  },

  listTags: () => request<Tag[]>("/api/tags"),
  listCorrespondents: () => request<Correspondent[]>("/api/correspondents"),
  listDocumentTypes: () => request<DocumentType[]>("/api/document-types"),

  // Optional – nur nutzbar, wenn AI_PROVIDER/AI_API_KEY im Backend gesetzt sind
  aiStatus: () => request<{ enabled: boolean }>("/api/ai/status"),
  suggestMetadata: (documentId: number) =>
    request<MetadataSuggestion>(`/api/ai/documents/${documentId}/suggestion`),
  listSuggestions: () => request<MetadataSuggestion[]>("/api/ai/inbox"),
  applySuggestion: (documentId: number, suggestion: MetadataSuggestion) =>
    request<PaperlessDocument>(`/api/ai/documents/${documentId}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(suggestion),
    }),
  dismissSuggestion: (documentId: number) =>
    request<void>(`/api/ai/documents/${documentId}/dismiss`, { method: "POST" }),

  listReminders: () => request<Reminder[]>("/api/reminders"),
  createReminder: (input: { documentId: number; kind: Reminder["kind"]; dueDate: string; note?: string }) =>
    request<Reminder>("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  dismissReminder: (id: string) =>
    request<void>(`/api/reminders/${id}/dismiss`, { method: "POST" }),

  webPushPublicKey: () => request<{ publicKey: string | null }>("/api/push/public-key"),
  registerWebPush: (subscription: PushSubscriptionJSON) =>
    request<void>("/api/push/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "web", subscription }),
    }),
};
