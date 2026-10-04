import { useCallback, useEffect, useRef, useState } from "react";
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
import { FoldersPanel } from "./components/FoldersPanel";
import { HomePanel } from "./components/HomePanel";
import { HelpPanel } from "./components/HelpPanel";

type Tab = "home" | "documents" | "folders" | "inbox" | "reminders" | "help";

export default function App() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("home");
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
  const [folderToOpen, setFolderToOpen] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const requestSeq = useRef(0);

  const reloadDocuments = useCallback(() => {
    // Nur die jüngste Antwort übernehmen, sonst überschreibt eine langsame alte Suche die neue.
    const seq = ++requestSeq.current;
    setIsLoading(true);
    api
      .listDocuments({ ...filters, page })
      .then((r) => seq === requestSeq.current && setDocumentsResult(r))
      .catch((err) => seq === requestSeq.current && setError(err.message))
      .finally(() => seq === requestSeq.current && setIsLoading(false));
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
        <h1>{t("app.title")}</h1>
        <nav className="app__tabs" aria-label={t("app.regionsAriaLabel")}>
          <button
            type="button"
            className={tab === "home" ? "app__tab--active" : ""}
            aria-current={tab === "home" ? "page" : undefined}
            onClick={() => setTab("home")}
          >
            {t("app.tabs.home")}
          </button>
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
            className={tab === "folders" ? "app__tab--active" : ""}
            aria-current={tab === "folders" ? "page" : undefined}
            onClick={() => {
              setFolderToOpen(null);
              setTab("folders");
            }}
          >
            {t("app.tabs.folders")}
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
          <button
            type="button"
            className={tab === "help" ? "app__tab--active" : ""}
            aria-current={tab === "help" ? "page" : undefined}
            onClick={() => setTab("help")}
          >
            {t("app.tabs.help")}
          </button>
        </nav>
      </header>

      {error && <ErrorState message={error} onRetry={reloadDocuments} retryLabel={t("common.retry")} />}

      {tab === "home" && (
        <main className="app__main app__main--full">
          <HomePanel
            tags={tags}
            correspondents={correspondents}
            documentTypes={documentTypes}
            aiEnabled={aiEnabled}
            onOpenDocument={(id) => {
              setSelectedId(id);
              setTab("documents");
            }}
            onOpenFolder={(id) => {
              setFolderToOpen(id);
              setTab("folders");
            }}
            onNavigate={setTab}
          />
        </main>
      )}

      {tab === "documents" && (
        <div className="app__body">
          <aside className="app__sidebar">
            <UploadZone
              onUploaded={reloadDocuments}
              aiEnabled={aiEnabled}
              tags={tags}
              correspondents={correspondents}
              documentTypes={documentTypes}
              onMetadataChanged={reloadMetadata}
            />
            <SearchFilter
              value={filters}
              onChange={setFilters}
              tags={tags}
              correspondents={correspondents}
              documentTypes={documentTypes}
              isLoading={isLoading}
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

      {tab === "folders" && (
        <main className="app__main app__main--full">
          <FoldersPanel
            tags={tags}
            correspondents={correspondents}
            documentTypes={documentTypes}
            aiEnabled={aiEnabled}
            onMetadataChanged={reloadMetadata}
            initialOpenId={folderToOpen}
          />
        </main>
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

      {tab === "help" && (
        <main className="app__main app__main--full">
          <HelpPanel />
        </main>
      )}
    </div>
  );
}
