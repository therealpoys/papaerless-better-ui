import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  Correspondent,
  DocumentSearchParams,
  DocumentSortField,
  DocumentType,
  SortOrder,
  Tag,
} from "@papaerless/shared-types";
import { Button, Combobox, TagChip } from "@papaerless/ui";

interface SearchFilterProps {
  value: DocumentSearchParams;
  onChange: (value: DocumentSearchParams) => void;
  tags: Tag[];
  correspondents: Correspondent[];
  documentTypes: DocumentType[];
}

const QUERY_DEBOUNCE_MS = 300;

const SORT_OPTIONS: { value: string; labelKey: string; sort?: DocumentSortField; sortOrder?: SortOrder }[] = [
  { value: "", labelKey: "searchFilter.sortOptions.default" },
  { value: "created:desc", labelKey: "searchFilter.sortOptions.createdDesc", sort: "created", sortOrder: "desc" },
  { value: "created:asc", labelKey: "searchFilter.sortOptions.createdAsc", sort: "created", sortOrder: "asc" },
  { value: "title:asc", labelKey: "searchFilter.sortOptions.titleAsc", sort: "title", sortOrder: "asc" },
  { value: "title:desc", labelKey: "searchFilter.sortOptions.titleDesc", sort: "title", sortOrder: "desc" },
];

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
}

