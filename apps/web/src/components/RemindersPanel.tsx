import { useEffect, useState } from "react";
import type { Reminder } from "@papaerless/shared-types";
import { Button, EmptyState, ErrorState } from "@papaerless/ui";
import { api } from "../lib/api";

const KIND_LABEL: Record<Reminder["kind"], string> = {
  due_date: "Fälligkeit",
  cancellation_deadline: "Kündigungsfrist",
};

export function RemindersPanel() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    setError(null);
    api.listReminders().then(setReminders).catch((err) => setError(err.message));
  }

  useEffect(reload, []);

  async function handleDismiss(id: string) {
    await api.dismissReminder(id);
    reload();
  }

  if (error) return <ErrorState message={error} onRetry={reload} />;

  if (reminders.length === 0) {
    return (
      <EmptyState
        title="Keine Erinnerungen"
        description="Lege im Dokument-Detail eine Erinnerung an (z.B. für Vertragskündigungen oder Zahlungsfristen)."
      />
    );
  }

  return (
    <ul className="reminder-list">
      {reminders.map((r) => {
        const isOverdue = new Date(r.dueDate) < new Date();
        return (
          <li key={r.id} className={`reminder-list__item ${isOverdue ? "reminder-list__item--overdue" : ""}`}>
            <div>
              <strong>{r.documentTitle}</strong>
              <div className="reminder-list__meta">
                {KIND_LABEL[r.kind]} · fällig {new Date(r.dueDate).toLocaleDateString("de-DE")}
                {isOverdue && " · überfällig"}
                {r.note && ` · ${r.note}`}
              </div>
            </div>
            <Button variant="secondary" onClick={() => handleDismiss(r.id)}>
              Erledigt
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
