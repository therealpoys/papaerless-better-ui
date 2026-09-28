import { useEffect, useState } from "react";
import type {
  Correspondent,
  DocumentType,
  PaperlessDocument,
  ReminderKind,
  Tag,
} from "@papaerless/shared-types";
import { api } from "../lib/api";

interface DocumentDetailProps {
  documentId: number;
  correspondents: Correspondent[];
  documentTypes: DocumentType[];
  tags: Tag[];
  aiEnabled: boolean;
  onSaved: () => void;
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
    <div className="field">
      <span>Erinnerung anlegen</span>
      <div className="reminder-form">
        <select value={kind} onChange={(e) => setKind(e.target.value as ReminderKind)}>
          {Object.entries(REMINDER_KIND_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <input
          type="text"
          placeholder="Notiz (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button type="button" className="secondary" onClick={handleCreate} disabled={!dueDate || status === "saving"}>
          Anlegen
        </button>
      </div>
      {status === "done" && <p className="hint">Erinnerung angelegt.</p>}
      {status === "error" && <p className="error">Anlegen fehlgeschlagen.</p>}
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
}: DocumentDetailProps) {
  const [doc, setDoc] = useState<PaperlessDocument | null>(null);
  const [title, setTitle] = useState("");
  const [correspondent, setCorrespondent] = useState<number | null>(null);
  const [documentType, setDocumentType] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestionStatus, setSuggestionStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  useEffect(() => {
    setDoc(null);
    setError(null);
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
      .catch((err) => setError(err instanceof Error ? err.message : "Laden fehlgeschlagen"));
  }, [documentId]);

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    try {
      await api.updateDocument(documentId, {
        title,
        correspondent,
        documentType,
        tags: selectedTags,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setIsSaving(false);
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

  if (error) return <p className="error">{error}</p>;
  if (!doc) return <p>Lädt…</p>;

  return (
    <div className="document-detail">
      <label className="field">
        <span>Titel</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>

      <label className="field">
        <span>Korrespondent</span>
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
      </label>

      <label className="field">
        <span>Dokumenttyp</span>
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
      </label>

      <div className="field">
        <span>Tags</span>
        <div className="tag-picker">
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className={`tag-chip ${selectedTags.includes(tag.id) ? "tag-chip--active" : ""}`}
              onClick={() => toggleTag(tag.id)}
            >
              {tag.name}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span>Inhalt (OCR)</span>
        <p className="document-detail__content">{doc.content || "(kein Text erkannt)"}</p>
      </div>

      <button type="button" onClick={handleSave} disabled={isSaving}>
        {isSaving ? "Speichert…" : "Speichern"}
      </button>
      {error && <p className="error">{error}</p>}

      <ReminderForm documentId={documentId} />

      {aiEnabled && (
        <div className="field">
          <span>KI-Erkennung (optional)</span>
          <button
            type="button"
            className="secondary"
            onClick={handleRequestSuggestion}
            disabled={suggestionStatus === "loading"}
          >
            {suggestionStatus === "loading" ? "Fragt an…" : "KI-Vorschlag anfragen"}
          </button>
          {suggestionStatus === "done" && (
            <p className="hint">Vorschlag liegt in der Review-Inbox bereit.</p>
          )}
          {suggestionStatus === "error" && <p className="error">Anfrage fehlgeschlagen.</p>}
        </div>
      )}
    </div>
  );
}
