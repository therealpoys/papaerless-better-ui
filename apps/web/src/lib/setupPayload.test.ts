import { describe, expect, it } from "vitest";
import { buildSetupPayload, parseSetupPayload } from "./setupPayload";
import { getStoredToken, resolveToken, saveToken } from "./serverToken";

const TOKEN = "abc123_-.~TOKEN+/=";

describe("setupPayload", () => {
  it("Roundtrip: gültiger Code wird gelesen", () => {
    const raw = buildSetupPayload("https://docs.example.de/", TOKEN);
    expect(raw.startsWith("papaerless://setup?v=1&")).toBe(true);
    expect(parseSetupPayload(raw)).toEqual({ ok: true, payload: { url: "https://docs.example.de", token: TOKEN } });
  });

  it("build lehnt ungültige URL und Token ab", () => {
    expect(() => buildSetupPayload("ftp://x", TOKEN)).toThrow();
    expect(() => buildSetupPayload("https://a.de", "")).toThrow();
    expect(() => buildSetupPayload("https://a.de", "mit leerzeichen")).toThrow();
  });

  it("lehnt falsche Version ab", () => {
    expect(parseSetupPayload("papaerless://setup?v=2&url=https%3A%2F%2Fa.de&token=t")).toEqual({
      ok: false,
      error: "unsupportedVersion",
    });
    expect(parseSetupPayload("papaerless://setup?url=https%3A%2F%2Fa.de&token=t")).toEqual({ ok: false, error: "invalid" });
  });

  it("lehnt fremde Schemata und beliebigen Text ab", () => {
    for (const raw of [
      "https://evil.example/setup?v=1&url=https%3A%2F%2Fa.de&token=t",
      "javascript:alert(1)",
      "otpauth://totp/x?secret=abc",
      "hallo",
      "",
      "WIFI:T:WPA;S:x;P:y;;",
    ]) {
      expect(parseSetupPayload(raw)).toEqual({ ok: false, error: "notSetupCode" });
    }
  });

  it("lehnt manipulierte Payloads ab", () => {
    const bad = [
      "papaerless://setup?v=1&url=javascript%3Aalert(1)&token=t",
      "papaerless://setup?v=1&url=ftp%3A%2F%2Fa.de&token=t",
      "papaerless://setup?v=1&url=evil.com&token=t",
      "papaerless://setup?v=1&url=https%3A%2F%2Fu%3Ap%40a.de&token=t",
      "papaerless://setup?v=1&url=https%3A%2F%2Fa.de",
      "papaerless://setup?v=1&url=https%3A%2F%2Fa.de&token=",
      "papaerless://setup?v=1&url=https%3A%2F%2Fa.de&token=a%20b",
      "papaerless://setup?v=1&url=https%3A%2F%2Fa.de&url=https%3A%2F%2Fb.de&token=t",
      "papaerless://setup?v=1&url=https%3A%2F%2Fa.de&token=t&extra=1",
      "papaerless://other?v=1&url=https%3A%2F%2Fa.de&token=t",
      "papaerless://setup/x?v=1&url=https%3A%2F%2Fa.de&token=t",
      `papaerless://setup?v=1&url=https%3A%2F%2Fa.de&token=${"a".repeat(600)}`,
    ];
    for (const raw of bad) expect(parseSetupPayload(raw).ok, raw).toBe(false);
  });
});

describe("serverToken", () => {
  it("speichert und bevorzugt gespeichertes Token", () => {
    const data: Record<string, string> = {};
    const storage = {
      getItem: (k: string) => data[k] ?? null,
      setItem: (k: string, v: string) => void (data[k] = v),
      removeItem: (k: string) => void delete data[k],
    };
    expect(getStoredToken(storage)).toBeNull();
    expect(saveToken("x", storage)).toBe(true);
    expect(getStoredToken(storage)).toBe("x");
    expect(resolveToken("x", "env")).toBe("x");
    expect(resolveToken(null, "env")).toBe("env");
    expect(resolveToken(null, undefined)).toBeUndefined();
  });
});
