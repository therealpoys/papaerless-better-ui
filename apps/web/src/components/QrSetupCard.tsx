import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import qrcode from "qrcode-generator";
import { buildSetupPayload } from "../lib/setupPayload";
import { getStoredServerUrl } from "../lib/serverUrl";
import { getStoredToken, resolveToken } from "../lib/serverToken";

/** Desktop-Bereich: erzeugt clientseitig einen QR-Code mit Server-URL und Gateway-Token. */
export function QrSetupCard() {
  const { t } = useTranslation();
  const [url, setUrl] = useState(
    () => getStoredServerUrl() ?? (import.meta.env.VITE_API_URL as string | undefined) ?? window.location.origin,
  );
  const [token, setToken] = useState(() => resolveToken(getStoredToken(), import.meta.env.VITE_API_TOKEN as string | undefined) ?? "");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<"url" | "token" | "render" | null>(null);

  // Der Code verschwindet bei jeder Änderung und nach 2 Minuten wieder.
  useEffect(() => {
    if (!svg) return;
    const timer = window.setTimeout(() => setSvg(null), 120_000);
    return () => window.clearTimeout(timer);
  }, [svg]);

  function show() {
    let payload: string;
    try {
      payload = buildSetupPayload(url, token);
    } catch (err) {
      setSvg(null);
      setError((err as Error).message === "invalid url" ? "url" : "token");
      return;
    }
    try {
      const qr = qrcode(0, "M");
      qr.addData(payload);
      qr.make();
      setSvg(qr.createSvgTag({ cellSize: 6, margin: 4, scalable: true }));
      setError(null);
    } catch {
      setSvg(null);
      setError("render");
    }
  }

  return (
    <div className="server-url qr-setup">
      <strong>{t("qr.generator.title")}</strong>
      <span className="settings-panel__hint">{t("qr.generator.intro")}</span>
      <p className="settings-panel__error" role="note">
        {t("qr.generator.warning")}
      </p>
      <label htmlFor="qr-url">{t("qr.generator.urlLabel")}</label>
      <input
        id="qr-url"
        type="url"
        inputMode="url"
        autoCapitalize="none"
        spellCheck={false}
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setSvg(null);
        }}
      />
      <label htmlFor="qr-token">{t("qr.generator.tokenLabel")}</label>
      <input
        id="qr-token"
        type="password"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        value={token}
        onChange={(e) => {
          setToken(e.target.value);
          setSvg(null);
        }}
        aria-describedby="qr-token-hint"
      />
      <span id="qr-token-hint" className="settings-panel__hint">
        {t("qr.generator.tokenHint")}
      </span>
      {svg ? (
        <>
          <div
            className="qr-setup__code"
            role="img"
            aria-label={t("qr.generator.alt")}
            // SVG stammt ausschließlich aus qrcode-generator (nur Zahlen/Pfade), keine Nutzereingabe
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <button type="button" className="server-url__force" onClick={() => setSvg(null)}>
            {t("qr.generator.hide")}
          </button>
        </>
      ) : (
        <button type="button" className="server-url__submit" onClick={show}>
          {t("qr.generator.show")}
        </button>
      )}
      {error && (
        <p className="settings-panel__error" role="alert">
          {t(`qr.generator.errors.${error}`)}
        </p>
      )}
    </div>
  );
}
