interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

/** Für Fehler wie "Upload fehlgeschlagen" / "Paperless nicht erreichbar" – zeigt die
 * Ursache und bietet, wenn möglich, direkt einen Retry statt einer Sackgasse.
 * retryLabel ist überschreibbar statt fest verdrahtet, weil diese Komponente
 * keine eigene i18n-Anbindung hat – Aufrufer übersetzen selbst. */
export function ErrorState({ message, onRetry, retryLabel = "Erneut versuchen" }: ErrorStateProps) {
  return (
    <div className="ui-error-state" role="alert">
      <p className="ui-error-state__message">{message}</p>
      {onRetry && (
        <button type="button" className="ui-button ui-button--secondary" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}
