import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  Correspondent,
  DocumentSearchParams,
  DocumentType,
  Folder,
  FolderCriterion,
  PaginatedDocuments,
  Tag,
} from "@papaerless/shared-types";
import { Button, EmptyState, ErrorState } from "@papaerless/ui";
import { api } from "../lib/api";
import { friendlyError } from "../lib/errors";
import { SearchFilter } from "./SearchFilter";
import { isEmptySearch } from "../lib/savedSearches";
import { criterionName, criterionToSearchParams, folderPatch } from "../lib/folders";
import { ConfirmDialog } from "./ConfirmDialog";
import { DocumentDetail } from "./DocumentDetail";
import { DocumentThumbnail } from "./DocumentThumbnail";
import { FolderDialog } from "./FolderDialog";

interface Props {
  tags: Tag[];
  correspondents: Correspondent[];
  documentTypes: DocumentType[];
  aiEnabled: boolean;
  onMetadataChanged: () => void;
  /** Ordner, der beim Öffnen des Tabs direkt geöffnet wird (z. B. von der Startseite). */
  openId: string | null;
  documentId: number | null;
  /** Schreibt Ordner/Dokument in die URL, damit F5 und Zurück an derselben Stelle landen. */
  onNavigate: (folderId: string | null, documentId: number | null) => void;
}

const PREVIEW_COUNT = 3;
const FOLDER_PAGE_SIZE = 24;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("de-DE");
}

export function FolderTile({
  folder,
  criterionLabel,
  reloadKey,
  onOpen,
}: {
  folder: Folder;
  criterionLabel: string;
  reloadKey: number;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const [data, setData] = useState<PaginatedDocuments | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .listDocuments(criterionToSearchParams(folder.criterion, { page: 1, pageSize: PREVIEW_COUNT }))
      .then((r) => !cancelled && setData(r))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [folder.criterion, reloadKey]);

  return (
    <button type="button" className="folder-tile" onClick={onOpen}>
      <span className="folder-tile__previews" aria-hidden="true">
        {data?.results.slice(0, PREVIEW_COUNT).map((d) => (
          <DocumentThumbnail key={d.id} documentId={d.id} />
        ))}
      </span>
      <span className="folder-tile__name">{folder.name}</span>
      <span className="folder-tile__criterion">{criterionLabel}</span>
      <span className="folder-tile__count">
        {failed ? "–" : data ? t("folders.documentCount", { count: data.count }) : t("folders.loading")}
      </span>
    </button>
  );
}

