import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Reminder } from "@papaerless/shared-types";
import { Button, EmptyState, ErrorState } from "@papaerless/ui";
import { api } from "../lib/api";

export function RemindersPanel() {
  const { t } = useTranslation();
  const KIND_LABEL: Record<Reminder["kind"], string> = {
    due_date: t("remindersPanel.kind.due_date"),
    cancellation_deadline: t("remindersPanel.kind.cancellation_deadline"),
  };
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

  if (error) return <ErrorState message={error} onRetry={reload} retryLabel={t("common.retry")} />;

  if (reminders.length === 0) {
    return (
      <EmptyState
        title={t("remindersPanel.empty.title")}
        description={t("remindersPanel.empty.description")}
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
                {KIND_LABEL[r.kind]} · {t("remindersPanel.due")} {new Date(r.dueDate).toLocaleDateString("de-DE")}
                {isOverdue && ` · ${t("remindersPanel.overdue")}`}
                {r.note && ` · ${r.note}`}
              </div>
            </div>
            <Button variant="secondary" onClick={() => handleDismiss(r.id)}>
              {t("remindersPanel.done")}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
