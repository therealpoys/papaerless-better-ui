import { useEffect, useState } from "react";
import type { MetadataSuggestion } from "@papaerless/shared-types";
import { Button, Card, ConfidenceBadge, EmptyState, ErrorState, Field } from "@papaerless/ui";
import { api } from "../lib/api";

function SuggestionCard({
  suggestion,
  onDone,
}: {
  suggestion: MetadataSuggestion;
  onDone: () => void;
}) {
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
      setError(err instanceof Error ? err.message : "Übernehmen fehlgeschlagen");
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
      setError(err instanceof Error ? err.message : "Verwerfen fehlgeschlagen");
      setIsSaving(false);
    }
  }

  return (
    <Card className="suggestion-card">
      <div className="suggestion-card__header">
        <span>Dokument #{suggestion.documentId}</span>
        <ConfidenceBadge confidence={suggestion.confidence} />
      </div>

      <Field label="Titel">
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>

      <Field label="Korrespondent">
        <input value={correspondent} onChange={(e) => setCorrespondent(e.target.value)} />
      </Field>

      <Field label="Dokumenttyp">
        <input value={documentType} onChange={(e) => setDocumentType(e.target.value)} />
      </Field>

      <Field label="Tags (kommagetrennt)">
        <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
      </Field>

      {(suggestion.date || suggestion.amount) && (
        <p className="suggestion-card__meta">
          {suggestion.date && `Datum: ${suggestion.date}`}
          {suggestion.date && suggestion.amount && " · "}
          {suggestion.amount && `Betrag: ${suggestion.amount.toFixed(2)} €`}
        </p>
      )}

      <div className="suggestion-card__actions">
        <Button onClick={handleApply} disabled={isSaving}>
          Übernehmen
        </Button>
        <Button variant="secondary" onClick={handleDismiss} disabled={isSaving}>
          Verwerfen
        </Button>
      </div>

      {error && <ErrorState message={error} />}
    </Card>
  );
}

export function ReviewInbox({ aiEnabled }: { aiEnabled: boolean }) {
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
        title="KI-Erkennung ist deaktiviert"
        description={
          <>
            Zum Aktivieren <code>AI_PROVIDER</code> und <code>AI_API_KEY</code> im Backend setzen
            (siehe <code>.env.example</code>). Dieses Feature ist optional – Paperless funktioniert
            ohne es genauso gut.
          </>
        }
      />
    );
  }

  if (error) return <ErrorState message={error} onRetry={reload} />;

  if (suggestions.length === 0) {
    return (
      <EmptyState
        title="Keine offenen Vorschläge"
        description="Öffne ein Dokument und klicke auf „KI-Vorschlag anfragen“."
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
