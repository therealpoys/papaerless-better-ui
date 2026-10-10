import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ErrorState } from "@papaerless/ui";
import { api, apiUrl, authHeaders } from "../lib/api";
import { checkConnection, type ConnectionStatus } from "../lib/connection";
import { getStoredTheme, setTheme, THEME_PREFERENCES, type ThemePreference } from "../lib/theme";
import { saveAutoSuggest } from "../lib/settings";
import { isNative } from "../lib/platform";
import { getStoredServerUrl } from "../lib/serverUrl";
import { ServerUrlForm } from "./ServerUrlForm";
import { QrSetupCard } from "./QrSetupCard";

export function SettingsPanel() {
  const { t } = useTranslation();
  const [autoSuggest, setAutoSuggest] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [theme, setThemeState] = useState<ThemePreference>(() => getStoredTheme());
  const [connection, setConnection] = useState<ConnectionStatus | null>(null);
  const [testing, setTesting] = useState(false);

  async function handleTest() {
    setTesting(true);
    setConnection(null);
    setConnection(await checkConnection(apiUrl(), fetch, authHeaders()));
    setTesting(false);
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
      <div className="settings-panel__card" role="group" aria-labelledby="appearance-title">
        <strong id="appearance-title">{t("settings.appearance.title")}</strong>
        <div className="settings-panel__segmented" role="radiogroup" aria-labelledby="appearance-title">
          {THEME_PREFERENCES.map((pref) => (
            <label key={pref} className="settings-panel__segment">
              <input
                type="radio"
                name="theme"
                value={pref}
                checked={theme === pref}
                onChange={() => {
                  setTheme(pref);
                  setThemeState(pref);
                }}
              />
              <span>{t(`settings.appearance.${pref}`)}</span>
            </label>
          ))}
        </div>
        <span className="settings-panel__hint">{t("settings.appearance.hint")}</span>
      </div>
      <div className="settings-panel__card" role="group" aria-labelledby="connection-title">
        <strong id="connection-title">{t("settings.connection.title")}</strong>
        <span className="settings-panel__hint">
          {t("settings.connection.serverLabel")}: <code>{apiUrl() || "–"}</code>
        </span>
        <button type="button" className="server-url__submit" disabled={testing} onClick={() => void handleTest()}>
          {testing ? t("settings.connection.testing") : t("settings.connection.test")}
        </button>
        {connection && (
          <p
            className={connection === "ok" ? "settings-panel__ok" : "settings-panel__error"}
            role={connection === "ok" ? "status" : "alert"}
          >
            {t(`settings.connection.results.${connection}`)}
          </p>
        )}
      </div>
      {isNative() && (
        <div className="settings-panel__card">
          <ServerUrlForm initialUrl={getStoredServerUrl() ?? ""} onSaved={() => window.location.reload()} />
        </div>
      )}
      {!isNative() && (
        <div className="settings-panel__card">
          <QrSetupCard />
        </div>
      )}
      {error && loaded && <p className="settings-panel__error" role="alert">{error}</p>}
    </section>
  );
}
