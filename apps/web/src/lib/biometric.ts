import { Capacitor, registerPlugin } from "@capacitor/core";
import { BiometricAuth, BiometryErrorType } from "@aparajita/capacitor-biometric-auth";
import { detectNative } from "./platform";
import type { AuthResult, LockGate } from "./appLock";

/** Ordnet den Fehlercode des Plugins einem {@link AuthResult} zu. */
export function mapBiometryError(err: unknown): AuthResult {
  const code = typeof err === "object" && err !== null ? (err as { code?: unknown }).code : undefined;
  switch (code) {
    case BiometryErrorType.authenticationFailed:
      return { status: "failed" };
    case BiometryErrorType.userCancel:
    case BiometryErrorType.appCancel:
    case BiometryErrorType.systemCancel:
    case BiometryErrorType.userFallback:
      return { status: "cancelled" };
    case BiometryErrorType.biometryLockout:
      return { status: "lockout" };
    case BiometryErrorType.biometryNotAvailable:
    case BiometryErrorType.biometryNotEnrolled:
    case BiometryErrorType.noDeviceCredential:
    case BiometryErrorType.passcodeNotSet:
      return { status: "unavailable" };
  }
  const message = err instanceof Error ? err.message : "";
  if (/unimplemented|not implemented|not available on/i.test(message)) return { status: "unavailable" };
  return { status: "error" };
}

export interface BiometricPluginLike {
  checkBiometry(): Promise<{ isAvailable: boolean; deviceIsSecure: boolean }>;
  authenticate(options: Record<string, unknown>): Promise<void>;
}

export interface LockTexts {
  title: string;
  cancel: string;
}

export function createGate(plugin: BiometricPluginLike, texts: LockTexts): LockGate {
  return {
    async isAvailable() {
      try {
        const r = await plugin.checkBiometry();
        // Mit Geräte-PIN als Fallback genügt eine eingerichtete Bildschirmsperre.
        return r.isAvailable || r.deviceIsSecure;
      } catch {
        return false;
      }
    },
    async authenticate(reason) {
      try {
        await plugin.authenticate({
          reason,
          androidTitle: texts.title,
          cancelTitle: texts.cancel,
          allowDeviceCredential: true,
        });
        return { status: "success" };
      } catch (err) {
        return mapBiometryError(err);
      }
    },
  };
}

/** Echtes Gate für die App; im Browser immer "nicht verfügbar". */
export function createNativeGate(texts: LockTexts): LockGate {
  if (!detectNative(Capacitor)) {
    return { isAvailable: async () => false, authenticate: async () => ({ status: "unavailable" }) };
  }
  return createGate(BiometricAuth, texts);
}

interface AppLockNative {
  setSecure(options: { enabled: boolean }): Promise<void>;
}

const AppLockNativePlugin = registerPlugin<AppLockNative>("AppLock");

/** FLAG_SECURE: blendet den Inhalt in der App-Übersicht aus und sperrt Screenshots. */
export async function setScreenSecure(enabled: boolean): Promise<void> {
  if (!detectNative(Capacitor)) return;
  try {
    await AppLockNativePlugin.setSecure({ enabled });
  } catch {
    /* ältere Builds ohne Plugin: ignorieren */
  }
}
