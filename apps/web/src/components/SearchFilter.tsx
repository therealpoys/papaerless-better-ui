import type { Correspondent, DocumentSearchParams, DocumentType, Tag } from "@papaerless/shared-types";

interface SearchFilterProps {
  value: DocumentSearchParams;
  onChange: (value: DocumentSearchParams) => void;
  tags: Tag[];
  correspondents: Correspondent[];
  documentTypes: DocumentType[];
}

export function SearchFilter({
  value,
  onChange,
  tags,
  correspondents,
  documentTypes,
}: SearchFilterProps) {
  function toggleTag(id: number) {
    const current = value.tags ?? [];
    const next = current.includes(id) ? current.filter((t) => t !== id) : [...current, id];
    onChange({ ...value, tags: next });
  }

  const hasActiveFilters =
    value.query || value.correspondent || value.documentType || value.dateFrom || value.dateTo || (value.tags?.length ?? 0) > 0;

  return (
    <div className="search-filter">
      <input
        className="search-filter__query"
        type="search"
        placeholder="Suche im Volltext…"
        value={value.query ?? ""}
        onChange={(e) => onChange({ ...value, query: e.target.value || undefined })}
      />

      <div className="search-filter__row">
        <select
          value={value.correspondent ?? ""}
          onChange={(e) =>
            onChange({ ...value, correspondent: e.target.value ? Number(e.target.value) : undefined })
          }
        >
          <option value="">Alle Korrespondenten</option>
          {correspondents.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={value.documentType ?? ""}
          onChange={(e) =>
            onChange({ ...value, documentType: e.target.value ? Number(e.target.value) : undefined })
          }
        >
          <option value="">Alle Typen</option>
          {documentTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="search-filter__row">
        <label className="search-filter__date">
          <span>Von</span>
          <input
            type="date"
            value={value.dateFrom ?? ""}
            onChange={(e) => onChange({ ...value, dateFrom: e.target.value || undefined })}
          />
        </label>
        <label className="search-filter__date">
          <span>Bis</span>
          <input
            type="date"
            value={value.dateTo ?? ""}
            onChange={(e) => onChange({ ...value, dateTo: e.target.value || undefined })}
          />
        </label>
      </div>

      {tags.length > 0 && (
        <div className="tag-picker">
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className={`tag-chip ${value.tags?.includes(tag.id) ? "tag-chip--active" : ""}`}
              onClick={() => toggleTag(tag.id)}
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}

      {hasActiveFilters && (
        <button type="button" className="search-filter__reset" onClick={() => onChange({})}>
          Filter zurücksetzen
        </button>
      )}
    </div>
  );
}
