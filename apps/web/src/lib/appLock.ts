/**
 * Optionale Geräte-/Biometrie-Sperre der Android-App. Reine Logik ohne Plugin- und React-Abhängigkeit:
 * das Plugin steckt hinter {@link LockGate}, Zeit und Speicher werden injiziert.
 *
 * Grundregel: Die Sperre darf den Nutzer nie dauerhaft aussperren. Ist keine Authentifizierung möglich
 * (Plugin fehlt, keine Bildschirmsperre eingerichtet), bleibt die App entsperrt.
 */

export type AuthResult =
  | { status: "success" }
  /** Nutzer hat den Dialog abgebrochen; kein Fehlversuch. */
  | { status: "cancelled" }
  /** Falscher Finger/Gesicht/PIN. */
  | { status: "failed" }
  /** System hat die Authentifizierung vorübergehend gesperrt (zu viele Versuche). */
  | { status: "lockout" }
  /** Es gibt keine Möglichkeit zu authentifizieren (Plugin fehlt, keine Bildschirmsperre). */
  | { status: "unavailable" }
  /** Unerwarteter Fehler; bleibt gesperrt, Nutzer kann es erneut versuchen. */
  | { status: "error" };

/** Dünnes Interface um das Biometrie-Plugin; in Tests ersetzbar. */
export interface LockGate {
  /** true, wenn Biometrie oder Geräte-PIN als Entsperrmethode zur Verfügung steht. */
  isAvailable(): Promise<boolean>;
  authenticate(reason: string): Promise<AuthResult>;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const TIMEOUT_OPTIONS_MS = [0, 60_000, 5 * 60_000, 15 * 60_000] as const;
export const DEFAULT_TIMEOUT_MS = 60_000;
/** Ab dieser Zahl Fehlversuche in Folge zeigt der Sperrbildschirm einen Hinweis. */
export const FAILED_ATTEMPTS_HINT = 3;

const KEY_ENABLED = "appLock.enabled";
const KEY_TIMEOUT = "appLock.timeoutMs";

export interface LockSettings {
  enabled: boolean;
  timeoutMs: number;
}

function safeGet(storage: KeyValueStorage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function loadLockSettings(storage: KeyValueStorage): LockSettings {
  const rawTimeout = safeGet(storage, KEY_TIMEOUT);
  const parsed = rawTimeout === null ? NaN : Number(rawTimeout);
  const timeoutMs = (TIMEOUT_OPTIONS_MS as readonly number[]).includes(parsed) ? parsed : DEFAULT_TIMEOUT_MS;
  return { enabled: safeGet(storage, KEY_ENABLED) === "true", timeoutMs };
}

export function saveLockTimeout(storage: KeyValueStorage, timeoutMs: number): void {
  try {
    storage.setItem(KEY_TIMEOUT, String(timeoutMs));
  } catch {
    /* Speicher nicht verfügbar: Standardwert bleibt */
  }
}

export function disableLock(storage: KeyValueStorage): void {
  try {
    storage.removeItem(KEY_ENABLED);
  } catch {
    /* ignorieren */
  }
}

export type EnableResult = "enabled" | "unavailable" | "denied" | "storageFailed";

async function safeIsAvailable(gate: LockGate): Promise<boolean> {
  try {
    return await gate.isAvailable();
  } catch {
    return false;
  }
}

async function safeAuthenticate(gate: LockGate, reason: string): Promise<AuthResult> {
  try {
    return await gate.authenticate(reason);
  } catch {
    return { status: "error" };
  }
}

/**
 * Schaltet die Sperre ein, aber nur nach erfolgreicher Authentifizierung – so kann man sich nicht
 * mit einer nicht funktionierenden Methode selbst aussperren.
 */
export async function enableLock(gate: LockGate, storage: KeyValueStorage, reason: string): Promise<EnableResult> {
  if (!(await safeIsAvailable(gate))) return "unavailable";
  const result = await safeAuthenticate(gate, reason);
  if (result.status === "unavailable") return "unavailable";
  if (result.status !== "success") return "denied";
  try {
    storage.setItem(KEY_ENABLED, "true");
  } catch {
    return "storageFailed";
  }
  return "enabled";
}

export interface LockState {
  enabled: boolean;
  timeoutMs: number;
  locked: boolean;
  /** Zeitpunkt, an dem die App in den Hintergrund ging (ms); null = im Vordergrund. */
  backgroundedAt: number | null;
  /** Läuft gerade ein Authentifizierungsdialog? Der löst selbst Pause/Resume aus. */
  authenticating: boolean;
  failedAttempts: number;
  lockedOut: boolean;
  /** Letztes Ergebnis ungleich Erfolg, für die Anzeige. */
  lastResult: AuthResult["status"] | null;
}

export function initialLockState(settings: LockSettings): LockState {
  return {
    enabled: settings.enabled,
    timeoutMs: settings.timeoutMs,
    // Beim App-Start ist die App gesperrt, sobald die Sperre aktiv ist.
    locked: settings.enabled,
    backgroundedAt: null,
    authenticating: false,
    failedAttempts: 0,
    lockedOut: false,
    lastResult: null,
  };
}

/** App geht in den Hintergrund. */
export function onBackground(state: LockState, now: number): LockState {
  if (!state.enabled || state.authenticating) return state;
  if (state.backgroundedAt !== null) return state;
  return { ...state, backgroundedAt: now };
}

/** App kommt zurück in den Vordergrund: sperren, wenn die Auszeit abgelaufen ist. */
export function onForeground(state: LockState, now: number): LockState {
  if (state.backgroundedAt === null) return state;
  const base = { ...state, backgroundedAt: null };
  if (!state.enabled || state.locked) return base;
  const elapsed = now - state.backgroundedAt;
  // Negative Dauer = Uhr zurückgestellt: sicherheitshalber sperren.
  if (elapsed < 0 || elapsed >= state.timeoutMs) {
    return { ...base, locked: true, failedAttempts: 0, lockedOut: false, lastResult: null };
  }
  return base;
}

export function onAuthStart(state: LockState): LockState {
  return { ...state, authenticating: true };
}

export function onAuthResult(state: LockState, result: AuthResult): LockState {
  const base = { ...state, authenticating: false, lastResult: result.status };
  switch (result.status) {
    case "success":
      return { ...base, locked: false, failedAttempts: 0, lockedOut: false, lastResult: null };
    case "unavailable":
      // Nie aussperren: ohne Entsperrmethode bleibt die App offen.
      return { ...base, locked: false, failedAttempts: 0, lockedOut: false };
    case "failed":
      return { ...base, failedAttempts: state.failedAttempts + 1, lockedOut: false };
    case "lockout":
      return { ...base, lockedOut: true };
    case "cancelled":
    case "error":
      return { ...base, lockedOut: false };
  }
}

export function onSettingsChanged(state: LockState, settings: LockSettings): LockState {
  if (!settings.enabled) {
    return {
      ...state,
      ...settings,
      locked: false,
      backgroundedAt: null,
      failedAttempts: 0,
      lockedOut: false,
      lastResult: null,
    };
  }
  // Frisch aktiviert: Nutzer hat sich gerade authentifiziert, also nicht sofort sperren.
  return { ...state, ...settings };
}

type Listener = (state: LockState) => void;

/** Verbindet Zustandsmaschine, Plugin und Uhr; framework-frei und damit testbar. */
export class LockController {
  private state: LockState;
  private listeners = new Set<Listener>();

  constructor(
    private readonly gate: LockGate,
    settings: LockSettings,
    private readonly reason: string,
    private readonly now: () => number = Date.now,
  ) {
    this.state = initialLockState(settings);
  }

  getState = (): LockState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private set(next: LockState) {
    if (next === this.state) return;
    this.state = next;
    this.listeners.forEach((l) => l(next));
  }

  /** Beim App-Start: wenn gesperrt, direkt den Dialog zeigen. */
  async start(): Promise<void> {
    if (this.state.locked) await this.unlock();
  }

  pause(): void {
    this.set(onBackground(this.state, this.now()));
  }

  async resume(): Promise<void> {
    this.set(onForeground(this.state, this.now()));
    if (this.state.locked) await this.unlock();
  }

  applySettings(settings: LockSettings): void {
    this.set(onSettingsChanged(this.state, settings));
  }

  /** Zeigt den Authentifizierungsdialog; parallele Aufrufe werden ignoriert. */
  async unlock(): Promise<void> {
    if (!this.state.locked || this.state.authenticating) return;
    this.set(onAuthStart(this.state));
    const result: AuthResult = (await safeIsAvailable(this.gate))
      ? await safeAuthenticate(this.gate, this.reason)
      : { status: "unavailable" };
    this.set(onAuthResult(this.state, result));
  }
}
