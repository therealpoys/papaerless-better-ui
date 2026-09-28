import { readJsonFile, writeJsonFile } from "./json-store.js";

export interface WebSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface StoredSubscription {
  id: string;
  kind: "web" | "expo";
  createdAt: string;
  endpoint?: string; // web: push endpoint URL
  keys?: WebSubscriptionKeys; // web
  expoToken?: string; // expo
}

const FILE = "push-subscriptions.json";

async function load(): Promise<StoredSubscription[]> {
  return readJsonFile<StoredSubscription[]>(FILE, []);
}

export const pushStore = {
  async list(): Promise<StoredSubscription[]> {
    return load();
  },

  async add(subscription: StoredSubscription): Promise<StoredSubscription> {
    const subscriptions = await load();
    const withoutDuplicate = subscriptions.filter(
      (s) => s.endpoint !== subscription.endpoint || s.expoToken !== subscription.expoToken,
    );
    withoutDuplicate.push(subscription);
    await writeJsonFile(FILE, withoutDuplicate);
    return subscription;
  },

  async remove(id: string): Promise<void> {
    const subscriptions = await load();
    await writeJsonFile(FILE, subscriptions.filter((s) => s.id !== id));
  },
};
