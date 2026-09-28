import type { Correspondent, DocumentType, PaperlessDocument, Tag } from "@papaerless/shared-types";

export interface PaperlessClientConfig {
  baseUrl: string;
  apiToken: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface RawDocument {
  id: number;
  title: string;
  content: string;
  created: string;
  correspondent: number | null;
  document_type: number | null;
  tags: number[];
}

function toDocument(raw: RawDocument): PaperlessDocument {
  return {
    id: raw.id,
    title: raw.title,
    content: raw.content,
    created: raw.created,
    correspondent: raw.correspondent,
    documentType: raw.document_type,
    tags: raw.tags,
  };
}

export class PaperlessClient {
  constructor(private readonly config: PaperlessClientConfig) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.config.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Token ${this.config.apiToken}`,
        ...init.headers,
      },
    });

    if (!res.ok) {
      throw new Error(`Paperless-API-Fehler ${res.status} bei ${path}: ${await res.text()}`);
    }

    return (await res.json()) as T;
  }

  async listDocuments(params: { pageSize?: number } = {}): Promise<PaperlessDocument[]> {
    const pageSize = params.pageSize ?? 25;
    const data = await this.request<PaginatedResponse<RawDocument>>(
      `/api/documents/?page_size=${pageSize}`,
    );
    return data.results.map(toDocument);
  }

  async getDocument(id: number): Promise<PaperlessDocument> {
    const raw = await this.request<RawDocument>(`/api/documents/${id}/`);
    return toDocument(raw);
  }

  async updateDocument(
    id: number,
    patch: Partial<Pick<PaperlessDocument, "title" | "correspondent" | "documentType" | "tags">>,
  ): Promise<PaperlessDocument> {
    const body: Record<string, unknown> = {};
    if (patch.title !== undefined) body.title = patch.title;
    if (patch.correspondent !== undefined) body.correspondent = patch.correspondent;
    if (patch.documentType !== undefined) body.document_type = patch.documentType;
    if (patch.tags !== undefined) body.tags = patch.tags;

    const raw = await this.request<RawDocument>(`/api/documents/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return toDocument(raw);
  }

  async uploadDocument(file: Blob, fileName: string): Promise<string> {
    const form = new FormData();
    form.append("document", file, fileName);

    const res = await fetch(`${this.config.baseUrl}/api/documents/post_document/`, {
      method: "POST",
      headers: { Authorization: `Token ${this.config.apiToken}` },
      body: form,
    });

    if (!res.ok) {
      throw new Error(`Upload fehlgeschlagen (${res.status}): ${await res.text()}`);
    }

    // Paperless liefert die Task-UUID des Konsumier-Vorgangs zurück
    return (await res.json()) as string;
  }

  async listTags(): Promise<Tag[]> {
    const data = await this.request<PaginatedResponse<Tag>>(`/api/tags/?page_size=100`);
    return data.results;
  }

  async listCorrespondents(): Promise<Correspondent[]> {
    const data = await this.request<PaginatedResponse<Correspondent>>(
      `/api/correspondents/?page_size=100`,
    );
    return data.results;
  }

  async listDocumentTypes(): Promise<DocumentType[]> {
    const data = await this.request<PaginatedResponse<DocumentType>>(
      `/api/document_types/?page_size=100`,
    );
    return data.results;
  }
}
