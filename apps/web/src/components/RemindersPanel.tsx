import { useEffect, useState } from "react";
import type { Reminder } from "@papaerless/shared-types";
import { api } from "../lib/api";

const KIND_LABEL: Record<Reminder["kind"], string> = {
  due_date: "Fälligkeit",
  cancellation_deadline: "Kündigungsfrist",
};

export function RemindersPanel() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    api.listReminders().then(setReminders).catch((err) => setError(err.message));
  }

  useEffect(reload, []);

  async function handleDismiss(id: string) {
    await api.dismissReminder(id);
    reload();
  }

  if (error) return <p className="error">{error}</p>;

  if (reminders.length === 0) {
    return (
      <p className="empty-state">
        Keine Erinnerungen. Lege im Dokument-Detail eine Erinnerung an (z.B. für
        Vertragskündigungen oder Zahlungsfristen).
      </p>
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
                {r.note && ` · ${r.note}`}
              </div>
            </div>
            <button type="button" className="secondary" onClick={() => handleDismiss(r.id)}>
              Erledigt
            </button>
          </li>
        );
      })}
    </ul>
  );
}
