import { describe, expect, it, vi } from "vitest";
import { computeUploadProgress, formatElapsed, mergeUploadItems, remainingTimeParts, waitForDocumentId } from "./upload";

const fast = { intervalMs: 0 };

describe("waitForDocumentId", () => {
  it("wartet, bis der Vorgang fertig ist, und liefert die Dokument-ID", async () => {
    const getTask = vi
      .fn()
      .mockResolvedValueOnce({ status: "PENDING" })
      .mockResolvedValueOnce({ status: "STARTED" })
      .mockResolvedValueOnce({ status: "SUCCESS", documentId: 7 });

    await expect(waitForDocumentId(getTask, "t1", fast)).resolves.toBe(7);
    expect(getTask).toHaveBeenCalledTimes(3);
    expect(getTask).toHaveBeenCalledWith("t1");
  });

  it("gibt bei FAILURE sofort null zurück", async () => {
    const getTask = vi.fn().mockResolvedValue({ status: "FAILURE" });

    await expect(waitForDocumentId(getTask, "t", fast)).resolves.toBeNull();
    expect(getTask).toHaveBeenCalledTimes(1);
  });

  it("gibt nach zu vielen Versuchen null zurück", async () => {
    const getTask = vi.fn().mockResolvedValue({ status: "STARTED" });

    await expect(waitForDocumentId(getTask, "t", { attempts: 3, intervalMs: 0 })).resolves.toBeNull();
    expect(getTask).toHaveBeenCalledTimes(3);
  });

  it("reicht Fehler beim Abfragen weiter, damit der Aufrufer sie abfangen kann", async () => {
    const getTask = vi.fn().mockRejectedValue(new Error("offline"));

    await expect(waitForDocumentId(getTask, "t", fast)).rejects.toThrow("offline");
  });
});

describe("computeUploadProgress", () => {
  it("berechnet Prozent und Restzeit aus dem Durchsatz", () => {
    // 25 MB von 100 MB in 5 s -> 5 MB/s -> 15 s Rest
    expect(computeUploadProgress(25e6, 100e6, 5000)).toEqual({ percent: 25, remainingSeconds: 15 });
  });

  it("rundet Prozent ab und Restzeit auf", () => {
    expect(computeUploadProgress(1, 3, 1000)).toEqual({ percent: 33, remainingSeconds: 2 });
  });

  it("liefert zu Beginn keine Restzeit", () => {
    expect(computeUploadProgress(0, 1000, 2000)).toEqual({ percent: 0, remainingSeconds: null });
    expect(computeUploadProgress(100, 1000, 100)).toEqual({ percent: 10, remainingSeconds: null });
  });

  it("meldet 100 % und 0 s, wenn alles übertragen ist", () => {
    expect(computeUploadProgress(1000, 1000, 3000)).toEqual({ percent: 100, remainingSeconds: 0 });
    expect(computeUploadProgress(2000, 1000, 3000).percent).toBe(100);
  });

  it("verträgt Gesamtgröße 0", () => {
    expect(computeUploadProgress(0, 0, 1000)).toEqual({ percent: 0, remainingSeconds: null });
  });
});

describe("remainingTimeParts", () => {
  it("zeigt Sekunden unter einer Minute, mindestens 1", () => {
    expect(remainingTimeParts(12)).toEqual({ unit: "seconds", value: 12 });
    expect(remainingTimeParts(0.2)).toEqual({ unit: "seconds", value: 1 });
    expect(remainingTimeParts(59)).toEqual({ unit: "seconds", value: 59 });
  });

  it("zeigt ab 60 s aufgerundete Minuten", () => {
    expect(remainingTimeParts(60)).toEqual({ unit: "minutes", value: 1 });
    expect(remainingTimeParts(61)).toEqual({ unit: "minutes", value: 2 });
    expect(remainingTimeParts(150)).toEqual({ unit: "minutes", value: 3 });
  });
});

describe("formatElapsed", () => {
  it("formatiert als m:ss", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(9_400)).toBe("0:09");
    expect(formatElapsed(135_000)).toBe("2:15");
    expect(formatElapsed(-5)).toBe("0:00");
  });
});

describe("mergeUploadItems", () => {
  it("beginnt eine neue Liste, wenn alles fertig ist", () => {
    const merged = mergeUploadItems([{ status: "done" }, { status: "error" }], [{ status: "waiting" }]);
    expect(merged).toEqual([{ status: "waiting" }]);
  });

  it("zählt übersprungene Dateien als abgeschlossen", () => {
    expect(mergeUploadItems([{ status: "skipped" }], [{ status: "waiting" }])).toEqual([{ status: "waiting" }]);
  });

  it("hängt neue Dateien an, solange noch hochgeladen wird", () => {
    const merged = mergeUploadItems([{ status: "uploading" }, { status: "waiting" }], [{ status: "waiting" }]);
    expect(merged).toHaveLength(3);
  });
});
