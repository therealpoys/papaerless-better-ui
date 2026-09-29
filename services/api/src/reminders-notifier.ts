import { broadcastPush } from "./push-sender.js";
import { remindersStore } from "./reminders-store.js";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // stündlich
const NOTIFY_WINDOW_DAYS = 3;

async function checkDueReminders(): Promise<void> {
  const reminders = await remindersStore.list();
  const now = Date.now();
  const windowMs = NOTIFY_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  for (const reminder of reminders) {
    if (reminder.notifiedAt) continue;
    const dueAt = new Date(reminder.dueDate).getTime();
    if (Number.isNaN(dueAt) || dueAt - now > windowMs) continue;

    await broadcastPush({
      title: reminder.kind === "cancellation_deadline" ? "Kündigungsfrist läuft ab" : "Fälligkeit erinnert",
      body: `${reminder.documentTitle}: fällig am ${reminder.dueDate}`,
      data: { documentId: reminder.documentId, reminderId: reminder.id },
    });

    await remindersStore.markNotified(reminder.id, new Date().toISOString());
  }
}

/** Startet den periodischen Check und gibt eine Funktion zum Stoppen zurück (Graceful Shutdown). */
export function startRemindersNotifier(): () => void {
  checkDueReminders().catch((err) => console.error("Reminder-Check fehlgeschlagen:", err));
  const timer = setInterval(() => {
    checkDueReminders().catch((err) => console.error("Reminder-Check fehlgeschlagen:", err));
  }, CHECK_INTERVAL_MS);
  return () => clearInterval(timer);
}
