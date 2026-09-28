import type { Correspondent, DocumentType, MetadataSuggestion, Tag } from "@papaerless/shared-types";

export interface ClassifyInput {
  documentId: number;
  title: string;
  content: string;
  knownTags: Tag[];
  knownCorrespondents: Correspondent[];
  knownDocumentTypes: DocumentType[];
}

export interface Classifier {
  classify(input: ClassifyInput): Promise<MetadataSuggestion>;
}
