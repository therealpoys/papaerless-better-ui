import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  Correspondent,
  DocumentSearchParams,
  DocumentType,
  ExpenseDocument,
} from "@papaerless/shared-types";
import { Button, EmptyState, ErrorState } from "@papaerless/ui";
import { api } from "../lib/api";
import {
  aggregateExpenses,
  clipRange,
  periodKeyToRange,
  presetRange,
  type DateRange,
  type ExpenseGroup,
  type RangePreset,
} from "../lib/expenses";
import { friendlyError } from "../lib/errors";
import { formatEuro } from "../lib/format";

interface ExpensesPanelProps {
  correspondents: Correspondent[];
  documentTypes: DocumentType[];
  /** Öffnet die Dokumentliste mit diesen Filtern. */
  onOpenDocuments: (filters: DocumentSearchParams) => void;
}

const PRESETS: RangePreset[] = ["all", "thisYear", "lastYear", "last12Months"];

export function ExpensesPanel({ correspondents, documentTypes, onOpenDocuments }: ExpensesPanelProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<ExpenseDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<DateRange>(() => presetRange("thisYear", new Date()));
  const [grouping, setGrouping] = useState<"month" | "year">("month");

  function load() {
    setError(null);
    setItems(null);
    api
      .listExpenses()
      .then(setItems)
      .catch((err) => setError(friendlyError(err, t, t("expenses.loadFailed"))));
  }
  useEffect(load, []);

  const summary = useMemo(() => aggregateExpenses(items ?? [], range), [items, range]);

  if (error) return <ErrorState message={error} onRetry={load} retryLabel={t("common.retry")} />;
  if (!items) return <p aria-live="polite">{t("expenses.loading")}</p>;

  const nameOf = (list: { id: number; name: string }[], id: number | null | undefined) =>
    id == null ? t("expenses.none") : (list.find((x) => x.id === id)?.name ?? `#${id}`);

  function section(
    heading: string,
    groups: ExpenseGroup[],
    labelOf: (g: ExpenseGroup) => string,
    filtersOf: (g: ExpenseGroup) => DocumentSearchParams | null,
  ) {
    return (
      <section className="expenses__section" aria-label={heading}>
        <h3>{heading}</h3>
        <table className="expenses__table">
          <tbody>
            {groups.map((g) => {
              const label = labelOf(g);
              const filters = filtersOf(g);
              return (
                <tr key={g.key || "none"}>
                  <th scope="row">
                    {filters ? (
                      <button
                        type="button"
                        className="expenses__link"
                        title={t("expenses.showDocuments", { label })}
                        aria-label={t("expenses.showDocuments", { label })}
                        onClick={() => onOpenDocuments(filters)}
                      >
                        {label}
                      </button>
                    ) : (
                      label
                    )}
                  </th>
                  <td className="expenses__count">{t("expenses.documents", { count: g.count })}</td>
                  <td className="expenses__amount">{formatEuro(g.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    );
  }

  const withRange = (extra: DocumentSearchParams): DocumentSearchParams => ({
    ...extra,
    ...(range.from && { dateFrom: range.from }),
    ...(range.to && { dateTo: range.to }),
  });

  const timeGroups = grouping === "month" ? summary.byMonth : summary.byYear;
  const monthFormat = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });
  const timeLabel = (g: ExpenseGroup) =>
    grouping === "year" ? g.key : monthFormat.format(new Date(`${g.key}-01T00:00:00Z`));

  return (
    <div className="expenses">
      <h2>{t("expenses.heading")}</h2>
      <p className="hint">{t("expenses.intro")}</p>

      <div className="expenses__filter" role="group" aria-label={t("expenses.rangeLabel")}>
        <div className="expenses__presets">
          {PRESETS.map((preset) => (
            <Button key={preset} variant="secondary" onClick={() => setRange(presetRange(preset, new Date()))}>
              {t(`expenses.presets.${preset}`)}
            </Button>
          ))}
        </div>
        <label>
          {t("expenses.from")}
          <input
            type="date"
            value={range.from ?? ""}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value || undefined }))}
          />
        </label>
        <label>
          {t("expenses.to")}
          <input
            type="date"
            value={range.to ?? ""}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value || undefined }))}
          />
        </label>
      </div>

      <p className="expenses__total" aria-live="polite">
        {t("expenses.total")}: <strong>{formatEuro(summary.total)}</strong> ·{" "}
        {t("expenses.documents", { count: summary.count })}
      </p>

      {summary.count === 0 ? (
        <EmptyState title={t("expenses.empty.title")} description={t("expenses.empty.description")} />
      ) : (
        <>
          <div className="expenses__toggle" role="group" aria-label={t("expenses.timeGrouping")}>
            <Button
              variant={grouping === "month" ? "primary" : "secondary"}
              aria-pressed={grouping === "month"}
              onClick={() => setGrouping("month")}
            >
              {t("expenses.byMonth")}
            </Button>
            <Button
              variant={grouping === "year" ? "primary" : "secondary"}
              aria-pressed={grouping === "year"}
              onClick={() => setGrouping("year")}
            >
              {t("expenses.byYear")}
            </Button>
          </div>

          {section(
            grouping === "month" ? t("expenses.byMonth") : t("expenses.byYear"),
            timeGroups,
            timeLabel,
            (g) => {
              const period = periodKeyToRange(g.key);
              return period ? { ...clipRange(period, range) } : null;
            },
          )}
          {section(
            t("expenses.byCorrespondent"),
            summary.byCorrespondent,
            (g) => nameOf(correspondents, g.id),
            (g) => (g.id == null ? null : withRange({ correspondent: g.id })),
          )}
          {section(
            t("expenses.byDocumentType"),
            summary.byDocumentType,
            (g) => nameOf(documentTypes, g.id),
            (g) => (g.id == null ? null : withRange({ documentType: g.id })),
          )}
        </>
      )}
    </div>
  );
}
