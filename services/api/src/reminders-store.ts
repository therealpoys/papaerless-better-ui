import type { Reminder } from "@papaerless/shared-types";
import { readJsonFile, writeJsonFile } from "./json-store.js";

const FILE = "reminders.json";

async function load(): Promise<Reminder[]> {
  return readJsonFile<Reminder[]>(FILE, []);
}

export const remindersStore = {
  async list(): Promise<Reminder[]> {
    const reminders = await load();
    return reminders.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  },

  async add(reminder: Reminder): Promise<Reminder> {
    const reminders = await load();
    reminders.push(reminder);
    await writeJsonFile(FILE, reminders);
    return reminder;
  },

  async remove(id: string): Promise<void> {
    const reminders = await load();
    await writeJsonFile(FILE, reminders.filter((r) => r.id !== id));
  },

  async markNotified(id: string, notifiedAt: string): Promise<void> {
    const reminders = await load();
    const updated = reminders.map((r) => (r.id === id ? { ...r, notifiedAt } : r));
    await writeJsonFile(FILE, updated);
  },
};
