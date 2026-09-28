export interface Tag {
  id: number;
  name: string;
  color?: string;
}

export interface Correspondent {
  id: number;
  name: string;
}

export interface DocumentType {
  id: number;
  name: string;
}

export interface PaperlessDocument {
  id: number;
  title: string;
  content: string;
  created: string;
  correspondent: number | null;
  documentType: number | null;
  tags: number[];
}

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

export type UploadJobStatus = "uploading" | "processing" | "needs_review" | "done" | "failed";

export interface UploadJob {
  id: string;
  fileName: string;
  status: UploadJobStatus;
  paperlessDocumentId?: number;
  suggestion?: MetadataSuggestion;
  error?: string;
}