export function FoldersPanel({ tags, correspondents, documentTypes, aiEnabled, onMetadataChanged, openId, documentId, onNavigate }: Props) {
  const { t } = useTranslation();
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [dialog, setDialog] = useState<{ folder?: Folder } | null>(null);
  const [deleting, setDeleting] = useState<Folder | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const lookups = { tags, correspondents, documentTypes };

  const load = useCallback(() => {
    setError(null);
    api
      .listFolders()
      .then(setFolders)
      .catch((err) => setError(friendlyError(err, t, t("folders.loadFailed"))));
  }, [t]);

  useEffect(load, [load]);

  const openFolder = folders?.find((f) => f.id === openId) ?? null;

  function labelFor(criterion: FolderCriterion): string {
    const name = criterionName(criterion, lookups) ?? t("folders.unknownCriterion");
    return `${t(`folders.kinds.${criterion.kind}`)}: ${name}`;
  }

  async function handleSubmit(value: { name: string; criterion: FolderCriterion }) {
    const editing = dialog?.folder;
    if (editing) {
      const patch = folderPatch(editing, value);
      if (Object.keys(patch).length > 0) {
        const updated = await api.updateFolder(editing.id, patch);
        setFolders((list) => list?.map((f) => (f.id === updated.id ? updated : f)) ?? list);
      }
    } else {
      const created = await api.createFolder(value);
      setFolders((list) => [...(list ?? []), created]);
    }
    setReloadKey((k) => k + 1);
    setDialog(null);
  }

  async function handleDelete() {
    if (!deleting) return;
    const folder = deleting;
    setDeleting(null);
    try {
      await api.deleteFolder(folder.id);
      setFolders((list) => list?.filter((f) => f.id !== folder.id) ?? list);
      if (openId === folder.id) onNavigate(null, null);
    } catch (err) {
      setActionError(friendlyError(err, t, t("folders.deleteFailed")));
    }
  }

  const dialogs = (
    <>
      {dialog && (
        <FolderDialog
          folder={dialog.folder}
          tags={tags}
          correspondents={correspondents}
          documentTypes={documentTypes}
          onCancel={() => setDialog(null)}
          onSubmit={handleSubmit}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={t("folders.confirmDelete.title", { name: deleting?.name ?? "" })}
        cancelLabel={t("folders.confirmDelete.cancel")}
        confirmLabel={t("folders.confirmDelete.confirm")}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
      >
        <p>{t("folders.confirmDelete.body")}</p>
      </ConfirmDialog>
    </>
  );

  if (error) {
    return <ErrorState message={error} onRetry={load} retryLabel={t("common.retry")} />;
  }

  if (openFolder && documentId !== null) {
    return (
      <div className="folders">
        <Button variant="secondary" onClick={() => onNavigate(openId, null)}>
          ← {t("folders.backToFolder", { name: openFolder.name })}
        </Button>
        <DocumentDetail
          documentId={documentId}
          correspondents={correspondents}
          documentTypes={documentTypes}
          tags={tags}
          aiEnabled={aiEnabled}
          onSaved={() => setReloadKey((k) => k + 1)}
          onDeleted={() => {
            onNavigate(openId, null);
            setReloadKey((k) => k + 1);
          }}
          onMetadataChanged={onMetadataChanged}
        />
      </div>
    );
  }

  if (openFolder) {
    return (
      <div className="folders">
        <FolderContents
          folder={openFolder}
          label={labelFor(openFolder.criterion)}
          correspondents={correspondents}
          tags={tags}
          documentTypes={documentTypes}
          reloadKey={reloadKey}
          onBack={() => onNavigate(null, null)}
          onEdit={() => setDialog({ folder: openFolder })}
          onDelete={() => setDeleting(openFolder)}
          onOpenDocument={(id) => onNavigate(openId, id)}
        />
        {actionError && <ErrorState message={actionError} />}
        {dialogs}
      </div>
    );
  }

  return (
    <div className="folders">
      <div className="folders__toolbar">
        <h2>{t("folders.title")}</h2>
        <Button onClick={() => setDialog({})}>{t("folders.create")}</Button>
      </div>
      {actionError && <ErrorState message={actionError} />}
      {folders === null ? (
        <p role="status">{t("folders.loading")}</p>
      ) : folders.length === 0 ? (
        <EmptyState
          title={t("folders.empty.title")}
          description={t("folders.empty.description")}
          action={<Button onClick={() => setDialog({})}>{t("folders.create")}</Button>}
        />
      ) : (
        <div className="folders__grid">
          {folders.map((f) => (
            <FolderTile
              key={f.id}
              folder={f}
              criterionLabel={labelFor(f.criterion)}
              reloadKey={reloadKey}
              onOpen={() => {
                setActionError(null);
                onNavigate(f.id, null);
              }}
            />
          ))}
        </div>
      )}
      {dialogs}
    </div>
  );
}

function FolderContents({
  folder,
  label,
  correspondents,
  tags,
  documentTypes,
  reloadKey,
  onBack,
  onEdit,
  onDelete,
  onOpenDocument,
}: {
  folder: Folder;
  label: string;
  correspondents: Correspondent[];
  tags: Tag[];
  documentTypes: DocumentType[];
  reloadKey: number;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenDocument: (id: number) => void;
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<DocumentSearchParams>({});
  const [data, setData] = useState<PaginatedDocuments | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setPage(1);
  }, [folder.id, folder.criterion, filters]);

  useEffect(() => {
    setFilters({});
  }, [folder.id]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    api
      .listDocuments(criterionToSearchParams(folder.criterion, { ...filters, page, pageSize: FOLDER_PAGE_SIZE }))
      .then((r) => !cancelled && setData(r))
      .catch((err) => !cancelled && setError(friendlyError(err, t, t("folders.loadDocumentsFailed"))));
    return () => {
      cancelled = true;
    };
  }, [folder.criterion, filters, page, reloadKey, attempt, t]);

  const pageCount = data ? Math.max(1, Math.ceil(data.count / data.pageSize)) : 1;

  return (
    <>
      <Button variant="secondary" onClick={onBack}>
        ← {t("folders.backToAll")}
      </Button>
      <div className="folders__toolbar">
        <div>
          <h2 className="folders__heading">{folder.name}</h2>
          <p className="folders__sub">{label}</p>
        </div>
        <div className="folders__actions">
          <Button variant="secondary" onClick={onEdit}>
            {t("folders.edit")}
          </Button>
          <Button variant="danger" onClick={onDelete}>
            {t("folders.delete")}
          </Button>
        </div>
      </div>
      <SearchFilter
        value={filters}
        onChange={setFilters}
        tags={tags}
        correspondents={correspondents}
        documentTypes={documentTypes}
        isLoading={data === null}
      />
      {error ? (
        <ErrorState message={error} onRetry={() => setAttempt((a) => a + 1)} retryLabel={t("common.retry")} />
      ) : data === null ? (
        <p role="status">{t("folders.loading")}</p>
      ) : data.results.length === 0 ? (
        isEmptySearch(filters) ? (
          <EmptyState title={t("folders.emptyFolder.title")} description={t("folders.emptyFolder.description")} />
        ) : (
          <EmptyState title={t("folders.noResults.title")} description={t("folders.noResults.description")} />
        )
      ) : (
        <>
          <div className="folders__grid folders__grid--docs">
            {data.results.map((d) => {
              const sender = correspondents.find((c) => c.id === d.correspondent)?.name;
              const date = formatDate(d.created);
              return (
                <button key={d.id} type="button" className="folder-doc" onClick={() => onOpenDocument(d.id)}>
                  <DocumentThumbnail documentId={d.id} className="folder-doc__thumb" />
                  <span className="folder-doc__title">{d.title}</span>
                  <span className="folder-doc__meta">{[sender, date].filter(Boolean).join(" · ")}</span>
                </button>
              );
            })}
          </div>
          {pageCount > 1 && (
            <div className="folders__pager">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                {t("folders.prev")}
              </Button>
              <span>{t("folders.pageOf", { page, count: pageCount })}</span>
              <Button variant="secondary" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
                {t("folders.next")}
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
