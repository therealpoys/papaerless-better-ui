import { useTranslation } from "react-i18next";
import type { Correspondent, DocumentType, MetadataSuggestion, PaperlessDocument, Tag } from "@papaerless/shared-types";
import { Button, ConfidenceBadge, ErrorState } from "@papaerless/ui";
import { formatDate, formatEuro } from "../lib/format";
import { buildExtraRows, buildSuggestionRows, missingTags, type SuggestionField } from "../lib/suggestionCompare";

interface DocumentSuggestionProps {
  doc: PaperlessDocument;
  suggestion: MetadataSuggestion;
  lists: { correspondents: Correspondent[]; documentTypes: DocumentType[]; tags: Tag[] };
  busy: boolean;
  error: string | null;
  /** Übernimmt nur diese Felder; `tags` enthält dann die einzeln gewählten Tags. */
  onApplyField: (field: SuggestionField, tags?: string[]) => void;
  onApplyAll: () => void;
  onDismiss: () => void;
}

export function DocumentSuggestion({
  doc,
  suggestion,
  lists,
  busy,
  error,
  onApplyField,
  onApplyAll,
  onDismiss,
}: DocumentSuggestionProps) {
  const { t } = useTranslation();
  const rows = [...buildSuggestionRows(doc, suggestion, lists), ...buildExtraRows(doc, suggestion)];
  const show = (field: SuggestionField, value: string) =>
    field === "date" ? formatDate(value) : field === "amount" ? formatEuro(Number(value)) : value;
  const isNew = (names: string[], newNames: string[], name: string) => newNames.includes(name) && names.includes(name);
  const newBadge = <span className="suggestion-badge">{t("documentDetail.ai.newEntry")}</span>;

  const items = rows.flatMap((row) => {
    if (row.field === "tags") {
      const open = missingTags(row);
      return open.length ? [{ row, open }] : [];
    }
    return row.changed ? [{ row, open: row.suggested }] : [];
  });

  return (
    <section className="suggestion-card" aria-label={t("documentDetail.ai.suggestionHeading")}>
      <div className="suggestion-card__header">
        <span>{t("documentDetail.ai.suggestionHeading")}</span>
        <ConfidenceBadge
          confidence={suggestion.confidence}
          levelLabels={{
            high: t("documentDetail.ai.confidence.high"),
            medium: t("documentDetail.ai.confidence.medium"),
            low: t("documentDetail.ai.confidence.low"),
          }}
        />
      </div>

      {items.length === 0 && <p className="hint">{t("documentDetail.ai.nothingToApply")}</p>}

      <ul className="suggestion-list">
        {items.map(({ row, open }) => (
          <li key={row.field} className="suggestion-item">
            <div className="suggestion-item__label">
              {row.field === "tags" ? t("documentDetail.ai.tagsSuggested") : t(`documentDetail.${row.field}Label`)}
            </div>
            {row.field === "tags" ? (
              <div className="suggestion-item__tags">
                {open.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="suggestion-chip"
                    disabled={busy}
                    title={t("documentDetail.ai.addTag", { name })}
                    aria-label={t("documentDetail.ai.addTag", { name })}
                    onClick={() => onApplyField("tags", [name])}
                  >
                    + {name}
                    {isNew(open, row.newNames, name) && newBadge}
                  </button>
                ))}
              </div>
            ) : (
              <div className="suggestion-item__row">
                <div className="suggestion-item__value">
                  <strong>{show(row.field, row.suggested[0])}</strong>
                  {isNew(row.suggested, row.newNames, row.suggested[0]) && newBadge}
                  {row.current.length > 0 && (
                    <span className="suggestion-item__current">
                      {t("documentDetail.ai.currentColumn")}: {row.current.map((v) => show(row.field, v)).join(", ")}
                    </span>
                  )}
                </div>
                <Button variant="secondary" disabled={busy} onClick={() => onApplyField(row.field)}>
                  {t("documentDetail.ai.applyField")}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="suggestion-card__actions">
        {items.length > 1 && (
          <Button onClick={onApplyAll} disabled={busy}>
            {busy ? t("documentDetail.ai.applying") : t("documentDetail.ai.apply")}
          </Button>
        )}
        <Button variant="secondary" onClick={onDismiss} disabled={busy}>
          {t("documentDetail.ai.dismiss")}
        </Button>
      </div>
      {error && <ErrorState message={error} />}
    </section>
  );
}
