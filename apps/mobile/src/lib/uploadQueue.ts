import AsyncStorage from "@react-native-async-storage/async-storage";
import type { UploadJob } from "@papaerless/shared-types";
import { api } from "./api";

export interface QueuedUpload extends UploadJob {
  fileUri: string;
}

const STORAGE_KEY = "papaerless:upload-queue";

let queue: QueuedUpload[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

async function persist() {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

async function ensureLoaded() {
  if (loaded) return;
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  queue = raw ? (JSON.parse(raw) as QueuedUpload[]) : [];
  loaded = true;
  notify();
}

function updateJob(id: string, patch: Partial<QueuedUpload>) {
  queue = queue.map((job) => (job.id === id ? { ...job, ...patch } : job));
  notify();
  persist().catch((err) => console.warn("upload-queue: persist fehlgeschlagen", err));
}

async function uploadOne(job: QueuedUpload): Promise<void> {
  updateJob(job.id, { status: "uploading", error: undefined });
  try {
    await api.uploadDocument(job.fileUri, job.fileName);
    // Paperless verarbeitet (OCR) den Upload asynchron – aus Sicht der App ist der
    // Job jetzt "processing", bis er in der Review-Inbox/Dokumentliste auftaucht.
    updateJob(job.id, { status: "processing" });
  } catch (err) {
    updateJob(job.id, {
      status: "failed",
      error: err instanceof Error ? err.message : "Upload fehlgeschlagen",
    });
    throw err;
  }
}

export const uploadQueue = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    ensureLoaded();
    return () => listeners.delete(listener);
  },

  getSnapshot(): QueuedUpload[] {
    return queue;
  },

  async enqueue(fileUri: string, fileName: string): Promise<QueuedUpload> {
    await ensureLoaded();
    const job: QueuedUpload = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fileName,
      fileUri,
      status: "uploading",
    };
    queue = [...queue, job];
    notify();
    await persist();

    // Offline-fähig: schlägt der Upload jetzt fehl (kein Netz), bleibt der Job
    // in der Queue und kann später über retryFailed() erneut versucht werden.
    uploadOne(job).catch(() => undefined);

    return job;
  },

  async retryFailed(): Promise<void> {
    await ensureLoaded();
    const failed = queue.filter((job) => job.status === "failed");
    for (const job of failed) {
      await uploadOne(job).catch(() => undefined);
    }
  },

  async remove(id: string): Promise<void> {
    await ensureLoaded();
    queue = queue.filter((job) => job.id !== id);
    notify();
    await persist();
  },
};
