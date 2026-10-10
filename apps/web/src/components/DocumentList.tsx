import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type {
  BulkEditAction,
  Correspondent,
  DocumentType,
  PaperlessDocument,
  Tag,
} from "@papaerless/shared-types";
import { Button, EmptyState, ErrorState } from "@papaerless/ui";
import { api } from "../lib/api";
import { friendlyError } from "../lib/errors";
import { buildSnippet, highlightSegments, type SnippetSegment } from "../lib/snippet";
import { formatEuro } from "../lib/format";
import { ConfirmDialog } from "./ConfirmDialog";

interface DocumentListProps {
  documents: PaperlessDocument[];
  correspondents: Correspondent[];
  documentTypes: DocumentType[];
  tags: Tag[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** Aktueller Suchbegriff aus dem SearchFilter – zum Hervorheben der Treffer. */
  query?: string;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  onBulkActionDone: (deletedIds?: number[]) => void;
  /** Läuft gerade eine Anfrage? Dann kein Empty-State anzeigen. */
  isLoading?: boolean;
  /** Ist irgendein Suchbegriff/Filter aktiv? */
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;

  trashRetentionDays: number;
}

const MAX_LISTED_TITLES = 5;

function renderSegments(segments: SnippetSegment[], keyPrefix: string): ReactNode {
  // Nur React-Text und <mark>-Elemente – nie Roh-HTML.
  return segments.map((seg, i) =>
    seg.match ? (
      <mark key={`${keyPrefix}-${i}`} className="document-list__highlight">
        {seg.text}
      </mark>
    ) : (
      seg.text
    ),
  );
}

export function DocumentList({
  documents,
  correspondents,
  documentTypes,
  tags,
  selectedId,
  onSelect,
  query = "",
  page,
  pageCount,
  onPageChange,
  onBulkActionDone,
  isLoading = false,
  hasActiveFilters = false,
  onResetFilters,

  trashRetentionDays,
}: DocumentListProps) {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkTag, setBulkTag] = useState("");
  const [bulkCorrespondent, setBulkCorrespondent] = useState("");
  const [bulkDocumentType, setBulkDocumentType] = useState("");
  const [isBulkBusy, setIsBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);
  const [lastAction, setLastAction] = useState<BulkEditAction | null>(null);

