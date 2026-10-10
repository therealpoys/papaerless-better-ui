import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ErrorState } from "@papaerless/ui";
import { api } from "../lib/api";
import { saveAutoSuggest } from "../lib/settings";
import { isNative } from "../lib/platform";
import { getStoredServerUrl } from "../lib/serverUrl";
import { ServerUrlForm } from "./ServerUrlForm";
import { activateAppLock, deactivateAppLock, readAppLockSettings, setAppLockTimeout } from "../lib/appLockRuntime";
import { TIMEOUT_OPTIONS_MS } from "../lib/appLock";

export function SettingsPanel() {
  const { t } = useTranslation();
  const [autoSuggest, setAutoSuggest] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lock, setLock] = useState(readAppLockSettings);
  const [lockBusy, setLockBusy] = useState(false);
  const [lockMessage, setLockMessage] = useState<string | null>(null);

  async function handleLockChange(next: boolean) {
    setLockMessage(null);
    if (!next) {
      deactivateAppLock();
      setLock(readAppLockSettings());
      return;
    }
    setLockBusy(true);
    const result = await activateAppLock();
    setLock(readAppLockSettings());
    setLockMessage(result === "enabled" ? null : t(`appLock.settings.${result}`));
    setLockBusy(false);
  }

  function load() {
    setError(null);
    api
      .getSettings()
      .then((s) => {
        setAutoSuggest(s.autoSuggest);
        setAiEnabled(s.aiEnabled);
        setLoaded(true);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  async function handleChange(next: boolean) {
    setSaving(true);
    const result = await saveAutoSuggest(api, autoSuggest, next);
    setAutoSuggest(result.value);
    setError(result.failed ? t("settings.autoSuggest.saveFailed") : null);
    setSaving(false);
  }

  if (error && !loaded) return <ErrorState message={error} onRetry={load} retryLabel={t("common.retry")} />;

  return (
    <section className="settings-panel" aria-labelledby="settings-title">
      <h2 id="settings-title">{t("settings.title")}</h2>
      <div className="settings-panel__card">
      <label className="settings-panel__option">
        <input
          type="checkbox"
          role="switch"
          checked={autoSuggest}
          disabled={!loaded || saving}
          onChange={(e) => void handleChange(e.target.checked)}
          aria-describedby="auto-suggest-hint"
        />
        <span>
          <strong>{t("settings.autoSuggest.label")}</strong>
          <span id="auto-suggest-hint" className="settings-panel__hint">
            {t("settings.autoSuggest.description")}
          </span>
          <span className="settings-panel__hint">
            {t("settings.autoSuggest.cpuHint")}
          </span>
          {!aiEnabled && (
            <span className="settings-panel__hint" role="status">
              {t("settings.autoSuggest.aiDisabled")}
            </span>
          )}
        </span>
      </label>
      </div>
      {isNative() && (
        <div className="settings-panel__card">
          <label className="settings-panel__option">
            <input
              type="checkbox"
              role="switch"
              checked={lock.enabled}
              disabled={lockBusy}
              onChange={(e) => void handleLockChange(e.target.checked)}
              aria-describedby="app-lock-hint"
            />
            <span>
              <strong>{t("appLock.settings.label")}</strong>
              <span id="app-lock-hint" className="settings-panel__hint">
                {t("appLock.settings.description")}
              </span>
            </span>
          </label>
          {lock.enabled && (
            <label className="settings-panel__field">
              <span>{t("appLock.settings.timeoutLabel")}</span>
              <select
                value={lock.timeoutMs}
                onChange={(e) => {
                  setAppLockTimeout(Number(e.target.value));
                  setLock(readAppLockSettings());
                }}
              >
                {TIMEOUT_OPTIONS_MS.map((ms) => (
                  <option key={ms} value={ms}>
                    {t(`appLock.settings.timeout.${ms}`)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {lockMessage && <p className="settings-panel__error" role="alert">{lockMessage}</p>}
        </div>
      )}
      {isNative() && (
        <div className="settings-panel__card">
          <ServerUrlForm initialUrl={getStoredServerUrl() ?? ""} onSaved={() => window.location.reload()} />
        </div>
      )}
      {error && loaded && <p className="settings-panel__error" role="alert">{error}</p>}
    </section>
  );
}
