export type UploadStage = "uploading" | "processing" | "done";

const DEFAULT_LABELS: Record<UploadStage, string> = {
  uploading: "Hochladen",
  processing: "OCR läuft",
  done: "Fertig",
};

const STAGE_ORDER: UploadStage[] = ["uploading", "processing", "done"];

/** Macht den sonst stillen Zeitraum zwischen Upload und fertigem OCR-Ergebnis sichtbar,
 * statt dass Nutzer:innen nur eine leere Liste sehen und raten, ob etwas passiert.
 * labels ist überschreibbar statt fest verdrahtet, weil diese Komponente keine eigene
 * i18n-Anbindung hat – Aufrufer übersetzen selbst. */
export function UploadProgress({
  stage,
  labels = DEFAULT_LABELS,
}: {
  stage: UploadStage;
  labels?: Record<UploadStage, string>;
}) {
  const activeIndex = STAGE_ORDER.indexOf(stage);
  return (
    <div className="ui-progress" aria-live="polite">
      {STAGE_ORDER.map((key, index) => (
        <span key={key} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
          <span
            className={`ui-progress__dot ${
              index < activeIndex ? "ui-progress__dot--done" : index === activeIndex ? "ui-progress__dot--active" : ""
            }`}
          />
          {labels[key]}
          {index < STAGE_ORDER.length - 1 && <span aria-hidden="true">→</span>}
        </span>
      ))}
    </div>
  );
}
