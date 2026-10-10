import type {
  AppSettings,
  BulkEditAction,
  Correspondent,
  DocumentSearchParams,
  DocumentType,
  Folder,
  FolderCriterion,
  ApplySuggestionRequest,
  MetadataSuggestion,
  SuggestionField,
  PaginatedDocuments,
  PaperlessDocument,
  Reminder,
  Tag,
  TrashList,
} from "@papaerless/shared-types";

import { isNative } from "./platform";
import { getStoredServerUrl, resolveApiBase } from "./serverUrl";

/** Browser: wie bisher VITE_API_URL. Native App: die zur Laufzeit gespeicherte Server-URL (kein Proxy, anderes Origin). */
function apiUrl(): string {
  return resolveApiBase(isNative(), getStoredServerUrl(), import.meta.env.VITE_API_URL);
}
const API_TOKEN = import.meta.env.VITE_API_TOKEN as string | undefined;

export function authHeaders(): Record<string, string> {
  return API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {};
}

function withAuth(init?: RequestInit): RequestInit {
  if (!API_TOKEN) return init ?? {};
  return {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${API_TOKEN}` },
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiUrl()}${path}`, withAuth(init));
  if (!res.ok) {
    throw new Error(`API-Fehler ${res.status} bei ${path}: ${await res.text()}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** fetch kennt keinen Upload-Fortschritt, daher XMLHttpRequest. Gleiche Auth und Fehlerform wie request(). */
function uploadWithProgress<T>(
  url: string,
  body: FormData,
  onProgress?: (loaded: number, total: number) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    if (API_TOKEN) xhr.setRequestHeader("Authorization", `Bearer ${API_TOKEN}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded, e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as T);
        } catch {
          reject(new Error(`API-Fehler ${xhr.status} bei ${url}: ungültige Antwort`));
        }
      } else {
        reject(new Error(`API-Fehler ${xhr.status} bei ${url}: ${xhr.responseText}`));
      }
    };
    xhr.onerror = () => reject(new Error("Netzwerkfehler beim Hochladen"));
    xhr.onabort = () => reject(new Error("Upload abgebrochen"));
    xhr.send(body);
  });
}

function toSearchString(params: DocumentSearchParams): string {
  const search = new URLSearchParams();
  if (params.query) search.set("query", params.query);
  if (params.correspondent) search.set("correspondent", String(params.correspondent));
  if (params.documentType) search.set("documentType", String(params.documentType));
  if (params.dateFrom) search.set("dateFrom", params.dateFrom);
  if (params.dateTo) search.set("dateTo", params.dateTo);
  if (params.sort) search.set("sort", params.sort);
  if (params.sortOrder) search.set("sortOrder", params.sortOrder);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  for (const tagId of params.tags ?? []) search.append("tags", String(tagId));
  return search.toString();
}

