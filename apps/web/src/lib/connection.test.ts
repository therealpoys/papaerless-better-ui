import { describe, expect, it, vi } from "vitest";
import { checkConnection } from "./connection";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe("checkConnection", () => {
  it("ok, wenn Backend und Paperless antworten (und sendet die Auth-Header)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(200, { backend: "ok", paperless: "ok" }));
    await expect(checkConnection("https://x", fetchFn, { Authorization: "Bearer t" })).resolves.toBe("ok");
    expect(fetchFn).toHaveBeenCalledWith("https://x/api/status", { headers: { Authorization: "Bearer t" } });
  });

  it("serverUnreachable bei Netzwerkfehler", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("fail"));
    await expect(checkConnection("https://x", fetchFn)).resolves.toBe("serverUnreachable");
  });

  it("unauthorized bei 401 und 403", async () => {
    await expect(checkConnection("https://x", async () => json(401, {}))).resolves.toBe("unauthorized");
    await expect(checkConnection("https://x", async () => json(403, {}))).resolves.toBe("unauthorized");
  });

  it("paperlessUnreachable, wenn nur Paperless fehlt", async () => {
    const fetchFn = async () => json(200, { backend: "ok", paperless: "unreachable" });
    await expect(checkConnection("https://x", fetchFn)).resolves.toBe("paperlessUnreachable");
  });

  it("notServer bei 404, 5xx oder fremder Antwort", async () => {
    await expect(checkConnection("https://x", async () => json(404, {}))).resolves.toBe("notServer");
    await expect(checkConnection("https://x", async () => json(500, {}))).resolves.toBe("notServer");
    await expect(checkConnection("https://x", async () => new Response("<html>", { status: 200 }))).resolves.toBe("notServer");
    await expect(checkConnection("https://x", async () => json(200, { hello: 1 }))).resolves.toBe("notServer");
  });
});
