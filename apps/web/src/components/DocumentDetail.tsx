import { useEffect, useState } from "react";
import type {
  Correspondent,
  DocumentType,
  PaperlessDocument,
  ReminderKind,
  Tag,
} from "@papaerless/shared-types";
import { Button, ErrorState, Field, TagChip } from "@papaerless/ui";
import { api } from "../lib/api";

interface DocumentDetailProps {
  documentId: number;
  correspondents: Correspondent[];
  documentTypes: DocumentType[];
  tags: Tag[];
  aiEnabled: boolean;
  onSaved: () => void;
  onDeleted: () => void;
}

const REMINDER_KIND_LABEL: Record<ReminderKind, string> = {
  due_date: "Fälligkeit",
  cancellation_deadline: "Kündigungsfrist",
};

function ReminderForm({ documentId }: { documentId: number }) {
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
      <span className="ui-field__label">Erinnerung anlegen</span>
      <div className="reminder-form">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as ReminderKind)}
          aria-label="Art der Erinnerung"
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
          aria-label="Fälligkeitsdatum"
        />
        <input
          type="text"
          placeholder="Notiz (optional)"
          aria-label="Notiz (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button variant="secondary" onClick={handleCreate} disabled={!dueDate || status === "saving"}>
          Anlegen
        </Button>
      </div>
      {status === "done" && <p className="hint">Erinnerung angelegt.</p>}
      {status === "error" && <ErrorState message="Anlegen fehlgeschlagen." onRetry={handleCreate} />}
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
}: DocumentDetailProps) {
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
  const [suggestionStatus, setSuggestionStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  function load() {
    setDoc(null);
    setLoadError(null);
    setSuggestionStatus("idle");
    api
      .getDocument(documentId)
      .then((loaded) => {
        setDoc(loaded);
        setTitle(loaded.title);
        setCorrespondent(loaded.correspondent);
        setDocumentType(loaded.documentType);
        setSelectedTags(loaded.tags);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Laden fehlgeschlagen"));
  }

  useEffect(load, [documentId]);

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
      setSaveError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
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
      setSaveError(err instanceof Error ? err.message : "Download fehlgeschlagen");
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleDelete() {
    if (!doc) return;
    const confirmed = window.confirm(
      `"${doc.title || "Dokument"}" wirklich unwiderruflich aus Paperless löschen?`,
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteDocument(documentId);
      onDeleted();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
      setIsDeleting(false);
    }
  }

  function toggleTag(id: number) {
    setSelectedTags((current) =>
      current.includes(id) ? current.filter((t) => t !== id) : [...current, id],
    );
  }

  async function handleRequestSuggestion() {
    setSuggestionStatus("loading");
    try {
      await api.suggestMetadata(documentId);
      setSuggestionStatus("done");
    } catch {
      setSuggestionStatus("error");
    }
  }

  if (loadError) return <ErrorState message={loadError} onRetry={load} />;
  if (!doc) return <p aria-live="polite">Lädt…</p>;

  return (
    <div className="document-detail">
      <Field label="Titel">
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>

      <Field label="Korrespondent">
        <select
          value={correspondent ?? ""}
          onChange={(e) => setCorrespondent(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">—</option>
          {correspondents.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Dokumenttyp">
        <select
          value={documentType ?? ""}
          onChange={(e) => setDocumentType(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">—</option>
          {documentTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="ui-field">
        <span className="ui-field__label">Tags</span>
        <div className="tag-picker">
          {tags.map((tag) => (
            <TagChip key={tag.id} active={selectedTags.includes(tag.id)} onClick={() => toggleTag(tag.id)}>
              {tag.name}
            </TagChip>
          ))}
        </div>
      </div>

      <div className="ui-field">
        <span className="ui-field__label">Inhalt (OCR)</span>
        <p className="document-detail__content">{doc.content || "(kein Text erkannt)"}</p>
      </div>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Speichert…" : "Speichern"}
        </Button>
        <Button variant="secondary" onClick={handleDownload} disabled={isDownloading}>
          {isDownloading ? "Lädt…" : "Original herunterladen"}
        </Button>
        <Button variant="danger" onClick={handleDelete} disabled={isDeleting}>
          {isDeleting ? "Löscht…" : "Löschen"}
        </Button>
      </div>
      {saveError && <ErrorState message={saveError} onRetry={handleSave} />}
      {deleteError && <ErrorState message={deleteError} onRetry={handleDelete} />}

      <ReminderForm documentId={documentId} />

      {aiEnabled && (
        <div className="ui-field">
          <span className="ui-field__label">KI-Erkennung (optional)</span>
          <Button
            variant="secondary"
            onClick={handleRequestSuggestion}
            disabled={suggestionStatus === "loading"}
          >
            {suggestionStatus === "loading" ? "Fragt an…" : "KI-Vorschlag anfragen"}
          </Button>
          {suggestionStatus === "done" && (
            <p className="hint">Vorschlag liegt in der Review-Inbox bereit.</p>
          )}
          {suggestionStatus === "error" && (
            <ErrorState message="Anfrage fehlgeschlagen." onRetry={handleRequestSuggestion} />
          )}
        </div>
      )}
    </div>
  );
}
