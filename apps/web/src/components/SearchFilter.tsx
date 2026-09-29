import { useEffect, useId, useRef, useState } from "react";
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
import {
  clearRecent,
  deleteSaved,
  isEmptySearch,
  listRecent,
  listSaved,
  pushRecent,
  saveSearch,
  type SavedSearch,
} from "../lib/savedSearches";

interface SearchFilterProps {
  value: DocumentSearchParams;
  onChange: (value: DocumentSearchParams) => void;
  tags: Tag[];
  correspondents: Correspondent[];
  documentTypes: DocumentType[];
  /** Läuft gerade ein Request zur Trefferliste? Für den Pending-Hinweis. */
  isLoading?: boolean;
}

const QUERY_DEBOUNCE_MS = 300;
const RECENT_RECORD_DELAY_MS = 2000;

const SCORE_OPTION = {
  value: "score:desc",
  labelKey: "searchFilter.sortOptions.relevance",
  sort: "score" as DocumentSortField,
  sortOrder: "desc" as SortOrder,
};

type PresetKey = "last7" | "lastMonth" | "thisYear";
const PRESETS: PresetKey[] = ["last7", "lastMonth", "thisYear"];

function toIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function presetRange(key: PresetKey, now = new Date()): { dateFrom: string; dateTo: string } {
  const from = new Date(now);
  if (key === "last7") from.setDate(from.getDate() - 7);
  else if (key === "lastMonth") from.setMonth(from.getMonth() - 1);
  else from.setMonth(0, 1);
  return { dateFrom: toIso(from), dateTo: toIso(now) };
}

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
  isLoading = false,
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
        onChange({
          ...current,
          query: queryInput || undefined,
          // Relevanz gibt es nur mit Volltext – ohne Suchbegriff zurück auf Standard.
          ...(!queryInput && current.sort === "score" ? { sort: undefined, sortOrder: undefined } : {}),
        });
      }
    }, QUERY_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryInput]);

  // Zwischen Tastendruck und ausgelöstem Request (Debounce) bzw. während des Requests.
  const isPending = queryInput !== (value.query ?? "");
  const isBusy = isPending || isLoading;

  const [saved, setSaved] = useState<SavedSearch[]>(() => listSaved());
  const [recent, setRecent] = useState<DocumentSearchParams[]>(() => listRecent());
  const [saveName, setSaveName] = useState("");

  // Zuletzt genutzte Suchen erst nach kurzer Ruhe festhalten, nicht bei jedem Zwischenstand.
  useEffect(() => {
    if (isEmptySearch(value)) return;
    const timeout = window.setTimeout(() => setRecent(pushRecent(value)), RECENT_RECORD_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [value]);

  function describeSearch(params: DocumentSearchParams): string {
    const parts: string[] = [];
    if (params.query) parts.push(`„${params.query}“`);
    const c = correspondents.find((x) => x.id === params.correspondent)?.name;
    if (c) parts.push(c);
    const dt = documentTypes.find((x) => x.id === params.documentType)?.name;
    if (dt) parts.push(dt);
    for (const id of params.tags ?? []) {
      const tg = tags.find((x) => x.id === id)?.name;
      if (tg) parts.push(`#${tg}`);
    }
    if (params.dateFrom || params.dateTo) {
      parts.push(`${params.dateFrom ? formatDate(params.dateFrom) : "…"}–${params.dateTo ? formatDate(params.dateTo) : "…"}`);
    }
    return parts.join(" · ") || t("searchFilter.saved.unnamed");
  }

  function applySearch(params: DocumentSearchParams) {
    setQueryInput(params.query ?? "");
    onChange({ ...params });
  }

  function handleSave() {
    const name = saveName.trim() || describeSearch(value);
    setSaved(saveSearch(name, value));
    setSaveName("");
  }

  function toggleTag(id: number) {
    const current = value.tags ?? [];
    const next = current.includes(id) ? current.filter((t) => t !== id) : [...current, id];
    onChange({ ...value, tags: next });
  }

  function updateSort(raw: string) {
    const option = [...SORT_OPTIONS, SCORE_OPTION].find((o) => o.value === raw);
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

  // Alles außer dem Suchfeld liegt hinter "Weitere Filter" – ist dort etwas aktiv, klappt der Bereich von selbst auf.
  const hasPanelFilters = Boolean(
    value.correspondent ||
      value.documentType ||
      value.dateFrom ||
      value.dateTo ||
      value.sort ||
      (value.tags?.length ?? 0) > 0,
  );
  const [moreOpen, setMoreOpen] = useState(hasPanelFilters);
  useEffect(() => {
    if (hasPanelFilters) setMoreOpen(true);
  }, [hasPanelFilters]);
  const morePanelId = useId();

  return (
    <div className="search-filter">
      <input
        className="search-filter__query search-filter__query--large"
        type="search"
        placeholder={t("searchFilter.queryPlaceholder")}
        aria-label={t("searchFilter.queryAriaLabel")}
        value={queryInput}
        aria-busy={isBusy}
        onChange={(e) => setQueryInput(e.target.value)}
      />
      <div className="search-filter__status" role="status" aria-live="polite">
        {isBusy && (
          <span className="search-filter__pending">
            <span className="search-filter__spinner" aria-hidden="true" />
            {isPending ? t("searchFilter.pending") : t("searchFilter.loading")}
          </span>
        )}
      </div>

      <button
        type="button"
        className="search-filter__more-toggle"
        aria-expanded={moreOpen}
        aria-controls={morePanelId}
        onClick={() => setMoreOpen((open) => !open)}
      >
        <span aria-hidden="true" className="search-filter__more-chevron">▸</span>
        {t("searchFilter.more.toggle")}
      </button>

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

      {hasActiveFilters && (
        <div className="search-filter__actions">
          <Button variant="secondary" onClick={() => applySearch({})}>
            {t("searchFilter.resetAll")}
          </Button>
        </div>
      )}

      <div id={morePanelId} className="search-filter__more-panel" hidden={!moreOpen}>
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
            countLabel={(n) => t("searchFilter.count", { count: n })}
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
            countLabel={(n) => t("searchFilter.count", { count: n })}
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
          {(value.query ? [...SORT_OPTIONS, SCORE_OPTION] : SORT_OPTIONS).map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.labelKey)}
            </option>
          ))}
        </select>
      </label>

      <div className="search-filter__advanced-body">
          <div className="search-filter__presets" role="group" aria-label={t("searchFilter.presets.ariaLabel")}>
            {PRESETS.map((key) => {
              const range = presetRange(key);
              const active = value.dateFrom === range.dateFrom && value.dateTo === range.dateTo;
              return (
                <TagChip key={key} active={active} onClick={() => onChange({ ...value, ...range })}>
                  {t(`searchFilter.presets.${key}`)}
                </TagChip>
              );
            })}
          </div>
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
                  {tag.document_count !== undefined && (
                    <span className="search-filter__tag-count"> ({tag.document_count})</span>
                  )}
                </TagChip>
              ))}
            </div>
          )}
      </div>

      <details className="search-filter__advanced">
        <summary>{t("searchFilter.saved.summary")}</summary>
        <div className="search-filter__advanced-body">
          {!isEmptySearch(value) && (
            <form
              className="search-filter__row"
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
            >
              <input
                type="text"
                value={saveName}
                placeholder={t("searchFilter.saved.namePlaceholder")}
                aria-label={t("searchFilter.saved.nameAriaLabel")}
                onChange={(e) => setSaveName(e.target.value)}
              />
              <Button type="submit">{t("searchFilter.saved.save")}</Button>
            </form>
          )}
          {saved.length > 0 && (
            <ul className="search-filter__saved" aria-label={t("searchFilter.saved.listAriaLabel")}>
              {saved.map((item) => (
                <li key={item.id}>
                  <button type="button" className="search-filter__saved-apply" onClick={() => applySearch(item.params)}>
                    {item.name}
                  </button>
                  <button
                    type="button"
                    className="search-filter__saved-delete"
                    aria-label={t("searchFilter.saved.delete", { name: item.name })}
                    onClick={() => setSaved(deleteSaved(item.id))}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          {recent.length > 0 && (
            <>
              <div className="search-filter__recent-head">
                <span>{t("searchFilter.recent.heading")}</span>
                <Button
                  variant="link"
                  onClick={() => {
                    clearRecent();
                    setRecent([]);
                  }}
                >
                  {t("searchFilter.recent.clear")}
                </Button>
              </div>
              <ul className="search-filter__saved" aria-label={t("searchFilter.recent.heading")}>
                {recent.map((params, i) => (
                  <li key={i}>
                    <button type="button" className="search-filter__saved-apply" onClick={() => applySearch(params)}>
                      {describeSearch(params)}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {saved.length === 0 && recent.length === 0 && isEmptySearch(value) && (
            <p className="search-filter__empty-hint">{t("searchFilter.saved.empty")}</p>
          )}
        </div>
      </details>
      </div>
    </div>
  );
}
