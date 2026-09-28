import { useCallback, useEffect, useState } from "react";
import type {
  Correspondent,
  DocumentSearchParams,
  DocumentType,
  PaperlessDocument,
  Tag,
} from "@papaerless/shared-types";
import { EmptyState, ErrorState } from "@papaerless/ui";
import { api } from "./lib/api";
import { registerWebPush } from "./lib/push";
import { DocumentList } from "./components/DocumentList";
import { DocumentDetail } from "./components/DocumentDetail";
import { UploadZone } from "./components/UploadZone";
import { SearchFilter } from "./components/SearchFilter";
import { ReviewInbox } from "./components/ReviewInbox";
import { RemindersPanel } from "./components/RemindersPanel";

type Tab = "documents" | "inbox" | "reminders";

export default function App() {
  const [tab, setTab] = useState<Tab>("documents");
  const [documents, setDocuments] = useState<PaperlessDocument[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [correspondents, setCorrespondents] = useState<Correspondent[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filters, setFilters] = useState<DocumentSearchParams>({});
  const [aiEnabled, setAiEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reloadDocuments = useCallback(() => {
    api.listDocuments(filters).then(setDocuments).catch((err) => setError(err.message));
  }, [filters]);

  useEffect(() => {
    reloadDocuments();
  }, [reloadDocuments]);

  useEffect(() => {
    api.listTags().then(setTags).catch((err) => setError(err.message));
    api.listCorrespondents().then(setCorrespondents).catch((err) => setError(err.message));
    api.listDocumentTypes().then(setDocumentTypes).catch((err) => setError(err.message));
    api.aiStatus().then((s) => setAiEnabled(s.enabled)).catch(() => setAiEnabled(false));
    registerWebPush().catch((err) => console.warn("Web Push nicht verfügbar:", err));
  }, []);

  return (
    <div className="app">
      <header className="app__header">
        <h1>Paperless Better UI</h1>
        <nav className="app__tabs" aria-label="Bereiche">
          <button
            type="button"
            className={tab === "documents" ? "app__tab--active" : ""}
            aria-current={tab === "documents" ? "page" : undefined}
            onClick={() => setTab("documents")}
          >
            Dokumente
          </button>
          <button
            type="button"
            className={tab === "inbox" ? "app__tab--active" : ""}
            aria-current={tab === "inbox" ? "page" : undefined}
            onClick={() => setTab("inbox")}
          >
            Review-Inbox {aiEnabled ? "" : "(deaktiviert)"}
          </button>
          <button
            type="button"
            className={tab === "reminders" ? "app__tab--active" : ""}
            aria-current={tab === "reminders" ? "page" : undefined}
            onClick={() => setTab("reminders")}
          >
            Erinnerungen
          </button>
        </nav>
      </header>

      {error && <ErrorState message={error} onRetry={reloadDocuments} />}

      {tab === "documents" && (
        <div className="app__body">
          <aside className="app__sidebar">
            <UploadZone onUploaded={reloadDocuments} />
            <SearchFilter
              value={filters}
              onChange={setFilters}
              tags={tags}
              correspondents={correspondents}
              documentTypes={documentTypes}
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
                aiEnabled={aiEnabled}
                onSaved={reloadDocuments}
                onDeleted={() => {
                  setSelectedId(null);
                  reloadDocuments();
                }}
              />
            ) : (
              <EmptyState
                title="Kein Dokument ausgewählt"
                description="Wähle links ein Dokument aus, oder lade eine neue Datei hoch."
              />
            )}
          </main>
        </div>
      )}

      {tab === "inbox" && (
        <main className="app__main app__main--full">
          <ReviewInbox aiEnabled={aiEnabled} />
        </main>
      )}

      {tab === "reminders" && (
        <main className="app__main app__main--full">
          <RemindersPanel />
        </main>
      )}
    </div>
  );
}
