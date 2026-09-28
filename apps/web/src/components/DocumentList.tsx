import type { Correspondent, PaperlessDocument } from "@papaerless/shared-types";

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
    return <p className="empty-state">Noch keine Dokumente. Lade eins hoch.</p>;
  }

  return (
    <ul className="document-list">
      {documents.map((doc) => (
        <li
          key={doc.id}
          className={`document-list__item ${doc.id === selectedId ? "document-list__item--active" : ""}`}
          onClick={() => onSelect(doc.id)}
        >
          <span className="document-list__title">{doc.title || "(ohne Titel)"}</span>
          <span className="document-list__meta">
            {correspondentName(doc.correspondent)} · {new Date(doc.created).toLocaleDateString("de-DE")}
          </span>
        </li>
      ))}
    </ul>
  );
}
