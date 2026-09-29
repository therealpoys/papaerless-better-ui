import type {
  Correspondent,
  DocumentSearchParams,
  DocumentType,
  MetadataSuggestion,
  PaginatedDocuments,
  PaperlessDocument,
  Reminder,
  Tag,
} from "@papaerless/shared-types";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";
const API_TOKEN = process.env.EXPO_PUBLIC_API_TOKEN;

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

    const res = await fetch(`${API_URL}/api/documents/upload`, withAuth({
      method: "POST",
      body: form,
    }));
    if (!res.ok) {
      throw new Error(`Upload fehlgeschlagen (${res.status}): ${await res.text()}`);
    }
    return (await res.json()) as { taskId: string };
  },

  listDocuments: (params: DocumentSearchParams = {}) => {
    const search = new URLSearchParams();
    if (params.query) search.set("query", params.query);
    if (params.page) search.set("page", String(params.page));
    search.set("pageSize", String(params.pageSize ?? 20));
    if (params.sort) search.set("sort", params.sort);
    if (params.sortOrder) search.set("sortOrder", params.sortOrder);
    return request<PaginatedDocuments>(`/api/documents?${search.toString()}`);
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
  listTags: () => request<Tag[]>("/api/tags"),
  listCorrespondents: () => request<Correspondent[]>("/api/correspondents"),
  listDocumentTypes: () => request<DocumentType[]>("/api/document-types"),

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

  listReminders: () => request<Reminder[]>("/api/reminders"),
  dismissReminder: (id: string) =>
    request<void>(`/api/reminders/${id}/dismiss`, { method: "POST" }),
};