export function SearchFilter({
  value,
  onChange,
  tags,
  correspondents,
  documentTypes,
}: SearchFilterProps) {
  const { t } = useTranslation();
  // Volltextsuche debounced halten, damit nicht bei jedem Tastendruck ein API-Call ausgelöst wird.
  const [queryInput, setQueryInput] = useState(value.query ?? "");
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    setQueryInput(value.query ?? "");
  }, [value.query]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const current = valueRef.current;
      if (queryInput !== (current.query ?? "")) {
        onChange({ ...current, query: queryInput || undefined });
      }
    }, QUERY_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryInput]);

  const [advancedOpen] = useState(
    () => Boolean(value.dateFrom || value.dateTo || (value.tags?.length ?? 0) > 0),
  );

  function toggleTag(id: number) {
    const current = value.tags ?? [];
    const next = current.includes(id) ? current.filter((t) => t !== id) : [...current, id];
    onChange({ ...value, tags: next });
  }

  function updateSort(raw: string) {
    const option = SORT_OPTIONS.find((o) => o.value === raw);
    onChange({ ...value, sort: option?.sort, sortOrder: option?.sortOrder });
  }

  const sortValue = value.sort ? `${value.sort}:${value.sortOrder ?? (value.sort === "title" ? "asc" : "desc")}` : "";

  const correspondentName = correspondents.find((c) => c.id === value.correspondent)?.name;
  const documentTypeName = documentTypes.find((dt) => dt.id === value.documentType)?.name;

  const activeFilters: { key: string; label: string; onRemove: () => void }[] = [];
  if (value.query) {
    activeFilters.push({
      key: "query",
      label: t("searchFilter.activeFilters.query", { query: value.query }),
      onRemove: () => onChange({ ...value, query: undefined }),
    });
  }
  if (value.correspondent) {
    activeFilters.push({
      key: "correspondent",
      label: t("searchFilter.activeFilters.correspondent", {
        name: correspondentName ?? value.correspondent,
      }),
      onRemove: () => onChange({ ...value, correspondent: undefined }),
    });
  }
  if (value.documentType) {
    activeFilters.push({
      key: "documentType",
      label: t("searchFilter.activeFilters.documentType", {
        name: documentTypeName ?? value.documentType,
      }),
      onRemove: () => onChange({ ...value, documentType: undefined }),
    });
  }
  if (value.dateFrom) {
    activeFilters.push({
      key: "dateFrom",
      label: t("searchFilter.activeFilters.from", { date: formatDate(value.dateFrom) }),
      onRemove: () => onChange({ ...value, dateFrom: undefined }),
    });
  }
  if (value.dateTo) {
    activeFilters.push({
      key: "dateTo",
      label: t("searchFilter.activeFilters.to", { date: formatDate(value.dateTo) }),
      onRemove: () => onChange({ ...value, dateTo: undefined }),
    });
  }
  for (const tagId of value.tags ?? []) {
    const tag = tags.find((tg) => tg.id === tagId);
    activeFilters.push({
      key: `tag-${tagId}`,
      label: t("searchFilter.activeFilters.tag", { name: tag?.name ?? tagId }),
      onRemove: () => onChange({ ...value, tags: (value.tags ?? []).filter((id) => id !== tagId) }),
    });
  }

  const hasActiveFilters = activeFilters.length > 0;

  return (
    <div className="search-filter">
      <input
        className="search-filter__query"
        type="search"
        placeholder={t("searchFilter.queryPlaceholder")}
        aria-label={t("searchFilter.queryAriaLabel")}
        value={queryInput}
        onChange={(e) => setQueryInput(e.target.value)}
      />

      <div className="search-filter__row">
        <div className="search-filter__field">
          <span className="search-filter__field-label">
            {t("searchFilter.correspondentLabel")}
            <span className="search-filter__field-hint">{t("searchFilter.correspondentHint")}</span>
          </span>
          <Combobox
            aria-label={t("searchFilter.correspondentAriaLabel")}
            options={correspondents}
            value={value.correspondent ?? null}
            onChange={(id) => onChange({ ...value, correspondent: id ?? undefined })}
            emptyLabel={t("searchFilter.correspondentEmptyLabel")}
            removeSelectionLabel={t("common.combobox.removeSelection")}
            typeToCreateHint={t("common.combobox.typeToCreate")}
            noResultsHint={t("common.combobox.noResults")}
          />
        </div>
        <div className="search-filter__field">
          <span className="search-filter__field-label">
            {t("searchFilter.documentTypeLabel")}
            <span className="search-filter__field-hint">{t("searchFilter.documentTypeHint")}</span>
          </span>
          <Combobox
            aria-label={t("searchFilter.documentTypeAriaLabel")}
            options={documentTypes}
            value={value.documentType ?? null}
            onChange={(id) => onChange({ ...value, documentType: id ?? undefined })}
            emptyLabel={t("searchFilter.documentTypeEmptyLabel")}
            removeSelectionLabel={t("common.combobox.removeSelection")}
            typeToCreateHint={t("common.combobox.typeToCreate")}
            noResultsHint={t("common.combobox.noResults")}
          />
        </div>
      </div>

      <label className="search-filter__field">
        <span className="search-filter__field-label">{t("searchFilter.sortLabel")}</span>
        <select
          aria-label={t("searchFilter.sortAriaLabel")}
          value={sortValue}
          onChange={(e) => updateSort(e.target.value)}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.labelKey)}
            </option>
          ))}
        </select>
      </label>

      {hasActiveFilters && (
        <ul className="search-filter__badges" aria-label={t("searchFilter.activeFilters.ariaLabel")}>
          {activeFilters.map((filter) => (
            <li key={filter.key}>
              <button type="button" className="search-filter__badge" onClick={filter.onRemove}>
                {filter.label}
                <span aria-hidden="true">×</span>
                <span className="sr-only">{t("searchFilter.activeFilters.remove")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <details className="search-filter__advanced" open={advancedOpen}>
        <summary>{t("searchFilter.advanced.summary")}</summary>
        <div className="search-filter__advanced-body">
          <div className="search-filter__row">
            <label className="search-filter__date">
              <span>{t("searchFilter.advanced.from")}</span>
              <input
                type="date"
                value={value.dateFrom ?? ""}
                onChange={(e) => onChange({ ...value, dateFrom: e.target.value || undefined })}
              />
            </label>
            <label className="search-filter__date">
              <span>{t("searchFilter.advanced.to")}</span>
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
                <TagChip key={tag.id} active={value.tags?.includes(tag.id)} onClick={() => toggleTag(tag.id)}>
                  {tag.name}
                </TagChip>
              ))}
            </div>
          )}
        </div>
      </details>

      {hasActiveFilters && (
        <Button variant="link" onClick={() => onChange({})}>
          {t("searchFilter.resetAll")}
        </Button>
      )}
    </div>
  );
}
