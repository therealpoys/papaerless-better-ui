import { Capacitor } from "@capacitor/core";

/** Reine Variante für Tests: fragt nur, ob ein Capacitor-artiges Objekt "native" meldet. */
export function detectNative(cap: { isNativePlatform?: () => boolean } | undefined): boolean {
  try {
    return cap?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

/** true nur in der Capacitor-App (Android/iOS), im Browser immer false. */
export function isNative(): boolean {
  return detectNative(Capacitor);
}
