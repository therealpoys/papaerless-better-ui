export { normalizeDate, parseAmount } from "./amount.js";

export interface Tag {
  id: number;
  name: string;
  color?: string;
  /** Von Paperless mitgeliefert (globale Anzahl, unabhängig von aktiven Filtern). */
  document_count?: number;
}

export interface Correspondent {
  id: number;
  name: string;
  /** Von Paperless mitgeliefert (globale Anzahl, unabhängig von aktiven Filtern). */
  document_count?: number;
}

export interface DocumentType {
  id: number;
  name: string;
  /** Von Paperless mitgeliefert (globale Anzahl, unabhängig von aktiven Filtern). */
  document_count?: number;
}

export interface PaperlessDocument {
  id: number;
  title: string;
  content: string;
  created: string;
  correspondent: number | null;
  documentType: number | null;
  tags: number[];
  /** Betrag in Euro (Paperless-Custom-Field "Betrag"); fehlt/null = kein Betrag erfasst. */
  amount?: number | null;
}

/** Ein Dokument im Paperless-Papierkorb. `deletedAt` ist ein ISO-Zeitstempel. */
export interface TrashedDocument extends PaperlessDocument {
  deletedAt: string;
}

export interface TrashList {
  results: TrashedDocument[];
  /** Nach so vielen Tagen leert Paperless den Papierkorb selbst (PAPERLESS_EMPTY_TRASH_DELAY). */
  retentionDays: number;
}
/** Schlanke Dokumentsicht für die Ausgaben-Übersicht (nur Dokumente mit Betrag). */
export type ExpenseDocument = Pick<PaperlessDocument, "id" | "title" | "created" | "correspondent" | "documentType"> & {
  amount: number;
};

export interface MetadataSuggestion {
  documentId: number;
  title?: string;
  correspondent?: string;
  documentType?: string;
  tags?: string[];
  date?: string;
  amount?: number;
  confidence: number;
}

export type SuggestionField = "title" | "correspondent" | "documentType" | "tags" | "date" | "amount";

/**
 * Body für POST /ai/documents/:id/apply. Ohne `fields` wird der ganze Vorschlag übernommen
 * (Tags ersetzen die bisherigen). Mit `fields` werden nur diese Felder geändert, Tags werden
 * zu den vorhandenen hinzugefügt, und das Übernommene verschwindet aus dem gespeicherten Vorschlag.
 */
export interface ApplySuggestionRequest extends MetadataSuggestion {
  fields?: SuggestionField[];
}

export interface AppSettings {
  /** Für jedes neue Dokument automatisch einen KI-Vorschlag erzeugen. */
  autoSuggest: boolean;
}

export type UploadJobStatus = "uploading" | "processing" | "needs_review" | "done" | "failed";

export interface UploadJob {
  id: string;
  fileName: string;
  status: UploadJobStatus;
  paperlessDocumentId?: number;
  suggestion?: MetadataSuggestion;
  error?: string;
}

/** "score" = Relevanz (nur mit Volltextsuche sinnvoll, Paperless `ordering=score`). */
export type DocumentSortField = "created" | "added" | "title" | "score";
export type SortOrder = "asc" | "desc";

export interface DocumentSearchParams {
  query?: string;
  tags?: number[];
  correspondent?: number;
  documentType?: number;
  dateFrom?: string;
  dateTo?: string;
  pageSize?: number;
  /** 1-basiert, wie Paperless' `page`-Query-Param. Weglassen = Seite 1. */
  page?: number;
  /** Sortierfeld; Paperless-Default (neueste zuerst) greift, wenn weggelassen. */
  sort?: DocumentSortField;
  sortOrder?: SortOrder;
}

export interface PaginatedDocuments {
  results: PaperlessDocument[];
  count: number;
  page: number;
  pageSize: number;
}

/** Deckt die von Paperless' `POST /api/documents/bulk_edit/` unterstützten Methoden ab,
 * die wir in der UI anbieten (siehe packages/paperless-client für die Übersetzung in den
 * `{documents, method, parameters}`-Body). */
export type BulkEditAction =
  | { method: "add_tag"; tag: number }
  | { method: "remove_tag"; tag: number }
  | { method: "set_correspondent"; correspondent: number | null }
  | { method: "set_document_type"; documentType: number | null }
  | { method: "delete" };

/** Ordner = gespeicherte Ansicht: zeigt alle Dokumente mit diesem Schlagwort / Absender / dieser Art.
 *  Es werden nur Definitionen gespeichert, nie Dokumente (Paperless bleibt Source of Truth). */
export type FolderCriterion =
  | { kind: "tag"; id: number }
  | { kind: "correspondent"; id: number }
  | { kind: "documentType"; id: number };

export interface Folder {
  id: string;
  name: string;
  criterion: FolderCriterion;
}

export type ReminderKind = "due_date" | "cancellation_deadline";

export interface Reminder {
  id: string;
  documentId: number;
  documentTitle: string;
  kind: ReminderKind;
  dueDate: string;
  note?: string;
  notifiedAt?: string;
}

export interface PushSubscriptionRecord {
  id: string;
  kind: "web" | "expo";
  endpoint: string;
  createdAt: string;
}
