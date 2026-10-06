import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useRoute } from "./lib/useRoute";
import { useNativeBack } from "./lib/useNativeBack";
import { buildPath, type Route, type Tab } from "./lib/route";
import { DocumentList } from "./components/DocumentList";
import { DocumentDetail } from "./components/DocumentDetail";
import { UploadZone } from "./components/UploadZone";
import { SearchFilter } from "./components/SearchFilter";
import { ReviewInbox } from "./components/ReviewInbox";
import { RemindersPanel } from "./components/RemindersPanel";
import { FoldersPanel } from "./components/FoldersPanel";
import { HomePanel } from "./components/HomePanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { HelpPanel } from "./components/HelpPanel";

const TABS: Tab[] = ["home", "documents", "folders", "inbox", "reminders", "settings", "help"];

function emptyRoute(tab: Tab): Route {
  if (tab === "documents") return { tab, documentId: null, filters: {}, page: 1 };
  if (tab === "folders") return { tab, folderId: null, documentId: null };
  return { tab };
}

export default function App() {
  const { t } = useTranslation();
  const [route, navigate] = useRoute();
  useNativeBack(route, navigate);
  const tab = route.tab;
  const [documentsResult, setDocumentsResult] = useState<PaginatedDocuments>({
    results: [],
    count: 0,
    page: 1,
    pageSize: 25,
  });
  const [tags, setTags] = useState<Tag[]>([]);
  const [correspondents, setCorrespondents] = useState<Correspondent[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const selectedId = route.tab === "documents" ? route.documentId : null;
  const page = route.tab === "documents" ? route.page : 1;
  // Per Schlüssel stabil halten, sonst lädt jede Navigation die Liste neu.
  const filtersKey = JSON.stringify(route.tab === "documents" ? route.filters : {});
  const filters = useMemo<DocumentSearchParams>(() => JSON.parse(filtersKey), [filtersKey]);
  const setSelectedId = (id: number | null) =>
    navigate({ tab: "documents", documentId: id, filters, page });
  const setFilters = (next: DocumentSearchParams) =>
    navigate({ tab: "documents", documentId: selectedId, filters: next, page: 1 }, { replace: true });
  const setPage = (next: number) =>
    navigate({ tab: "documents", documentId: selectedId, filters, page: next });
  const [aiEnabled, setAiEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const requestSeq = useRef(0);

  const reloadDocuments = useCallback(() => {
    if (tab !== "documents") return;
    // Nur die jüngste Antwort übernehmen, sonst überschreibt eine langsame alte Suche die neue.
    const seq = ++requestSeq.current;
    setIsLoading(true);
    api
      .listDocuments({ ...filters, page })
      .then((r) => seq === requestSeq.current && setDocumentsResult(r))
      .catch((err) => seq === requestSeq.current && setError(err.message))
      .finally(() => seq === requestSeq.current && setIsLoading(false));
  }, [tab, filters, page]);

  const reloadMetadata = useCallback(() => {
    api.listTags().then(setTags).catch((err) => setError(err.message));
    api.listCorrespondents().then(setCorrespondents).catch((err) => setError(err.message));
    api.listDocumentTypes().then(setDocumentTypes).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    reloadDocuments();
  }, [reloadDocuments]);

  useEffect(() => {
    reloadMetadata();
    api.aiStatus().then((s) => setAiEnabled(s.enabled)).catch(() => setAiEnabled(false));
    registerWebPush().catch((err) => console.warn("Web Push nicht verfügbar:", err));
  }, [reloadMetadata]);

  // Auf schmalen Bildschirmen scrollt die Reiterzeile; der aktive Reiter soll sichtbar bleiben.
  useEffect(() => {
    document.querySelector(".app__tab--active")?.scrollIntoView?.({ inline: "center", block: "nearest" });
  }, [tab]);

  return (
    <div className="app">
      <header className="app__header">
        <h1>{t("app.title")}</h1>
        <nav className="app__tabs" aria-label={t("app.regionsAriaLabel")}>
          {TABS.map((id) => (
            <a
              key={id}
              href={buildPath(emptyRoute(id))}
              className={tab === id ? "app__tab--active" : ""}
              aria-current={tab === id ? "page" : undefined}
              onClick={(e) => {
                // Strg/Cmd/Mittelklick öffnen wie gewohnt einen neuen Browser-Tab.
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                navigate(emptyRoute(id));
              }}
            >
              {t(`app.tabs.${id}`)}
              {id === "inbox" && !aiEnabled ? ` ${t("app.tabs.inboxDisabledSuffix")}` : ""}
            </a>
          ))}
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
            onOpenDocument={(id) => navigate({ tab: "documents", documentId: id, filters: {}, page: 1 })}
            onOpenFolder={(id) => navigate({ tab: "folders", folderId: id, documentId: null })}
            onNavigate={(target) => navigate(emptyRoute(target))}
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
            openId={route.tab === "folders" ? route.folderId : null}
            documentId={route.tab === "folders" ? route.documentId : null}
            onNavigate={(folderId, documentId) => navigate({ tab: "folders", folderId, documentId })}
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

      {tab === "settings" && (
        <main className="app__main app__main--full">
          <SettingsPanel />
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
