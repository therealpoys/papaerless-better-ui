import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import type { MetadataSuggestion, SuggestionField } from "@papaerless/shared-types";
import { Button, Card, ConfidenceBadge, EmptyState, ErrorState, Field } from "@papaerless/ui";
import { api } from "../lib/api";
import { isReviewComplete, withoutTags } from "../lib/reviewCard";

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
  const [title, setTitle] = useState(suggestion.title ?? "");
  const [correspondent, setCorrespondent] = useState(suggestion.correspondent ?? "");
  const [documentType, setDocumentType] = useState(suggestion.documentType ?? "");
  // Was schon einzeln übernommen wurde, bleibt sichtbar, ist aber gesperrt.
  const [doneFields, setDoneFields] = useState<SuggestionField[]>([]);
  const [openTags, setOpenTags] = useState(suggestion.tags ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = (): MetadataSuggestion => ({
    ...suggestion,
    title: title || undefined,
    correspondent: correspondent || undefined,
    documentType: documentType || undefined,
    tags: openTags,
  });

  async function handleApply() {
    setIsSaving(true);
    setError(null);
    try {
      await api.applySuggestion(suggestion.documentId, current());
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("reviewInbox.applyFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleApplyField(field: SuggestionField, onlyTags?: string[]) {
    setIsSaving(true);
    setError(null);
    try {
      await api.applySuggestionFields(suggestion.documentId, current(), [field], onlyTags);
      const rest = onlyTags ? withoutTags(openTags, onlyTags) : openTags;
      const done = field === "tags" ? doneFields : [...doneFields, field];
      if (field === "tags") setOpenTags(rest);
      else setDoneFields(done);
      if (isReviewComplete({ title, correspondent, documentType }, done, rest)) onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("reviewInbox.applyFailed"));
    } finally {
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

  const textFields: { field: "title" | "correspondent" | "documentType"; label: string; value: string; set: (v: string) => void }[] = [
    { field: "title", label: t("reviewInbox.titleLabel"), value: title, set: setTitle },
    { field: "correspondent", label: t("reviewInbox.correspondentLabel"), value: correspondent, set: setCorrespondent },
    { field: "documentType", label: t("reviewInbox.documentTypeLabel"), value: documentType, set: setDocumentType },
  ];

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

      {textFields.filter(({ field }) => suggestion[field]).map(({ field, label, value, set }) => {
        const done = doneFields.includes(field);
        return (
          <Field key={field} label={label}>
            <div className="suggestion-card__field">
              <input value={value} disabled={done || isSaving} onChange={(e) => set(e.target.value)} />
              {done ? (
                <span className="hint">{t("reviewInbox.fieldApplied")}</span>
              ) : (
                <Button
                  variant="secondary"
                  disabled={isSaving || !value.trim()}
                  onClick={() => void handleApplyField(field)}
                  aria-label={t("reviewInbox.applyFieldLabel", { field: label })}
                >
                  {t("reviewInbox.applyField")}
                </Button>
              )}
            </div>
          </Field>
        );
      })}

      {openTags.length > 0 && (
        <Field label={t("reviewInbox.tagsLabel")}>
          <div className="suggestion-item__tags">
            {openTags.map((name) => (
              <button
                key={name}
                type="button"
                className="suggestion-chip"
                disabled={isSaving}
                title={t("reviewInbox.addTag", { name })}
                aria-label={t("reviewInbox.addTag", { name })}
                onClick={() => void handleApplyField("tags", [name])}
              >
                + {name}
              </button>
            ))}
          </div>
        </Field>
      )}

      <div className="suggestion-card__actions">
        <Button onClick={handleApply} disabled={isSaving}>
          {t("reviewInbox.apply")}
        </Button>
        <Button variant="secondary" onClick={handleDismiss} disabled={isSaving}>
          {t("reviewInbox.dismiss")}
        </Button>
      </div>

      {error && <ErrorState message={error} />}
    </Card>
  );
}

export function ReviewInbox({ aiEnabled }: { aiEnabled: boolean }) {
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState<MetadataSuggestion[]>([]);
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
