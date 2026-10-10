import { describe, expect, it, vi } from "vitest";
import { applyScannedSetup } from "./qrSetup";
import { buildSetupPayload } from "./setupPayload";

const code = buildSetupPayload("https://docs.example.de", "geheim");
const res = (status: number) => ({ ok: status >= 200 && status < 300, status }) as Response;

describe("applyScannedSetup", () => {
  it("testet mit Token und speichert bei Erfolg", async () => {
    const fetchFn = vi.fn().mockResolvedValue(res(200));
    const u = vi.fn(() => true);
    const t = vi.fn(() => true);
    expect(await applyScannedSetup(code, fetchFn, u, t)).toBe("ok");
    expect(fetchFn).toHaveBeenCalledWith("https://docs.example.de/api/ai/status", {
      headers: { Authorization: "Bearer geheim" },
    });
    expect(u).toHaveBeenCalledWith("https://docs.example.de");
    expect(t).toHaveBeenCalledWith("geheim");
  });

  it("speichert nichts bei falschem Token", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(res(200)).mockResolvedValueOnce(res(401));
    const u = vi.fn(() => true);
    const t = vi.fn(() => true);
    expect(await applyScannedSetup(code, fetchFn, u, t)).toBe("unauthorized");
    expect(u).not.toHaveBeenCalled();
    expect(t).not.toHaveBeenCalled();
  });

  it("meldet unerreichbaren Server und ungültigen Code ohne Netzwerkzugriff", async () => {
    expect(await applyScannedSetup(code, vi.fn().mockRejectedValue(new Error("x")), vi.fn(), vi.fn())).toBe("unreachable");
    const fetchFn = vi.fn();
    expect(await applyScannedSetup("https://evil.de", fetchFn)).toBe("notSetupCode");
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
