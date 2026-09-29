import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import type { MetadataSuggestion } from "@papaerless/shared-types";
import { Button, Card, ConfidenceBadge, EmptyState, ErrorState, Field } from "@papaerless/ui";
import { api } from "../lib/api";

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
  const [tagsInput, setTagsInput] = useState((suggestion.tags ?? []).join(", "));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApply() {
    setIsSaving(true);
    setError(null);
    try {
      await api.applySuggestion(suggestion.documentId, {
        ...suggestion,
        title: title || undefined,
        correspondent: correspondent || undefined,
        documentType: documentType || undefined,
        tags: tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      onDone();
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

      <Field label={t("reviewInbox.titleLabel")}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>

      <Field label={t("reviewInbox.correspondentLabel")}>
        <input value={correspondent} onChange={(e) => setCorrespondent(e.target.value)} />
      </Field>

      <Field label={t("reviewInbox.documentTypeLabel")}>
        <input value={documentType} onChange={(e) => setDocumentType(e.target.value)} />
      </Field>

      <Field label={t("reviewInbox.tagsLabel")}>
        <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
      </Field>

      {(suggestion.date || suggestion.amount) && (
        <p className="suggestion-card__meta">
          {suggestion.date && t("reviewInbox.dateMeta", { date: suggestion.date })}
          {suggestion.date && suggestion.amount && " · "}
          {suggestion.amount && t("reviewInbox.amountMeta", { amount: suggestion.amount.toFixed(2) })}
        </p>
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
    <div className="review-inbox">
      {suggestions.map((s) => (
        <SuggestionCard key={s.documentId} suggestion={s} onDone={reload} />
      ))}
    </div>
  );
}
