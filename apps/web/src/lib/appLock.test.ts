import { describe, expect, it, vi } from "vitest";
import { BiometryErrorType } from "@aparajita/capacitor-biometric-auth";
import {
  DEFAULT_TIMEOUT_MS,
  LockController,
  disableLock,
  enableLock,
  initialLockState,
  loadLockSettings,
  onAuthResult,
  onBackground,
  onForeground,
  onSettingsChanged,
  saveLockTimeout,
  type AuthResult,
  type LockGate,
  type LockState,
} from "./appLock";
import { createGate, mapBiometryError } from "./biometric";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => void (data[k] = v),
    removeItem: (k: string) => void delete data[k],
    data,
  };
}

function fakeGate(results: Array<AuthResult | Error>, available: boolean | Error = true) {
  const queue = [...results];
  const gate: LockGate & { authenticate: ReturnType<typeof vi.fn> } = {
    isAvailable: async () => {
      if (available instanceof Error) throw available;
      return available;
    },
    authenticate: vi.fn(async () => {
      const next = queue.shift() ?? { status: "success" as const };
      if (next instanceof Error) throw next;
      return next;
    }),
  };
  return gate;
}

const enabled = { enabled: true, timeoutMs: 60_000 };

describe("Einstellungen", () => {
  it("Standard: aus, 1 Minute", () => {
    expect(loadLockSettings(memoryStorage())).toEqual({ enabled: false, timeoutMs: DEFAULT_TIMEOUT_MS });
    expect(DEFAULT_TIMEOUT_MS).toBe(60_000);
  });

  it("liest gespeicherte Werte und ignoriert ungültige Auszeiten", () => {
    expect(loadLockSettings(memoryStorage({ "appLock.enabled": "true", "appLock.timeoutMs": "300000" }))).toEqual({
      enabled: true,
      timeoutMs: 300_000,
    });
    expect(loadLockSettings(memoryStorage({ "appLock.timeoutMs": "12345" })).timeoutMs).toBe(DEFAULT_TIMEOUT_MS);
    expect(loadLockSettings(memoryStorage({ "appLock.timeoutMs": "abc" })).timeoutMs).toBe(DEFAULT_TIMEOUT_MS);
    expect(loadLockSettings(memoryStorage({ "appLock.timeoutMs": "0" })).timeoutMs).toBe(0);
  });

  it("Speicherfehler führen zu 'aus' statt zu Fehlern", () => {
    const broken = {
      getItem: () => {
        throw new Error("x");
      },
      setItem: () => {
        throw new Error("x");
      },
      removeItem: () => {
        throw new Error("x");
      },
    };
    expect(loadLockSettings(broken).enabled).toBe(false);
    expect(() => saveLockTimeout(broken, 0)).not.toThrow();
    expect(() => disableLock(broken)).not.toThrow();
  });

  it("speichert Auszeit und schaltet aus", () => {
    const s = memoryStorage({ "appLock.enabled": "true" });
    saveLockTimeout(s, 900_000);
    expect(loadLockSettings(s).timeoutMs).toBe(900_000);
    disableLock(s);
    expect(loadLockSettings(s).enabled).toBe(false);
  });
});

describe("enableLock", () => {
  it("aktiviert nur nach erfolgreicher Authentifizierung", async () => {
    const s = memoryStorage();
    expect(await enableLock(fakeGate([{ status: "success" }]), s, "r")).toBe("enabled");
    expect(s.data["appLock.enabled"]).toBe("true");
  });

  it.each(["cancelled", "failed", "lockout", "error"] as const)("bleibt aus bei %s", async (status) => {
    const s = memoryStorage();
    expect(await enableLock(fakeGate([{ status }]), s, "r")).toBe("denied");
    expect(s.data["appLock.enabled"]).toBeUndefined();
  });

  it("bleibt aus, wenn authenticate wirft", async () => {
    const s = memoryStorage();
    expect(await enableLock(fakeGate([new Error("boom")]), s, "r")).toBe("denied");
    expect(s.data["appLock.enabled"]).toBeUndefined();
  });

  it("meldet 'unavailable' ohne Dialog, wenn nichts verfügbar ist", async () => {
    const s = memoryStorage();
    const gate = fakeGate([], false);
    expect(await enableLock(gate, s, "r")).toBe("unavailable");
    expect(gate.authenticate).not.toHaveBeenCalled();
    expect(s.data["appLock.enabled"]).toBeUndefined();
  });

  it("meldet 'unavailable', wenn isAvailable wirft oder authenticate 'unavailable' liefert", async () => {
    expect(await enableLock(fakeGate([], new Error("x")), memoryStorage(), "r")).toBe("unavailable");
    expect(await enableLock(fakeGate([{ status: "unavailable" }]), memoryStorage(), "r")).toBe("unavailable");
  });

  it("meldet storageFailed, wenn das Speichern scheitert", async () => {
    const s = {
      ...memoryStorage(),
      setItem: () => {
        throw new Error("voll");
      },
    };
    expect(await enableLock(fakeGate([{ status: "success" }]), s, "r")).toBe("storageFailed");
  });
});