  // Auswahl an die aktuell sichtbaren Dokumente anpassen, z.B. wenn Filter/Seite wechseln
  // oder ein Dokument aus der Auswahl gelöscht wurde.
  useEffect(() => {
    const visibleIds = new Set(documents.map((d) => d.id));
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [documents]);

  const correspondentName = (id: number | null) =>
    correspondents.find((c) => c.id === id)?.name ?? "—";

  function toggleSelection(id: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((current) =>
      current.size === documents.length ? new Set() : new Set(documents.map((d) => d.id)),
    );
  }

  async function runBulkAction(action: BulkEditAction) {
    const ids = Array.from(selectedIds);
    setIsBulkBusy(true);
    setBulkError(null);
    setLastAction(action);
    try {
      await api.bulkEditDocuments(ids, action);
      setSelectedIds(new Set());
      setBulkTag("");
      setBulkCorrespondent("");
      setBulkDocumentType("");
      setLastAction(null);
      onBulkActionDone(action.method === "delete" ? ids : undefined);
    } catch (err) {
      setBulkError(friendlyError(err, t, t("documentList.bulkActions.actionFailed")));
    } finally {
      setIsBulkBusy(false);
    }
  }

  function handleBulkDeleteConfirmed() {
    setConfirmingBulkDelete(false);
    runBulkAction({ method: "delete" });
  }

  const selectedDocuments = documents.filter((d) => selectedIds.has(d.id));

  if (documents.length === 0) {
    // Während des Ladens nicht kurz "leer" aufblitzen lassen.
    if (isLoading) return <div className="document-list-wrap" aria-busy="true" />;
    if (hasActiveFilters) {
      return (
        <EmptyState
          title={t("documentList.noResults.title")}
          description={t("documentList.noResults.description")}
          action={
            onResetFilters && (
              <Button variant="secondary" onClick={onResetFilters}>
                {t("documentList.noResults.reset")}
              </Button>
            )
          }
        />
      );
    }
    return (
      <EmptyState
        title={t("documentList.empty.title")}
        description={t("documentList.empty.description")}
      />
    );
  }

  return (
    <div className="document-list-wrap">
      <label className="document-list__select-all">
        <input
          type="checkbox"
          checked={selectedIds.size > 0 && selectedIds.size === documents.length}
          ref={(el) => {
            if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < documents.length;
          }}
          onChange={toggleSelectAll}
          aria-label={t("documentList.selectAllAriaLabel")}
        />
        {t("documentList.selectAll")}
      </label>

      {selectedIds.size > 0 && (
        <div className="bulk-actions">
          <span className="bulk-actions__count">
            {t("documentList.selectedCount", { count: selectedIds.size })}
          </span>

          <div className="bulk-actions__group">
            <select
              value={bulkTag}
              onChange={(e) => setBulkTag(e.target.value)}
              aria-label={t("documentList.bulkActions.tagAriaLabel")}
            >
              <option value="">{t("documentList.bulkActions.chooseTag")}</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              disabled={!bulkTag || isBulkBusy}
              onClick={() => runBulkAction({ method: "add_tag", tag: Number(bulkTag) })}
            >
              {t("documentList.bulkActions.addTag")}
            </Button>
            <Button
              variant="secondary"
              disabled={!bulkTag || isBulkBusy}
              onClick={() => runBulkAction({ method: "remove_tag", tag: Number(bulkTag) })}
            >
              {t("documentList.bulkActions.removeTag")}
            </Button>
          </div>

          <div className="bulk-actions__group">
            <select
              value={bulkCorrespondent}
              onChange={(e) => setBulkCorrespondent(e.target.value)}
              aria-label={t("documentList.bulkActions.correspondentAriaLabel")}
            >
              <option value="">{t("documentList.bulkActions.chooseCorrespondent")}</option>
              {correspondents.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              disabled={!bulkCorrespondent || isBulkBusy}
              onClick={() =>
                runBulkAction({
                  method: "set_correspondent",
                  correspondent: Number(bulkCorrespondent),
                })
              }
            >
              {t("documentList.bulkActions.set")}
            </Button>
          </div>

          <div className="bulk-actions__group">
            <select
              value={bulkDocumentType}
              onChange={(e) => setBulkDocumentType(e.target.value)}
              aria-label={t("documentList.bulkActions.documentTypeAriaLabel")}
            >
              <option value="">{t("documentList.bulkActions.chooseDocumentType")}</option>
              {documentTypes.map((docType) => (
                <option key={docType.id} value={docType.id}>
                  {docType.name}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              disabled={!bulkDocumentType || isBulkBusy}
              onClick={() =>
                runBulkAction({
                  method: "set_document_type",
                  documentType: Number(bulkDocumentType),
                })
              }
            >
              {t("documentList.bulkActions.set")}
            </Button>
          </div>

          <Button variant="danger" disabled={isBulkBusy} onClick={() => setConfirmingBulkDelete(true)}>
            {isBulkBusy ? t("documentList.bulkActions.deleting") : t("documentList.bulkActions.delete")}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmingBulkDelete}
        title={t("documentList.bulkActions.confirmDelete.title", { count: selectedIds.size })}
        cancelLabel={t("documentList.bulkActions.confirmDelete.cancel")}
        confirmLabel={t("documentList.bulkActions.confirmDelete.confirm", { count: selectedIds.size })}
        onCancel={() => setConfirmingBulkDelete(false)}
        onConfirm={handleBulkDeleteConfirmed}
      >
        <ul className="confirm-dialog__list">
          {selectedDocuments.slice(0, MAX_LISTED_TITLES).map((doc) => (
            <li key={doc.id}>{doc.title || t("documentList.noTitle")}</li>
          ))}
        </ul>
        {selectedDocuments.length > MAX_LISTED_TITLES && (
          <p>{t("documentList.bulkActions.confirmDelete.more", { count: selectedDocuments.length - MAX_LISTED_TITLES })}</p>
        )}
        <p>{t("trash.confirmWarning", { count: trashRetentionDays })}</p>
      </ConfirmDialog>

      {bulkError && (
        <ErrorState
          message={bulkError}
          onRetry={lastAction ? () => runBulkAction(lastAction) : undefined}
          retryLabel={t("common.retry")}
        />
      )}

      <ul className="document-list">
        {documents.map((doc) => {
          const excerpt = query ? buildSnippet(doc.content, query) : null;
          return (
            <li key={doc.id} className="document-list__row">
              <input
                type="checkbox"
                className="document-list__checkbox"
                checked={selectedIds.has(doc.id)}
                onChange={() => toggleSelection(doc.id)}
                aria-label={t("documentList.selectDocumentAriaLabel", {
                  title: doc.title || t("documentList.untitledFallback"),
                })}
              />
              <button
                type="button"
                className={`document-list__item ${doc.id === selectedId ? "document-list__item--active" : ""}`}
                onClick={() => onSelect(doc.id)}
                aria-current={doc.id === selectedId}
              >
                <span className="document-list__title">
                  {query
                    ? renderSegments(
                        highlightSegments(doc.title || t("documentList.noTitle"), query),
                        `title-${doc.id}`,
                      )
                    : doc.title || t("documentList.noTitle")}
                </span>
                <span className="document-list__meta">
                  {correspondentName(doc.correspondent)} · {new Date(doc.created).toLocaleDateString("de-DE")}
                  {typeof doc.amount === "number" && (
                    <>
                      {" · "}
                      <strong className="document-list__amount">{formatEuro(doc.amount)}</strong>
                    </>
                  )}
                </span>
                {excerpt && (
                  <span className="document-list__excerpt">
                    {excerpt.truncatedStart && "… "}
                    {renderSegments(excerpt.segments, `excerpt-${doc.id}`)}
                    {excerpt.truncatedEnd && " …"}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {pageCount > 1 && (
        <div className="document-list__pagination">
          <Button variant="secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            {t("documentList.pagination.back")}
          </Button>
          <span className="document-list__pagination-label">
            {t("documentList.pagination.label", { page, pageCount })}
          </span>
          <Button variant="secondary" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
            {t("documentList.pagination.next")}
          </Button>
        </div>
      )}
    </div>
  );
}
