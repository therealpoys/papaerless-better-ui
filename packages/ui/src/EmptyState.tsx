import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

/** Für Zustände wie "keine Dokumente" / "keine Treffer" / "leere Inbox" – erklärt den
 * Grund und bietet wo möglich direkt eine Handlung an, statt nur "nichts da" zu zeigen. */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="ui-empty-state" role="status">
      <p className="ui-empty-state__title">{title}</p>
      {description && <p className="ui-empty-state__description">{description}</p>}
      {action && <div className="ui-empty-state__action">{action}</div>}
    </div>
  );
}
