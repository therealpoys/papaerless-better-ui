import { describe, expect, it, vi } from "vitest";
import { waitForDocumentId } from "./upload";

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
