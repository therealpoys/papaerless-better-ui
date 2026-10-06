import { useTranslation } from "react-i18next";
import { ServerUrlForm } from "./ServerUrlForm";

/** Einrichtungsbildschirm beim ersten Start der nativen App. */
export function ServerSetup({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  return (
    <main className="server-setup">
      <h1>{t("app.title")}</h1>
      <h2>{t("serverUrl.setupTitle")}</h2>
      <p>{t("serverUrl.setupIntro")}</p>
      <div className="settings-panel__card">
        <ServerUrlForm initialUrl="" onSaved={onDone} />
      </div>
    </main>
  );
}
