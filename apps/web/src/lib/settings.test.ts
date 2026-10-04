import { describe, expect, it, vi } from "vitest";
import { saveAutoSuggest } from "./settings";

describe("saveAutoSuggest", () => {
  it("übernimmt den vom Server bestätigten Wert", async () => {
    const api = { updateSettings: vi.fn().mockResolvedValue({ autoSuggest: true }) };
    await expect(saveAutoSuggest(api, false, true)).resolves.toEqual({ value: true, failed: false });
    expect(api.updateSettings).toHaveBeenCalledWith({ autoSuggest: true });
  });

  it("behält bei einem Fehler den alten Wert und meldet failed", async () => {
    const api = { updateSettings: vi.fn().mockRejectedValue(new Error("boom")) };
    await expect(saveAutoSuggest(api, false, true)).resolves.toEqual({ value: false, failed: true });
  });
});
