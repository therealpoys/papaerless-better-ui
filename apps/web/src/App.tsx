import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  Correspondent,
  DocumentSearchParams,
  DocumentType,
  PaginatedDocuments,
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
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("documents");
  const [documentsResult, setDocumentsResult] = useState<PaginatedDocuments>({
    results: [],
    count: 0,
    page: 1,
    pageSize: 25,
  });
  const [tags, setTags] = useState<Tag[]>([]);
  const [correspondents, setCorrespondents] = useState<Correspondent[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filters, setFilters] = useState<DocumentSearchParams>({});
  const [page, setPage] = useState(1);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reloadDocuments = useCallback(() => {
    api.listDocuments({ ...filters, page }).then(setDocumentsResult).catch((err) => setError(err.message));
  }, [filters, page]);

  const reloadMetadata = useCallback(() => {
    api.listTags().then(setTags).catch((err) => setError(err.message));
    api.listCorrespondents().then(setCorrespondents).catch((err) => setError(err.message));
    api.listDocumentTypes().then(setDocumentTypes).catch((err) => setError(err.message));
  }, []);

  // Filteränderung soll immer auf Seite 1 zurückspringen, sonst landet man leicht auf
  // einer Seite, die es für die neuen Filter gar nicht mehr gibt.
  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    reloadDocuments();
  }, [reloadDocuments]);

  useEffect(() => {
    reloadMetadata();
    api.aiStatus().then((s) => setAiEnabled(s.enabled)).catch(() => setAiEnabled(false));
    registerWebPush().catch((err) => console.warn("Web Push nicht verfügbar:", err));
  }, [reloadMetadata]);

  return (
    <div className="app">
      <header className="app__header">
        <h1>Paperless Better UI</h1>
        <nav className="app__tabs" aria-label={t("app.regionsAriaLabel")}>
          <button
            type="button"
            className={tab === "documents" ? "app__tab--active" : ""}
            aria-current={tab === "documents" ? "page" : undefined}
            onClick={() => setTab("documents")}
          >
            {t("app.tabs.documents")}
          </button>
          <button
            type="button"
            className={tab === "inbox" ? "app__tab--active" : ""}
            aria-current={tab === "inbox" ? "page" : undefined}
            onClick={() => setTab("inbox")}
          >
            {t("app.tabs.inbox")} {aiEnabled ? "" : t("app.tabs.inboxDisabledSuffix")}
          </button>
          <button
            type="button"
            className={tab === "reminders" ? "app__tab--active" : ""}
            aria-current={tab === "reminders" ? "page" : undefined}
            onClick={() => setTab("reminders")}
          >
            {t("app.tabs.reminders")}
          </button>
        </nav>
      </header>

      {error && <ErrorState message={error} onRetry={reloadDocuments} retryLabel={t("common.retry")} />}

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
              documents={documentsResult.results}
              correspondents={correspondents}
              documentTypes={documentTypes}
              tags={tags}
              selectedId={selectedId}
              onSelect={setSelectedId}
              query={filters.query}
              page={documentsResult.page}
              pageCount={Math.max(1, Math.ceil(documentsResult.count / documentsResult.pageSize))}
              onPageChange={setPage}
              onBulkActionDone={(deletedIds) => {
                if (selectedId !== null && deletedIds?.includes(selectedId)) {
                  setSelectedId(null);
                }
                reloadDocuments();
              }}
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
                onMetadataChanged={reloadMetadata}
              />
            ) : (
              <EmptyState
                title={t("app.noDocumentSelected.title")}
                description={t("app.noDocumentSelected.description")}
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
