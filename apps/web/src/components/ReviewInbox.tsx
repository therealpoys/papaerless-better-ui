import { useEffect, useState } from "react";
import type { MetadataSuggestion } from "@papaerless/shared-types";
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
    <div className="suggestion-card">
      <div className="suggestion-card__header">
        <span>Dokument #{suggestion.documentId}</span>
        <span className="suggestion-card__confidence">
          Konfidenz: {Math.round(suggestion.confidence * 100)}%
        </span>
      </div>

      <label className="field">
        <span>Titel</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>

      <label className="field">
        <span>Korrespondent</span>
        <input value={correspondent} onChange={(e) => setCorrespondent(e.target.value)} />
      </label>

      <label className="field">
        <span>Dokumenttyp</span>
        <input value={documentType} onChange={(e) => setDocumentType(e.target.value)} />
      </label>

      <label className="field">
        <span>Tags (kommagetrennt)</span>
        <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
      </label>

      {(suggestion.date || suggestion.amount) && (
        <p className="suggestion-card__meta">
          {suggestion.date && `Datum: ${suggestion.date}`}
          {suggestion.date && suggestion.amount && " · "}
          {suggestion.amount && `Betrag: ${suggestion.amount.toFixed(2)} €`}
        </p>
      )}

      <div className="suggestion-card__actions">
        <button type="button" onClick={handleApply} disabled={isSaving}>
          Übernehmen
        </button>
        <button type="button" className="secondary" onClick={handleDismiss} disabled={isSaving}>
          Verwerfen
        </button>
      </div>

      {error && <p className="error">{error}</p>}
    </div>
  );
}

export function ReviewInbox({ aiEnabled }: { aiEnabled: boolean }) {
  const [suggestions, setSuggestions] = useState<MetadataSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    api.listSuggestions().then(setSuggestions).catch((err) => setError(err.message));
  }

  useEffect(reload, []);

  if (!aiEnabled) {
    return (
      <p className="empty-state">
        KI-Erkennung ist deaktiviert. Zum Aktivieren <code>AI_PROVIDER</code> und{" "}
        <code>AI_API_KEY</code> im Backend setzen (siehe <code>.env.example</code>). Dieses
        Feature ist optional – Paperless funktioniert ohne es genauso gut.
      </p>
    );
  }

  if (error) return <p className="error">{error}</p>;

  if (suggestions.length === 0) {
    return (
      <p className="empty-state">
        Keine offenen Vorschläge. Öffne ein Dokument und klicke auf „KI-Vorschlag anfragen“.
      </p>
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