describe("Zustandsmaschine", () => {
  const start = () => initialLockState(enabled);

  it("ist beim Start gesperrt, wenn aktiviert, sonst nicht", () => {
    expect(start().locked).toBe(true);
    expect(initialLockState({ enabled: false, timeoutMs: 0 }).locked).toBe(false);
  });

  it("sperrt nach Auszeit, nicht davor", () => {
    let s: LockState = onAuthResult(start(), { status: "success" });
    s = onBackground(s, 1000);
    expect(onForeground(s, 1000 + 59_999).locked).toBe(false);
    expect(onForeground(s, 1000 + 60_000).locked).toBe(true);
    expect(onForeground(s, 1000 + 10 * 60_000).locked).toBe(true);
  });

  it("Auszeit 0 sperrt sofort", () => {
    let s = onAuthResult(initialLockState({ enabled: true, timeoutMs: 0 }), { status: "success" });
    s = onBackground(s, 5);
    expect(onForeground(s, 5).locked).toBe(true);
  });

  it("sperrt bei zurückgestellter Uhr", () => {
    let s = onAuthResult(start(), { status: "success" });
    s = onBackground(s, 10_000);
    expect(onForeground(s, 5_000).locked).toBe(true);
  });

  it("erneutes Hintergrund-Ereignis überschreibt den Startzeitpunkt nicht", () => {
    let s = onAuthResult(start(), { status: "success" });
    s = onBackground(s, 1000);
    s = onBackground(s, 50_000);
    expect(s.backgroundedAt).toBe(1000);
  });

  it("ignoriert Vordergrund ohne vorheriges Hintergrund", () => {
    const s = onAuthResult(start(), { status: "success" });
    expect(onForeground(s, 999_999)).toBe(s);
  });

  it("ignoriert Hintergrund während des Auth-Dialogs und bei deaktivierter Sperre", () => {
    const authing = { ...start(), authenticating: true };
    expect(onBackground(authing, 1).backgroundedAt).toBeNull();
    const off = initialLockState({ enabled: false, timeoutMs: 0 });
    expect(onBackground(off, 1).backgroundedAt).toBeNull();
    expect(onForeground({ ...off, backgroundedAt: 1 }, 10).locked).toBe(false);
  });

  it("Erfolg entsperrt und setzt Zähler zurück", () => {
    let s = onAuthResult(start(), { status: "failed" });
    s = onAuthResult(s, { status: "failed" });
    expect(s.failedAttempts).toBe(2);
    s = onAuthResult(s, { status: "success" });
    expect(s).toMatchObject({ locked: false, failedAttempts: 0, lockedOut: false, lastResult: null });
  });

  it("Fehlversuche zählen, Abbruch und Fehler nicht; alles bleibt gesperrt", () => {
    let s = onAuthResult(start(), { status: "failed" });
    s = onAuthResult(s, { status: "cancelled" });
    s = onAuthResult(s, { status: "error" });
    expect(s.failedAttempts).toBe(1);
    expect(s.locked).toBe(true);
  });

  it("Lockout bleibt gesperrt und wird beim nächsten Versuch zurückgenommen", () => {
    let s = onAuthResult(start(), { status: "lockout" });
    expect(s).toMatchObject({ locked: true, lockedOut: true });
    s = onAuthResult(s, { status: "cancelled" });
    expect(s.lockedOut).toBe(false);
  });

  it("'unavailable' entsperrt: nie aussperren", () => {
    const s = onAuthResult(start(), { status: "unavailable" });
    expect(s.locked).toBe(false);
  });

  it("Abschalten entsperrt und räumt auf; Einschalten sperrt nicht sofort", () => {
    const locked = start();
    const off = onSettingsChanged(locked, { enabled: false, timeoutMs: 60_000 });
    expect(off).toMatchObject({ enabled: false, locked: false, backgroundedAt: null });
    const on = onSettingsChanged(off, { enabled: true, timeoutMs: 300_000 });
    expect(on).toMatchObject({ enabled: true, locked: false, timeoutMs: 300_000 });
  });

  it("neue Auszeit gilt für die nächste Rückkehr", () => {
    let s = onAuthResult(start(), { status: "success" });
    s = onSettingsChanged(s, { enabled: true, timeoutMs: 900_000 });
    s = onBackground(s, 0);
    expect(onForeground(s, 5 * 60_000).locked).toBe(false);
  });
});

