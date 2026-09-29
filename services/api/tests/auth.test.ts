import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({ apiAuthToken: undefined as string | undefined }));
vi.mock("../src/env.js", () => ({ env: mockEnv }));

import { registerAuth } from "../src/auth.js";

async function buildApp() {
  const app = Fastify();
  await registerAuth(app);
  app.get("/health", async () => ({ status: "ok" }));
  app.get("/api/ping", async () => ({ pong: true }));
  await app.ready();
  return app;
}

describe("registerAuth", () => {
  beforeEach(() => {
    mockEnv.apiAuthToken = undefined;
  });

  it("lässt alles durch, wenn kein Token konfiguriert ist", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/ping" });
    expect(res.statusCode).toBe(200);
  });

  it("verlangt bei gesetztem Token einen Bearer-Header für /api/*", async () => {
    mockEnv.apiAuthToken = "secret";
    const app = await buildApp();

    expect((await app.inject({ method: "GET", url: "/api/ping" })).statusCode).toBe(401);
    expect(
      (await app.inject({ method: "GET", url: "/api/ping", headers: { authorization: "Bearer wrong" } }))
        .statusCode,
    ).toBe(401);
    expect(
      (await app.inject({ method: "GET", url: "/api/ping", headers: { authorization: "secret" } }))
        .statusCode,
    ).toBe(401);

    const ok = await app.inject({
      method: "GET",
      url: "/api/ping",
      headers: { authorization: "Bearer secret" },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ pong: true });
  });

  it("lässt /health immer offen", async () => {
    mockEnv.apiAuthToken = "secret";
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
  });
});
