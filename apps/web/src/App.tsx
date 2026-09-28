import { useCallback, useEffect, useState } from "react";
import type { Correspondent, DocumentType, PaperlessDocument, Tag } from "@papaerless/shared-types";
import { api } from "./lib/api";
import { DocumentList } from "./components/DocumentList";
import { DocumentDetail } from "./components/DocumentDetail";
import { UploadZone } from "./components/UploadZone";

export default function App() {
  const [documents, setDocuments] = useState<PaperlessDocument[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [correspondents, setCorrespondents] = useState<Correspondent[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reloadDocuments = useCallback(() => {
    api.listDocuments().then(setDocuments).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    reloadDocuments();
    api.listTags().then(setTags).catch((err) => setError(err.message));
    api.listCorrespondents().then(setCorrespondents).catch((err) => setError(err.message));
    api.listDocumentTypes().then(setDocumentTypes).catch((err) => setError(err.message));
  }, [reloadDocuments]);

  return (
    <div className="app">
      <header className="app__header">
        <h1>Paperless Better UI</h1>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="app__body">
        <aside className="app__sidebar">
          <UploadZone
            onUploaded={() => {
              // Paperless braucht kurz zum OCR/Consume-Vorgang
              setTimeout(reloadDocuments, 3000);
            }}
          />
          <DocumentList
            documents={documents}
            correspondents={correspondents}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </aside>

        <main className="app__main">
          {selectedId ? (
            <DocumentDetail
              documentId={selectedId}
              correspondents={correspondents}
              documentTypes={documentTypes}
              tags={tags}
              onSaved={reloadDocuments}
            />
          ) : (
            <p className="empty-state">Wähle links ein Dokument aus.</p>
          )}
        </main>
      </div>
    </div>
  );
}
