import type {
  BulkEditAction,
  Correspondent,
  DocumentSearchParams,
  DocumentType,
  PaginatedDocuments,
  PaperlessDocument,
  Tag,
  TrashedDocument,
} from "@papaerless/shared-types";

export interface PaperlessClientConfig {
  baseUrl: string;
  apiToken: string;
  /** Timeout pro Request in ms (Default 15000). */
  timeoutMs?: number;
  /** Zusätzliche Versuche für idempotente GETs (Default 2). */
  maxRetries?: number;
}

/**
 * Fehler beim Zugriff auf Paperless. `message` ist bewusst sauber (kein Token, kein Body);
 * der Antwort-Body steht nur in `detail` und ist fürs Logging gedacht.
 */
export class PaperlessError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "PaperlessError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface RawTrashed extends RawDocument {
  deleted_at: string;
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

  /**
   * fetch mit Timeout; GETs werden bei Netzwerkfehlern, Timeouts und 502/503/504 mit
   * exponentiellem Backoff wiederholt. Nicht-idempotente Requests werden nie wiederholt.
   */
  private async fetchPaperless(path: string, init: RequestInit = {}): Promise<Response> {
    const timeoutMs = this.config.timeoutMs ?? 15_000;
    const method = (init.method ?? "GET").toUpperCase();
    const retries = method === "GET" ? (this.config.maxRetries ?? 2) : 0;

    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(`${this.config.baseUrl}${path}`, {
          ...init,
          headers: { Authorization: `Token ${this.config.apiToken}`, ...init.headers },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (attempt < retries && [502, 503, 504].includes(res.status)) {
          await res.body?.cancel();
          await sleep(200 * 2 ** attempt);
          continue;
        }
        return res;
      } catch (err) {
        if (attempt < retries) {
          await sleep(200 * 2 ** attempt);
          continue;
        }
        const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
        throw new PaperlessError(
          timedOut
            ? `Paperless antwortet nicht (Timeout nach ${timeoutMs} ms)`
            : "Paperless ist nicht erreichbar",
          undefined,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  private async failure(what: string, res: Response): Promise<PaperlessError> {
    const detail = (await res.text().catch(() => "")).slice(0, 500);
    return new PaperlessError(`${what} (Paperless-Status ${res.status})`, res.status, detail);
  }

  /** Erreichbarkeitsprüfung für /health. */
  async ping(timeoutMs = 3000): Promise<boolean> {
    try {
      const res = await fetch(`${this.config.baseUrl}/api/`, {
        headers: { Authorization: `Token ${this.config.apiToken}` },
        signal: AbortSignal.timeout(timeoutMs),
      });
      await res.body?.cancel();
      return res.status < 500;
    } catch {
      return false;
    }
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await this.fetchPaperless(path, init);

    if (!res.ok) {
      throw await this.failure(`Paperless-API-Fehler bei ${path.split("?")[0]}`, res);
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

    const res = await this.fetchPaperless(`/api/documents/post_document/`, { method: "POST", body: form });

    if (!res.ok) {
      throw await this.failure("Upload fehlgeschlagen", res);
    }

    // Paperless liefert die Task-UUID des Konsumier-Vorgangs zurück
    return (await res.json()) as string;
  }

  /** Status eines Konsumier-Vorgangs; `documentId` ist erst bei SUCCESS gesetzt. */
  async getTask(taskId: string): Promise<{
    status: "PENDING" | "STARTED" | "SUCCESS" | "FAILURE" | "UNKNOWN";
    documentId?: number;
  }> {
    // Ältere Paperless-Versionen liefern eine Liste mit GROSSEM Status und `related_document`,
    // neuere (API v10, z.B. 3.2.1) `{results}` mit kleinem Status und `related_document_ids`.
    interface RawTask {
      status?: string;
      related_document?: string | number | null;
      related_document_ids?: number[] | null;
      result_data?: { document_id?: number } | null;
    }
    const raw = await this.request<RawTask[] | { results: RawTask[] }>(
      `/api/tasks/?task_id=${encodeURIComponent(taskId)}`,
    );
    const task = (Array.isArray(raw) ? raw : raw.results)?.[0];
    if (!task) return { status: "UNKNOWN" };

    const status = String(task.status ?? "").toUpperCase();
    const known = ["PENDING", "STARTED", "SUCCESS", "FAILURE"] as const;
    const normalized = known.find((k) => k === status) ?? "UNKNOWN";

    const id = Number(task.related_document_ids?.[0] ?? task.result_data?.document_id ?? task.related_document);
    return { status: normalized, documentId: Number.isFinite(id) && id > 0 ? id : undefined };
  }

  async deleteDocument(id: number): Promise<void> {
    const res = await this.fetchPaperless(`/api/documents/${id}/`, { method: "DELETE" });

    if (!res.ok) {
      throw await this.failure("Löschen fehlgeschlagen", res);
    }
  }

  // Papierkorb (Paperless >= 2.x). `deleteDocument`/bulk `delete` verschieben dorthin; erst
  // "empty" löscht endgültig. Live gegen 3.2.1 geprüft: POST /api/trash/ {documents, action}.

  async listTrash(): Promise<TrashedDocument[]> {
    const all: TrashedDocument[] = [];
    for (let page = 1; page <= 50; page++) {
      const data = await this.request<PaginatedResponse<RawTrashed>>(`/api/trash/?page_size=100&page=${page}`);
      all.push(...data.results.map((raw) => ({ ...toDocument(raw), deletedAt: raw.deleted_at })));
      if (!data.next) break;
    }
    return all;
  }

  private async trashAction(action: "restore" | "empty", ids: number[]): Promise<void> {
    // Leere Liste würde in Paperless "alle" bedeuten – das lösen wir nie implizit aus.
    if (ids.length === 0) return;
    const res = await this.fetchPaperless(`/api/trash/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documents: ids, action }),
    });
    if (!res.ok) {
      throw await this.failure(
        action === "restore" ? "Wiederherstellen fehlgeschlagen" : "Endgültiges Löschen fehlgeschlagen",
        res,
      );
    }
    await res.body?.cancel();
  }

  restoreFromTrash(ids: number[]): Promise<void> {
    return this.trashAction("restore", ids);
  }

  deleteFromTrash(ids: number[]): Promise<void> {
    return this.trashAction("empty", ids);
  }

  /** Leert den ganzen Papierkorb; gibt die Anzahl endgültig gelöschter Dokumente zurück. */
  async emptyTrash(): Promise<number> {
    const ids = (await this.listTrash()).map((d) => d.id);
    await this.trashAction("empty", ids);
    return ids.length;
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
    const res = await this.fetchPaperless(`/api/documents/${id}/download/`);

    if (!res.ok) {
      throw await this.failure("Download fehlgeschlagen", res);
    }

    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const disposition = res.headers.get("content-disposition") ?? "";
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    const fileName = match ? decodeURIComponent(match[1]) : `dokument-${id}`;

    return { buffer: await res.arrayBuffer(), contentType, fileName };
  }

  async getThumbnail(id: number): Promise<{ buffer: ArrayBuffer; contentType: string }> {
    const res = await this.fetchPaperless(`/api/documents/${id}/thumb/`);

    if (!res.ok) {
      throw await this.failure("Vorschaubild konnte nicht geladen werden", res);
    }

    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    return { buffer: await res.arrayBuffer(), contentType };
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
