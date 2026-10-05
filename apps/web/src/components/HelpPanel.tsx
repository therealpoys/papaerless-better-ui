import { useTranslation } from "react-i18next";

const STEPS = ["add", "review", "search", "reminder", "save"] as const;
const TERMS = ["sender", "docType", "keyword", "recognizedText", "suggestion", "reminder"] as const;

export function HelpPanel() {
  const { t } = useTranslation();
  return (
    <section className="help-panel" aria-labelledby="help-title">
      <h2 id="help-title">{t("help.title")}</h2>
      <p className="help-panel__intro">{t("help.intro")}</p>

      <h3>{t("help.stepsHeading")}</h3>
      <ol>
        {STEPS.map((s) => (
          <li key={s}>
            <strong>{t(`help.steps.${s}.title`)}</strong>
            <span>{t(`help.steps.${s}.text`)}</span>
          </li>
        ))}
      </ol>

      <h3>{t("help.glossaryHeading")}</h3>
      <dl>
        {TERMS.map((g) => (
          <div key={g}>
            <dt>{t(`help.glossary.${g}.term`)}</dt>
            <dd>{t(`help.glossary.${g}.definition`)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
