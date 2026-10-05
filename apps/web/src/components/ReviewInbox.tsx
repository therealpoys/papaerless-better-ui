import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import type { MetadataSuggestion } from "@papaerless/shared-types";
import { Button, Card, ConfidenceBadge, EmptyState, ErrorState } from "@papaerless/ui";
import { api } from "../lib/api";
import { buildApply, selectionCount, toggle, type ReviewSelection, type TextField } from "../lib/reviewCard";

const TEXT_FIELDS: TextField[] = ["title", "correspondent", "documentType"];

export function SuggestionCard({
  suggestion,
  heading,
  onDone,
}: {
  suggestion: MetadataSuggestion;
  heading?: string;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [values, setValues] = useState<Record<TextField, string>>({
    title: suggestion.title ?? "",
    correspondent: suggestion.correspondent ?? "",
    documentType: suggestion.documentType ?? "",
  });
  // Alles ist vorausgewählt; abgewählte Teile werden beim Übernehmen verworfen.
  const textFields = TEXT_FIELDS.filter((f) => suggestion[f]);
  const allTags = suggestion.tags ?? [];
  const [selection, setSelection] = useState<ReviewSelection>({ fields: textFields, tags: allTags });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = textFields.length + allTags.length;
  const count = selectionCount(selection);

  async function handleApply() {
    setIsSaving(true);
    setError(null);
    try {
      const { fields, onlyTags } = buildApply(selection);
      const edited: MetadataSuggestion = {
        ...suggestion,
        title: values.title || undefined,
        correspondent: values.correspondent || undefined,
        documentType: values.documentType || undefined,
      };
      await api.applySuggestionFields(suggestion.documentId, edited, fields, onlyTags);
      // Abgewähltes ist damit abgelehnt und soll nicht in der Liste hängen bleiben.
      if (count < total) await api.dismissSuggestion(suggestion.documentId);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("reviewInbox.applyFailed"));
      setIsSaving(false);
    }
  }

  async function handleDismiss() {
    setIsSaving(true);
    try {
      await api.dismissSuggestion(suggestion.documentId);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("reviewInbox.dismissFailed"));
      setIsSaving(false);
    }
  }

  const labels: Record<TextField, string> = {
    title: t("reviewInbox.titleLabel"),
    correspondent: t("reviewInbox.correspondentLabel"),
    documentType: t("reviewInbox.documentTypeLabel"),
  };

  return (
    <Card className="suggestion-card">
      <div className="suggestion-card__header">
        <span>{heading ?? t("reviewInbox.documentHeading", { id: suggestion.documentId })}</span>
        <ConfidenceBadge
          confidence={suggestion.confidence}
          levelLabels={{
            high: t("reviewInbox.confidence.high"),
            medium: t("reviewInbox.confidence.medium"),
            low: t("reviewInbox.confidence.low"),
          }}
        />
      </div>

      {textFields.map((field) => {
        const checked = selection.fields.includes(field);
        return (
          <div key={field} className="suggestion-pick">
            <label className="suggestion-pick__label">
              <input
                type="checkbox"
                checked={checked}
                disabled={isSaving}
                onChange={() => setSelection((s) => ({ ...s, fields: toggle(s.fields, field) }))}
              />
              {labels[field]}
            </label>
            <input
              value={values[field]}
              disabled={!checked || isSaving}
              aria-label={labels[field]}
              onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.value }))}
            />
          </div>
        );
      })}

      {allTags.length > 0 && (
        <div className="suggestion-pick">
          <span className="suggestion-pick__label">{t("reviewInbox.tagsLabel")}</span>
          <div className="suggestion-item__tags">
            {allTags.map((name) => {
              const on = selection.tags.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  className="suggestion-toggle"
                  aria-pressed={on}
                  disabled={isSaving}
                  onClick={() => setSelection((s) => ({ ...s, tags: toggle(s.tags, name) }))}
                >
                  {on ? "✓ " : ""}
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="suggestion-card__actions">
        <Button onClick={handleApply} disabled={isSaving || count === 0}>
          {count === total ? t("reviewInbox.apply") : t("reviewInbox.applySelection", { count, total })}
        </Button>
        <Button variant="link" onClick={handleDismiss} disabled={isSaving}>
          {t("reviewInbox.dismiss")}
        </Button>
      </div>

      {error && <ErrorState message={error} />}
    </Card>
  );
}

export function ReviewInbox({ aiEnabled }: { aiEnabled: boolean }) {
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState<MetadataSuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    setError(null);
    api.listSuggestions().then(setSuggestions).catch((err) => setError(err.message));
  }

  useEffect(reload, []);

  if (!aiEnabled) {
    return (
      <EmptyState
        title={t("reviewInbox.disabled.title")}
        description={
          <Trans i18nKey="reviewInbox.disabled.description" components={[<code key="0" />, <code key="1" />, <code key="2" />]} />
        }
      />
    );
  }

  if (error) return <ErrorState message={error} onRetry={reload} retryLabel={t("common.retry")} />;

  if (suggestions === null) return <p className="hint" role="status">{t("reviewInbox.loading")}</p>;

  if (suggestions.length === 0) {
    return (
      <EmptyState
        title={t("reviewInbox.empty.title")}
        description={t("reviewInbox.empty.description")}
      />
    );
  }

  return (
    <section className="review-inbox" aria-labelledby="review-inbox-title">
      <h2 id="review-inbox-title">{t("reviewInbox.title", { count: suggestions.length })}</h2>
      <div className="review-inbox__grid">
        {suggestions.map((s) => (
          <SuggestionCard key={s.documentId} suggestion={s} onDone={reload} />
        ))}
      </div>
    </section>
  );
}
