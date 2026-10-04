import type { MetadataSuggestion } from "@papaerless/shared-types";
import { classifier } from "./ai.js";
import { aiStore } from "./ai-store.js";
import { paperless } from "./paperless.js";
import { broadcastPush } from "./push-sender.js";
import { settingsStore } from "./settings-store.js";

const POLL_INTERVAL_MS = 30 * 1000;
const PAGE_SIZE = 25;

/** Laufende Erzeugungen je Dokument: verhindert doppelte (teure) KI-Läufe, egal ob manuell oder automatisch. */
const inFlight = new Map<number, Promise<MetadataSuggestion>>();

/** Läuft für dieses Dokument gerade eine KI-Erzeugung? */
export function isSuggesting(documentId: number): boolean {
  return inFlight.has(documentId);
}

/** Liefert den gecachten Vorschlag oder erzeugt ihn (pro Dokument höchstens einmal gleichzeitig). */
export function suggestFor(documentId: number): Promise<MetadataSuggestion> {
  const running = inFlight.get(documentId);
  if (running) return running;
  const job = generate(documentId).finally(() => inFlight.delete(documentId));
  inFlight.set(documentId, job);
  return job;
}

async function generate(documentId: number): Promise<MetadataSuggestion> {
  if (!classifier) throw new Error("KI-Erkennung ist deaktiviert");

  const cached = await aiStore.get(documentId);
  if (cached) return cached;

  const [doc, tags, correspondents, documentTypes] = await Promise.all([
    paperless.getDocument(documentId),
    paperless.listTags(),
    paperless.listCorrespondents(),
    paperless.listDocumentTypes(),
  ]);

  const suggestion = await classifier.classify({
    documentId,
    title: doc.title,
    content: doc.content,
    knownTags: tags,
    knownCorrespondents: correspondents,
    knownDocumentTypes: documentTypes,
  });

  await aiStore.set(suggestion);

  // Push darf nichts blockieren/kippen, falls z.B. ein Abo abgelaufen ist
  broadcastPush({
    title: "Neuer KI-Vorschlag",
    body: `${doc.title}: KI-Vorschlag verfügbar`,
    data: { documentId },
  }).catch((err) => console.error("Push für KI-Vorschlag fehlgeschlagen:", err));

  return suggestion;
}

async function newestDocuments() {
  return (await paperless.listDocuments({ pageSize: PAGE_SIZE, sort: "added", sortOrder: "desc" })).results;
}

/** Merkt sich die aktuell höchste Dokument-ID als Startpunkt: ältere Dokumente werden nie automatisch bearbeitet. */
export async function initAutoSuggestBaseline(): Promise<void> {
  const docs = await newestDocuments();
  const maxId = docs.reduce((max, d) => Math.max(max, d.id), 0);
  await settingsStore.update({ autoSuggestAfterId: maxId });
}

let cycleRunning = false;

/** Ein Durchlauf: neue Dokumente (id > Baseline) nacheinander bearbeiten. Liefert die Zahl erzeugter Vorschläge. */
export async function runAutoSuggestCycle(): Promise<number> {
  if (cycleRunning || !classifier) return 0;
  const settings = await settingsStore.get();
  if (!settings.autoSuggest) return 0;
  cycleRunning = true;
  try {
    if (settings.autoSuggestAfterId === null) {
      await initAutoSuggestBaseline();
      return 0;
    }
    const fresh = (await newestDocuments())
      .filter((d) => d.id > settings.autoSuggestAfterId!)
      .sort((a, b) => a.id - b.id);

    let created = 0;
    for (const doc of fresh) {
      // Abschalten mitten im Lauf respektieren
      if (!(await settingsStore.get()).autoSuggest) break;
      try {
        if (!(await aiStore.get(doc.id))) {
          await suggestFor(doc.id);
          created += 1;
        }
      } catch (err) {
        // Nicht endlos wiederholen; der Nutzer kann den Vorschlag weiterhin manuell anfordern.
        console.error(`Auto-Vorschlag für Dokument ${doc.id} fehlgeschlagen:`, err);
      }
      await settingsStore.update({ autoSuggestAfterId: doc.id });
    }
    return created;
  } finally {
    cycleRunning = false;
  }
}

/** Startet das periodische Polling; gibt eine Stop-Funktion zurück (Graceful Shutdown). */
export function startAutoSuggest(): () => void {
  const tick = () =>
    runAutoSuggestCycle().catch((err) => console.error("Auto-Vorschlag-Lauf fehlgeschlagen:", err));
  const timer = setInterval(tick, POLL_INTERVAL_MS);
  tick();
  return () => clearInterval(timer);
}
