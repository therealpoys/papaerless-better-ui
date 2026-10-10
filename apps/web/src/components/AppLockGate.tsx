import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { App as CapacitorApp } from "@capacitor/app";
import { Button } from "@papaerless/ui";
import { getLockController, readAppLockSettings } from "../lib/appLockRuntime";
import { setScreenSecure } from "../lib/biometric";
import { FAILED_ATTEMPTS_HINT, type LockState } from "../lib/appLock";

const noopSubscribe = () => () => undefined;
const noState = (): LockState | null => null;

/** Verdeckt die App hinter einem Sperrbildschirm, wenn die Geräte-Sperre aktiv ist. Im Browser ohne Wirkung. */
export function AppLockGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const controller = getLockController();
  const state = useSyncExternalStore(controller?.subscribe ?? noopSubscribe, controller?.getState ?? noState);

  useEffect(() => {
    if (!controller) return;
    void setScreenSecure(readAppLockSettings().enabled);
    void controller.start();
    const handle = CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void controller.resume();
      else controller.pause();
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, [controller]);

  if (!controller || !state) return <>{children}</>;

  // Auch im Hintergrund verdecken, damit beim Zurückkehren kein Inhalt aufblitzt.
  const covered = state.locked || state.backgroundedAt !== null;
  return (
    <>
      <div hidden={covered} aria-hidden={covered}>
        {children}
      </div>
      {covered && (
        <div className="lock-screen" role="dialog" aria-modal="true" aria-labelledby="lock-title">
          <div className="lock-screen__box">
            <h1 id="lock-title">{t("appLock.title")}</h1>
            {state.locked && (
              <>
                <p>{t("appLock.description")}</p>
                {state.lockedOut && <p role="alert">{t("appLock.lockedOut")}</p>}
                {!state.lockedOut && state.failedAttempts >= FAILED_ATTEMPTS_HINT && (
                  <p role="alert">{t("appLock.failedHint")}</p>
                )}
                {!state.lockedOut && state.lastResult === "error" && <p role="alert">{t("appLock.error")}</p>}
                <Button onClick={() => void controller.unlock()} disabled={state.authenticating}>
                  {t("appLock.unlock")}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
