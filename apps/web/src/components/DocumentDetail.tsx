import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  Correspondent,
  DocumentType,
  MetadataSuggestion,
  PaperlessDocument,
  ReminderKind,
  Tag,
} from "@papaerless/shared-types";
import { Button, Combobox, ConfidenceBadge, ErrorState, Field } from "@papaerless/ui";
import { TagCombobox } from "./TagCombobox";
import { api } from "../lib/api";
import { friendlyError } from "../lib/errors";
import { buildSuggestionRows } from "../lib/suggestionCompare";
import { ConfirmDialog } from "./ConfirmDialog";

const SUGGESTION_POLL_MS = 4000;

interface DocumentDetailProps {
  documentId: number;
  correspondents: Correspondent[];
  documentTypes: DocumentType[];
  tags: Tag[];
  aiEnabled: boolean;
  onSaved: () => void;
  onDeleted: () => void;
  onMetadataChanged: () => void;
}

function ReminderForm({ documentId }: { documentId: number }) {
  const { t } = useTranslation();
  const REMINDER_KIND_LABEL: Record<ReminderKind, string> = {
    due_date: t("documentDetail.reminderKind.due_date"),
    cancellation_deadline: t("documentDetail.reminderKind.cancellation_deadline"),
  };
  const [kind, setKind] = useState<ReminderKind>("due_date");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");

  async function handleCreate() {
    if (!dueDate) return;
    setStatus("saving");
    try {
      await api.createReminder({ documentId, kind, dueDate, note: note || undefined });
      setStatus("done");
      setNote("");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="ui-field">
      <span className="ui-field__label">{t("documentDetail.reminderForm.label")}</span>
      <div className="reminder-form">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as ReminderKind)}
          aria-label={t("documentDetail.reminderForm.kindAriaLabel")}
        >
          {Object.entries(REMINDER_KIND_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          aria-label={t("documentDetail.reminderForm.dueDateAriaLabel")}
        />
        <input
          type="text"
          placeholder={t("documentDetail.reminderForm.notePlaceholder")}
          aria-label={t("documentDetail.reminderForm.noteAriaLabel")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button variant="secondary" onClick={handleCreate} disabled={!dueDate || status === "saving"}>
          {t("documentDetail.reminderForm.create")}
        </Button>
      </div>
      {status === "done" && <p className="hint">{t("documentDetail.reminderForm.created")}</p>}
      {status === "error" && (
        <ErrorState
          message={t("documentDetail.reminderForm.createFailed")}
          onRetry={handleCreate}
          retryLabel={t("common.retry")}
        />
      )}
    </div>
  );
}

export function DocumentDetail({
  documentId,
  correspondents,
  documentTypes,
  tags,
  aiEnabled,
  onSaved,
  onDeleted,
  onMetadataChanged,
}: DocumentDetailProps) {
  const { t } = useTranslation();
  const [doc, setDoc] = useState<PaperlessDocument | null>(null);
  const [title, setTitle] = useState("");
  const [correspondent, setCorrespondent] = useState<number | null>(null);
  const [documentType, setDocumentType] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, setPending] = useState<MetadataSuggestion | null>(null);
  const [pendingBusy, setPendingBusy] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [suggestionStatus, setSuggestionStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  function load() {
    setDoc(null);
    setLoadError(null);
    setSuggestionStatus("idle");
    setPending(null);
    setPendingError(null);
    setGenerating(false);
    api
      .getPendingState(documentId)
      .then((state) => {
        setPending(state.suggestion);
        setGenerating(Boolean(state.generating));
      })
      .catch(() => setPending(null));
    api
      .getDocument(documentId)
      .then((loaded) => {
        setDoc(loaded);
        setTitle(loaded.title);
        setCorrespondent(loaded.correspondent);
        setDocumentType(loaded.documentType);
        setSelectedTags(loaded.tags);
      })
      .catch((err) => setLoadError(friendlyError(err, t, t("documentDetail.loadFailed"))));
  }

  useEffect(load, [documentId]);

  // Solange die KI rechnet, regelmäßig nachsehen – der Vorschlag erscheint dann von selbst.
  useEffect(() => {
    if (!generating) return;
    const timer = setInterval(() => {
      api
        .getPendingState(documentId)
        .then((state) => {
          if (state.suggestion) setPending(state.suggestion);
          if (state.suggestion || !state.generating) setGenerating(false);
        })
        .catch(() => setGenerating(false));
    }, SUGGESTION_POLL_MS);
    return () => clearInterval(timer);
  }, [generating, documentId]);

  async function handleSave() {
    setIsSaving(true);
    setSaveError(null);
    try {
      await api.updateDocument(documentId, {
        title,
        correspondent,
        documentType,
        tags: selectedTags,
      });
      onSaved();
    } catch (err) {
      setSaveError(friendlyError(err, t, t("documentDetail.saveFailed")));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDownload() {
    setIsDownloading(true);
    try {
      const { blob, fileName } = await api.downloadDocument(documentId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setSaveError(friendlyError(err, t, t("documentDetail.downloadFailed")));
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleDelete() {
    if (!doc) return;
    setConfirmingDelete(false);
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteDocument(documentId);
      onDeleted();
    } catch (err) {
      setDeleteError(friendlyError(err, t, t("documentDetail.deleteFailed")));
      setIsDeleting(false);
    }
  }

  async function handleRequestSuggestion() {
    setSuggestionStatus("loading");
    setGenerating(true);
    try {
      const suggestion = await api.suggestMetadata(documentId);
      setPending(suggestion);
      setSuggestionStatus("done");
    } catch {
      setSuggestionStatus("error");
    } finally {
      setGenerating(false);
    }
  }

  async function handlePendingAction(action: "apply" | "dismiss") {
    if (!pending) return;
    setPendingBusy(true);
    setPendingError(null);
    try {
      if (action === "apply") {
        await api.applySuggestion(documentId, pending);
        onMetadataChanged();
      } else {
        await api.dismissSuggestion(documentId);
      }
      load();
    } catch {
      setPendingError(t(action === "apply" ? "documentDetail.ai.applyFailed" : "documentDetail.ai.dismissFailed"));
    } finally {
      setPendingBusy(false);
    }
  }

  if (loadError) return <ErrorState message={loadError} onRetry={load} retryLabel={t("common.retry")} />;
  if (!doc) return <p aria-live="polite">{t("documentDetail.loading")}</p>;

  return (
    <div className="document-detail">
      {!pending && generating && (
        <p className="hint suggestion-loading" role="status">
          {t("documentDetail.ai.generating")}
        </p>
      )}
      {pending && (
        <section className="suggestion-card" aria-label={t("documentDetail.ai.suggestionHeading")}>
          <div className="suggestion-card__header">
            <span>{t("documentDetail.ai.suggestionHeading")}</span>
            <ConfidenceBadge
              confidence={pending.confidence}
              levelLabels={{
                high: t("documentDetail.ai.confidence.high"),
                medium: t("documentDetail.ai.confidence.medium"),
                low: t("documentDetail.ai.confidence.low"),
              }}
            />
          </div>
          <table className="suggestion-compare">
            <thead>
              <tr>
                <th />
                <th>{t("documentDetail.ai.currentColumn")}</th>
                <th>{t("documentDetail.ai.suggestedColumn")}</th>
              </tr>
            </thead>
            <tbody>
              {buildSuggestionRows(doc, pending, { correspondents, documentTypes, tags }).map((row) => (
                <tr key={row.field} data-changed={row.changed}>
                  <th scope="row">{t(`documentDetail.${row.field}Label`)}</th>
                  <td>{row.current.join(", ") || t("documentDetail.ai.empty")}</td>
                  <td>
                    {row.suggested.length === 0 ? (
                      t("documentDetail.ai.empty")
                    ) : row.changed ? (
                      <strong>{row.suggested.join(", ")}</strong>
                    ) : (
                      `${row.suggested.join(", ")} (${t("documentDetail.ai.unchanged")})`
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="suggestion-card__actions">
            <Button onClick={() => handlePendingAction("apply")} disabled={pendingBusy}>
              {pendingBusy ? t("documentDetail.ai.applying") : t("documentDetail.ai.apply")}
            </Button>
            <Button variant="secondary" onClick={() => handlePendingAction("dismiss")} disabled={pendingBusy}>
              {t("documentDetail.ai.dismiss")}
            </Button>
          </div>
          {pendingError && <ErrorState message={pendingError} />}
        </section>
      )}

      <Field label={t("documentDetail.titleLabel")}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>

      <Field label={t("documentDetail.correspondentLabel")}>
        <Combobox
          aria-label={t("documentDetail.correspondentAriaLabel")}
          options={correspondents}
          value={correspondent}
          onChange={setCorrespondent}
          emptyLabel={t("documentDetail.correspondentEmptyLabel")}
          removeSelectionLabel={t("common.combobox.removeSelection")}
          creatingLabel={t("common.combobox.creating")}
          createOptionLabel={(name) => t("common.combobox.createOption", { name })}
          typeToCreateHint={t("common.combobox.typeToCreate")}
          noResultsHint={t("common.combobox.noResults")}
          createFailedLabel={t("common.combobox.createFailed")}
          onCreate={async (name) => {
            const created = await api.createCorrespondent(name);
            onMetadataChanged();
            return created;
          }}
        />
      </Field>

      <Field label={t("documentDetail.documentTypeLabel")}>
        <Combobox
          aria-label={t("documentDetail.documentTypeAriaLabel")}
          options={documentTypes}
          value={documentType}
          onChange={setDocumentType}
          emptyLabel={t("documentDetail.documentTypeEmptyLabel")}
          removeSelectionLabel={t("common.combobox.removeSelection")}
          creatingLabel={t("common.combobox.creating")}
          createOptionLabel={(name) => t("common.combobox.createOption", { name })}
          typeToCreateHint={t("common.combobox.typeToCreate")}
          noResultsHint={t("common.combobox.noResults")}
          createFailedLabel={t("common.combobox.createFailed")}
          onCreate={async (name) => {
            const created = await api.createDocumentType(name);
            onMetadataChanged();
            return created;
          }}
        />
      </Field>

      <div className="ui-field">
        <span className="ui-field__label">{t("documentDetail.tagsLabel")}</span>
        <TagCombobox
          aria-label={t("documentDetail.tagsLabel")}
          placeholder={t("documentDetail.tagsPlaceholder")}
          options={tags}
          values={selectedTags}
          onChange={setSelectedTags}
          onCreate={async (name) => {
            const known = tags.find((x) => x.name.toLowerCase() === name.toLowerCase());
            if (known) return known;
            const created = await api.createTag(name);
            onMetadataChanged();
            return created;
          }}
        />
        <span className="ui-field__hint">{t("documentDetail.newTagHint")}</span>
      </div>

      <div className="ui-field">
        <span className="ui-field__label">{t("documentDetail.contentLabel")}</span>
        <p className="document-detail__content">{doc.content || t("documentDetail.noContent")}</p>
      </div>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? t("documentDetail.saving") : t("documentDetail.save")}
        </Button>
        <Button variant="secondary" onClick={handleDownload} disabled={isDownloading}>
          {isDownloading ? t("documentDetail.downloading") : t("documentDetail.download")}
        </Button>
        <Button variant="danger" onClick={() => setConfirmingDelete(true)} disabled={isDeleting}>
          {isDeleting ? t("documentDetail.deleting") : t("documentDetail.delete")}
        </Button>
      </div>
      {saveError && <ErrorState message={saveError} onRetry={handleSave} retryLabel={t("common.retry")} />}
      {deleteError && <ErrorState message={deleteError} onRetry={handleDelete} retryLabel={t("common.retry")} />}

      <ConfirmDialog
        open={confirmingDelete}
        title={t("documentDetail.confirmDelete.title")}
        cancelLabel={t("documentDetail.confirmDelete.cancel")}
        confirmLabel={t("documentDetail.confirmDelete.confirm")}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={handleDelete}
      >
        <p className="confirm-dialog__doc">{doc.title || t("documentDetail.untitledFallback")}</p>
        <p>{t("documentDetail.confirmDelete.warning")}</p>
      </ConfirmDialog>

      <ReminderForm documentId={documentId} />

      {aiEnabled && !pending && (
        <div className="ui-field">
          <span className="ui-field__label">{t("documentDetail.ai.label")}</span>
          <Button
            variant="secondary"
            onClick={handleRequestSuggestion}
            disabled={suggestionStatus === "loading" || generating}
          >
            {suggestionStatus === "loading" ? t("documentDetail.ai.requesting") : t("documentDetail.ai.request")}
          </Button>
          {suggestionStatus === "done" && (
            <p className="hint">{t("documentDetail.ai.requested")}</p>
          )}
          {suggestionStatus === "error" && (
            <ErrorState
              message={t("documentDetail.ai.requestFailed")}
              onRetry={handleRequestSuggestion}
              retryLabel={t("common.retry")}
            />
          )}
        </div>
      )}
    </div>
  );
}
