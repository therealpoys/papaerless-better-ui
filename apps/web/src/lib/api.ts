import type {
  Correspondent,
  DocumentType,
  PaperlessDocument,
  Tag,
} from "@papaerless/shared-types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    throw new Error(`API-Fehler ${res.status} bei ${path}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export const api = {
  listDocuments: () => request<PaperlessDocument[]>("/api/documents"),

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

  listTags: () => request<Tag[]>("/api/tags"),
  listCorrespondents: () => request<Correspondent[]>("/api/correspondents"),
  listDocumentTypes: () => request<DocumentType[]>("/api/document-types"),
};