describe("LockController", () => {
  function make(gate: LockGate, settings = enabled, startAt = 0) {
    const clock = { t: startAt };
    const c = new LockController(gate, settings, "Grund", () => clock.t);
    return { c, clock };
  }

  it("fragt beim Start und entsperrt bei Erfolg", async () => {
    const gate = fakeGate([{ status: "success" }]);
    const { c } = make(gate);
    await c.start();
    expect(gate.authenticate).toHaveBeenCalledWith("Grund");
    expect(c.getState().locked).toBe(false);
  });

  it("bleibt nach Abbruch gesperrt und erlaubt erneuten Versuch", async () => {
    const gate = fakeGate([{ status: "cancelled" }, { status: "success" }]);
    const { c } = make(gate);
    await c.start();
    expect(c.getState()).toMatchObject({ locked: true, authenticating: false });
    await c.unlock();
    expect(c.getState().locked).toBe(false);
  });

  it("zählt Fehlversuche über mehrere Versuche", async () => {
    const gate = fakeGate([{ status: "failed" }, { status: "failed" }, { status: "failed" }]);
    const { c } = make(gate);
    await c.start();
    await c.unlock();
    await c.unlock();
    expect(c.getState().failedAttempts).toBe(3);
    expect(c.getState().locked).toBe(true);
  });

  it("startet ohne Sperre gar keinen Dialog", async () => {
    const gate = fakeGate([]);
    const { c } = make(gate, { enabled: false, timeoutMs: 60_000 });
    await c.start();
    await c.resume();
    expect(gate.authenticate).not.toHaveBeenCalled();
    expect(c.getState().locked).toBe(false);
  });

  it("Plugin nicht verfügbar: App bleibt offen", async () => {
    const gate = fakeGate([], false);
    const { c } = make(gate);
    await c.start();
    expect(gate.authenticate).not.toHaveBeenCalled();
    expect(c.getState().locked).toBe(false);
  });

  it("isAvailable wirft: App bleibt offen", async () => {
    const { c } = make(fakeGate([], new Error("kein Plugin")));
    await c.start();
    expect(c.getState().locked).toBe(false);
  });

  it("authenticate wirft: bleibt gesperrt, Retry möglich", async () => {
    const gate = fakeGate([new Error("boom"), { status: "success" }]);
    const { c } = make(gate);
    await c.start();
    expect(c.getState()).toMatchObject({ locked: true, lastResult: "error" });
    await c.unlock();
    expect(c.getState().locked).toBe(false);
  });

  it("sperrt nach Hintergrund länger als Auszeit und fragt dann sofort", async () => {
    const gate = fakeGate([{ status: "success" }, { status: "success" }]);
    const { c, clock } = make(gate);
    await c.start();
    clock.t = 1000;
    c.pause();
    clock.t = 1000 + 61_000;
    await c.resume();
    expect(gate.authenticate).toHaveBeenCalledTimes(2);
    expect(c.getState().locked).toBe(false);
  });

  it("kurze Pause sperrt nicht", async () => {
    const gate = fakeGate([{ status: "success" }]);
    const { c, clock } = make(gate);
    await c.start();
    clock.t = 1000;
    c.pause();
    clock.t = 30_000;
    await c.resume();
    expect(gate.authenticate).toHaveBeenCalledTimes(1);
    expect(c.getState().locked).toBe(false);
  });

  it("Pause/Resume während des Dialogs löst keinen zweiten Dialog aus", async () => {
    let release: (r: AuthResult) => void = () => undefined;
    const gate: LockGate = {
      isAvailable: async () => true,
      authenticate: vi.fn(() => new Promise<AuthResult>((r) => (release = r))),
    };
    const { c, clock } = make(gate);
    const starting = c.start();
    await Promise.resolve();
    await Promise.resolve();
    clock.t = 10;
    c.pause();
    clock.t = 999_999;
    await c.resume();
    expect(gate.authenticate).toHaveBeenCalledTimes(1);
    release({ status: "success" });
    await starting;
    expect(c.getState().locked).toBe(false);
  });

  it("parallele unlock-Aufrufe starten nur einen Dialog", async () => {
    const gate = fakeGate([{ status: "success" }]);
    const { c } = make(gate);
    await Promise.all([c.unlock(), c.unlock()]);
    expect(gate.authenticate).toHaveBeenCalledTimes(1);
  });

  it("benachrichtigt Abonnenten und erlaubt Abmelden", async () => {
    const { c } = make(fakeGate([{ status: "success" }]));
    const seen: boolean[] = [];
    const off = c.subscribe((s) => seen.push(s.locked));
    await c.start();
    expect(seen.at(-1)).toBe(false);
    off();
    const n = seen.length;
    c.applySettings({ enabled: true, timeoutMs: 0 });
    expect(seen.length).toBe(n);
  });

  it("applySettings(aus) hebt eine bestehende Sperre auf", () => {
    const { c } = make(fakeGate([]));
    expect(c.getState().locked).toBe(true);
    c.applySettings({ enabled: false, timeoutMs: 60_000 });
    expect(c.getState().locked).toBe(false);
  });
});

