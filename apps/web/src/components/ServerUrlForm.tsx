import { useState } from "react";
import { useTranslation } from "react-i18next";
import { normalizeServerUrl, saveServerUrl, testConnection, type ConnectionResult } from "../lib/serverUrl";
import { authHeaders } from "../lib/api";
import { applyScannedSetup, type QrSetupResult } from "../lib/qrSetup";
import { QrScanner } from "./QrScanner";

interface Props {
  initialUrl: string;
  onSaved: () => void;
}

type Status = ConnectionResult | "empty" | "invalid" | "testing" | null;

/** Eingabe der Server-URL mit Verbindungstest; bei Fehlschlag lässt sich die Adresse trotzdem speichern. */
export function ServerUrlForm({ initialUrl, onSaved }: Props) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initialUrl);
  const [status, setStatus] = useState<Status>(null);
  const [scanning, setScanning] = useState(false);
  const [qrStatus, setQrStatus] = useState<QrSetupResult | "testing" | null>(null);

  async function handleScanned(raw: string) {
    setScanning(false);
    setQrStatus("testing");
    const result = await applyScannedSetup(raw);
    setQrStatus(result);
    if (result === "ok") onSaved();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeServerUrl(value);
    if (!normalized.ok) {
      setStatus(normalized.error);
      return;
    }
    setValue(normalized.url);
    setStatus("testing");
    const result = await testConnection(normalized.url, fetch, authHeaders());
    setStatus(result);
    if (result === "ok") {
      saveServerUrl(normalized.url);
      onSaved();
    }
  }

  function handleSaveAnyway() {
    const saved = saveServerUrl(value);
    if (saved.ok) onSaved();
  }

  const canForce = status === "unauthorized" || status === "unreachable" || status === "notServer";

  return (
    <form className="server-url" onSubmit={(e) => void handleSubmit(e)}>
      <label htmlFor="server-url-input">
        <strong>{t("serverUrl.label")}</strong>
      </label>
      <input
        id="server-url-input"
        type="url"
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder={t("serverUrl.placeholder")}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setStatus(null);
        }}
        aria-describedby="server-url-hint"
      />
      <span id="server-url-hint" className="settings-panel__hint">
        {t("serverUrl.hint")}
      </span>
      <button type="submit" className="server-url__submit" disabled={status === "testing"}>
        {status === "testing" ? t("serverUrl.testing") : t("serverUrl.testAndSave")}
      </button>
      {status && status !== "testing" && status !== "ok" && (
        <p className="settings-panel__error" role="alert">
          {t(`serverUrl.errors.${status}`)}
        </p>
      )}
      <button
        type="button"
        className="server-url__force"
        disabled={scanning || qrStatus === "testing"}
        onClick={() => {
          setQrStatus(null);
          setScanning(true);
        }}
      >
        {qrStatus === "testing" ? t("qr.testing") : t("qr.scan")}
      </button>
      {scanning && <QrScanner onCode={(c) => void handleScanned(c)} onCancel={() => setScanning(false)} />}
      {qrStatus && qrStatus !== "testing" && qrStatus !== "ok" && (
        <p className="settings-panel__error" role="alert">
          {t(`qr.errors.${qrStatus}`)}
        </p>
      )}
      {canForce && (
        <button type="button" className="server-url__force" onClick={handleSaveAnyway}>
          {t("serverUrl.saveAnyway")}
        </button>
      )}
    </form>
  );
}