export const api = {
  listDocuments: (params: DocumentSearchParams = {}) => {
    const qs = toSearchString(params);
    return request<PaginatedDocuments>(`/api/documents${qs ? `?${qs}` : ""}`);
  },

  getDocument: (id: number) => request<PaperlessDocument>(`/api/documents/${id}`),

  bulkEditDocuments: (documentIds: number[], action: BulkEditAction) =>
    request<void>("/api/documents/bulk-edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentIds, action }),
    }),

  updateDocument: (
    id: number,
    patch: Partial<Pick<PaperlessDocument, "title" | "correspondent" | "documentType" | "tags">>,
  ) =>
    request<PaperlessDocument>(`/api/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),

  uploadDocument: (file: File, onProgress?: (loaded: number, total: number) => void) => {
    const form = new FormData();
    form.append("document", file, file.name);
    return uploadWithProgress<{ taskId: string }>(`${apiUrl()}/api/documents/upload`, form, onProgress);
  },

  getUploadTask: (taskId: string) =>
    request<{ status: "PENDING" | "STARTED" | "SUCCESS" | "FAILURE" | "UNKNOWN"; documentId?: number }>(
      `/api/documents/tasks/${encodeURIComponent(taskId)}`,
    ),

  listTrash: () => request<TrashList>("/api/trash"),
  trashInfo: () => request<{ retentionDays: number }>("/api/trash/info"),
  restoreFromTrash: (documentIds: number[]) =>
    request<void>("/api/trash/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentIds }),
    }),
  deleteFromTrash: (documentIds: number[]) =>
    request<void>("/api/trash/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentIds }),
    }),
  emptyTrash: () => request<{ deleted: number }>("/api/trash/empty", { method: "POST" }),

  deleteDocument: (id: number) => request<void>(`/api/documents/${id}`, { method: "DELETE" }),

  downloadDocument: async (id: number): Promise<{ blob: Blob; fileName: string }> => {
    const res = await fetch(`${apiUrl()}/api/documents/${id}/download`, withAuth());
    if (!res.ok) {
      throw new Error(`Download fehlgeschlagen (${res.status}): ${await res.text()}`);
    }
    const disposition = res.headers.get("content-disposition") ?? "";
    const match = /filename="?([^";]+)"?/i.exec(disposition);
    return { blob: await res.blob(), fileName: match ? match[1] : `dokument-${id}` };
  },

  listFolders: () => request<Folder[]>("/api/folders"),
  createFolder: (input: { name: string; criterion: FolderCriterion }) =>
    request<Folder>("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  updateFolder: (id: string, patch: { name?: string; criterion?: FolderCriterion }) =>
    request<Folder>(`/api/folders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  deleteFolder: (id: string) => request<void>(`/api/folders/${encodeURIComponent(id)}`, { method: "DELETE" }),

  /** Vorschaubild per Auth-Fetch (ein <img src> kann keinen Bearer-Token senden). */
  fetchThumbnail: async (id: number, signal?: AbortSignal): Promise<Blob> => {
    const res = await fetch(`${apiUrl()}/api/documents/${id}/thumbnail`, withAuth({ signal }));
    if (!res.ok) throw new Error(`API-Fehler ${res.status} bei /api/documents/${id}/thumbnail`);
    return res.blob();
  },

  listTags: () => request<Tag[]>("/api/tags"),
  listCorrespondents: () => request<Correspondent[]>("/api/correspondents"),
  listDocumentTypes: () => request<DocumentType[]>("/api/document-types"),

  createTag: (name: string) =>
    request<Tag>("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  createCorrespondent: (name: string) =>
    request<Correspondent>("/api/correspondents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  createDocumentType: (name: string) =>
    request<DocumentType>("/api/document-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),

  // Optional – nur nutzbar, wenn AI_PROVIDER/AI_API_KEY im Backend gesetzt sind
  aiStatus: () => request<{ enabled: boolean }>("/api/ai/status"),
  suggestMetadata: (documentId: number) =>
    request<MetadataSuggestion>(`/api/ai/documents/${documentId}/suggestion`),
  /** Vorhandener Vorschlag und ob gerade einer berechnet wird – löst selbst nie eine Berechnung aus. */
  getPendingState: (documentId: number) =>
    request<{ suggestion: MetadataSuggestion | null; generating?: boolean }>(
      `/api/ai/documents/${documentId}/pending`,
    ),
  listSuggestions: () => request<MetadataSuggestion[]>("/api/ai/inbox"),
  applySuggestion: (documentId: number, suggestion: MetadataSuggestion) =>
    request<PaperlessDocument>(`/api/ai/documents/${documentId}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(suggestion),
    }),
  /** Übernimmt nur die genannten Felder (Tags werden hinzugefügt statt ersetzt, optional nur `onlyTags`). */
  applySuggestionFields: (
    documentId: number,
    suggestion: MetadataSuggestion,
    fields: SuggestionField[],
    onlyTags?: string[],
  ) =>
    request<PaperlessDocument>(`/api/ai/documents/${documentId}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...suggestion, ...(onlyTags && { tags: onlyTags }), fields } satisfies ApplySuggestionRequest),
    }),
  dismissSuggestion: (documentId: number) =>
    request<void>(`/api/ai/documents/${documentId}/dismiss`, { method: "POST" }),

  getSettings: () => request<AppSettings & { aiEnabled: boolean }>("/api/settings"),
  updateSettings: (settings: AppSettings) =>
    request<AppSettings & { aiEnabled: boolean }>("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    }),

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
