interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

/** Für Fehler wie "Upload fehlgeschlagen" / "Paperless nicht erreichbar" – zeigt die
 * Ursache und bietet, wenn möglich, direkt einen Retry statt einer Sackgasse. */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="ui-error-state" role="alert">
      <p className="ui-error-state__message">{message}</p>
      {onRetry && (
        <button type="button" className="ui-button ui-button--secondary" onClick={onRetry}>
          Erneut versuchen
        </button>
      )}
    </div>
  );
}