describe("biometric: Fehlerzuordnung", () => {
  const err = (code: string) => Object.assign(new Error("x"), { code });

  it.each([
    [BiometryErrorType.authenticationFailed, "failed"],
    [BiometryErrorType.userCancel, "cancelled"],
    [BiometryErrorType.appCancel, "cancelled"],
    [BiometryErrorType.systemCancel, "cancelled"],
    [BiometryErrorType.userFallback, "cancelled"],
    [BiometryErrorType.biometryLockout, "lockout"],
    [BiometryErrorType.biometryNotAvailable, "unavailable"],
    [BiometryErrorType.biometryNotEnrolled, "unavailable"],
    [BiometryErrorType.noDeviceCredential, "unavailable"],
    [BiometryErrorType.passcodeNotSet, "unavailable"],
  ])("%s -> %s", (code, status) => {
    expect(mapBiometryError(err(code))).toEqual({ status });
  });

  it("fehlendes Plugin -> unavailable, sonst error", () => {
    expect(mapBiometryError(new Error("\"BiometricAuth\" plugin is not implemented on android"))).toEqual({
      status: "unavailable",
    });
    expect(mapBiometryError(new Error("irgendwas"))).toEqual({ status: "error" });
    expect(mapBiometryError("text")).toEqual({ status: "error" });
    expect(mapBiometryError(undefined)).toEqual({ status: "error" });
  });
});

describe("biometric: createGate", () => {
  const texts = { title: "T", cancel: "C" };

  it("verfügbar mit Biometrie oder nur Geräte-PIN, sonst nicht", async () => {
    const mk = (r: { isAvailable: boolean; deviceIsSecure: boolean }) =>
      createGate({ checkBiometry: async () => r, authenticate: async () => undefined }, texts);
    expect(await mk({ isAvailable: true, deviceIsSecure: false }).isAvailable()).toBe(true);
    expect(await mk({ isAvailable: false, deviceIsSecure: true }).isAvailable()).toBe(true);
    expect(await mk({ isAvailable: false, deviceIsSecure: false }).isAvailable()).toBe(false);
  });

  it("checkBiometry wirft -> nicht verfügbar", async () => {
    const gate = createGate(
      {
        checkBiometry: async () => {
          throw new Error("unimplemented");
        },
        authenticate: async () => undefined,
      },
      texts,
    );
    expect(await gate.isAvailable()).toBe(false);
  });

  it("authenticate nutzt Geräte-PIN als Fallback und liefert success / gemappte Fehler", async () => {
    const authenticate = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(
      Object.assign(new Error("x"), { code: BiometryErrorType.authenticationFailed }),
    );
    const gate = createGate({ checkBiometry: async () => ({ isAvailable: true, deviceIsSecure: true }), authenticate }, texts);
    expect(await gate.authenticate("Grund")).toEqual({ status: "success" });
    expect(authenticate).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "Grund", allowDeviceCredential: true, androidTitle: "T", cancelTitle: "C" }),
    );
    expect(await gate.authenticate("Grund")).toEqual({ status: "failed" });
  });
});
