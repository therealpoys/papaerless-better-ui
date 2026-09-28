import type { Correspondent, PaperlessDocument } from "@papaerless/shared-types";
import { EmptyState } from "@papaerless/ui";

interface DocumentListProps {
  documents: PaperlessDocument[];
  correspondents: Correspondent[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function DocumentList({
  documents,
  correspondents,
  selectedId,
  onSelect,
}: DocumentListProps) {
  const correspondentName = (id: number | null) =>
    correspondents.find((c) => c.id === id)?.name ?? "—";

  if (documents.length === 0) {
    return (
      <EmptyState
        title="Noch keine Dokumente"
        description="Lade links eine Datei hoch – Foto, PDF oder Scan."
      />
    );
  }

  return (
    <ul className="document-list">
      {documents.map((doc) => (
        <li key={doc.id}>
          <button
            type="button"
            className={`document-list__item ${doc.id === selectedId ? "document-list__item--active" : ""}`}
            onClick={() => onSelect(doc.id)}
            aria-current={doc.id === selectedId}
          >
            <span className="document-list__title">{doc.title || "(ohne Titel)"}</span>
            <span className="document-list__meta">
              {correspondentName(doc.correspondent)} · {new Date(doc.created).toLocaleDateString("de-DE")}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
