import { useEffect, useState } from "react";
import type {
  Correspondent,
  DocumentType,
  PaperlessDocument,
  Tag,
} from "@papaerless/shared-types";
import { api } from "../lib/api";

interface DocumentDetailProps {
  documentId: number;
  correspondents: Correspondent[];
  documentTypes: DocumentType[];
  tags: Tag[];
  onSaved: () => void;
}

export function DocumentDetail({
  documentId,
  correspondents,
  documentTypes,
  tags,
  onSaved,
}: DocumentDetailProps) {
  const [doc, setDoc] = useState<PaperlessDocument | null>(null);
  const [title, setTitle] = useState("");
  const [correspondent, setCorrespondent] = useState<number | null>(null);
  const [documentType, setDocumentType] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDoc(null);
    setError(null);
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
    </div>
  );
}
