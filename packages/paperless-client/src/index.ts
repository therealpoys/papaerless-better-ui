import type {
  BulkEditAction,
  Correspondent,
  DocumentSearchParams,
  DocumentType,
  PaginatedDocuments,
  PaperlessDocument,
  Tag,
} from "@papaerless/shared-types";

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

  async listDocuments(params: DocumentSearchParams = {}): Promise<PaginatedDocuments> {
    const pageSize = params.pageSize ?? 25;
    const page = params.page ?? 1;
    const search = new URLSearchParams();
    search.set("page_size", String(pageSize));
    search.set("page", String(page));
    if (params.query) search.set("query", params.query);
    if (params.correspondent) search.set("correspondent__id", String(params.correspondent));
    if (params.documentType) search.set("document_type__id", String(params.documentType));
    if (params.dateFrom) search.set("created__date__gte", params.dateFrom);
    if (params.dateTo) search.set("created__date__lte", params.dateTo);
    for (const tagId of params.tags ?? []) {
      search.append("tags__id__in", String(tagId));
    }
    if (params.sort) {
      const defaultOrder = params.sort === "title" ? "asc" : "desc";
      const prefix = (params.sortOrder ?? defaultOrder) === "desc" ? "-" : "";
      search.set("ordering", `${prefix}${params.sort}`);
    }

    const data = await this.request<PaginatedResponse<RawDocument>>(
      `/api/documents/?${search.toString()}`,
    );
    return { results: data.results.map(toDocument), count: data.count, page, pageSize };
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

  async deleteDocument(id: number): Promise<void> {
    const res = await fetch(`${this.config.baseUrl}/api/documents/${id}/`, {
      method: "DELETE",
      headers: { Authorization: `Token ${this.config.apiToken}` },
    });

    if (!res.ok) {
      throw new Error(`Löschen fehlgeschlagen (${res.status}): ${await res.text()}`);
    }
  }

  // Nutzt Paperless' `POST /api/documents/bulk_edit/` statt N Einzel-Requests – gegen die
  // lokale Instanz (3.2.1) live gegengeprüft für add_tag/remove_tag/modify_tags/
  // set_correspondent/set_document_type/delete, jeweils inkl. `parameters`-Shape unten.
  async bulkEditDocuments(documentIds: number[], action: BulkEditAction): Promise<void> {
    let parameters: Record<string, unknown> = {};
    if (action.method === "add_tag" || action.method === "remove_tag") {
      parameters = { tag: action.tag };
    } else if (action.method === "set_correspondent") {
      parameters = { correspondent: action.correspondent };
    } else if (action.method === "set_document_type") {
      parameters = { document_type: action.documentType };
    }

    await this.request<{ result: string }>(`/api/documents/bulk_edit/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documents: documentIds, method: action.method, parameters }),
    });
  }

  async downloadDocument(id: number): Promise<{ buffer: ArrayBuffer; contentType: string; fileName: string }> {
    const res = await fetch(`${this.config.baseUrl}/api/documents/${id}/download/`, {
      headers: { Authorization: `Token ${this.config.apiToken}` },
    });

    if (!res.ok) {
      throw new Error(`Download fehlgeschlagen (${res.status}): ${await res.text()}`);
    }

    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const disposition = res.headers.get("content-disposition") ?? "";
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    const fileName = match ? decodeURIComponent(match[1]) : `dokument-${id}`;

    return { buffer: await res.arrayBuffer(), contentType, fileName };
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

  async createTag(name: string): Promise<Tag> {
    return this.request<Tag>(`/api/tags/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  }

  async createCorrespondent(name: string): Promise<Correspondent> {
    return this.request<Correspondent>(`/api/correspondents/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  }

  async createDocumentType(name: string): Promise<DocumentType> {
    return this.request<DocumentType>(`/api/document_types/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  }
}
