import i18n from "../i18n";
import { isNative } from "./platform";
import { createNativeGate, setScreenSecure } from "./biometric";
import {
  LockController,
  disableLock,
  enableLock,
  loadLockSettings,
  saveLockTimeout,
  type EnableResult,
  type KeyValueStorage,
} from "./appLock";

function storage(): KeyValueStorage {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
  }
}

let controller: LockController | null = null;
let gate: ReturnType<typeof createNativeGate> | null = null;

function getGate() {
  gate ??= createNativeGate({ title: i18n.t("appLock.promptTitle"), cancel: i18n.t("appLock.promptCancel") });
  return gate;
}

/** Der App-weite Controller; im Browser null (Sperre komplett inaktiv). */
export function getLockController(): LockController | null {
  if (!isNative()) return null;
  controller ??= new LockController(getGate(), loadLockSettings(storage()), i18n.t("appLock.promptReason"));
  return controller;
}

/** Schaltet die Sperre ein – nur nach erfolgreicher Authentifizierung. */
export async function activateAppLock(): Promise<EnableResult> {
  const ctrl = getLockController();
  if (!ctrl) return "unavailable";
  const result = await enableLock(getGate(), storage(), i18n.t("appLock.promptReason"));
  if (result === "enabled") {
    ctrl.applySettings(loadLockSettings(storage()));
    void setScreenSecure(true);
  }
  return result;
}

export function deactivateAppLock(): void {
  disableLock(storage());
  getLockController()?.applySettings(loadLockSettings(storage()));
  void setScreenSecure(false);
}

export function setAppLockTimeout(timeoutMs: number): void {
  saveLockTimeout(storage(), timeoutMs);
  getLockController()?.applySettings(loadLockSettings(storage()));
}

export function readAppLockSettings() {
  return loadLockSettings(storage());
}
