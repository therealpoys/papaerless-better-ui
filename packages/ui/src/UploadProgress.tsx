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
  percent,
  detail,
  barLabel,
}: {
  stage: UploadStage;
  labels?: Record<UploadStage, string>;
  /** 0-100: bestimmter Balken. Ohne Wert (aber mit detail) läuft ein unbestimmter Balken. */
  percent?: number;
  /** Zusatzzeile unter dem Balken, z. B. Restzeit oder verstrichene Zeit. */
  detail?: string;
  /** Zugänglicher Name des Balkens. */
  barLabel?: string;
}) {
  const activeIndex = STAGE_ORDER.indexOf(stage);
  const clamped = percent === undefined ? undefined : Math.max(0, Math.min(100, Math.round(percent)));
  const showBar = clamped !== undefined || detail !== undefined;
  return (
    <div className="ui-progress-wrap">
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
      {showBar && (
        <div
          className={`ui-progress__bar ${clamped === undefined ? "ui-progress__bar--indeterminate" : ""}`}
          role="progressbar"
          aria-label={barLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={clamped}
        >
          <div className="ui-progress__fill" style={clamped === undefined ? undefined : { width: `${clamped}%` }} />
        </div>
      )}
      {detail && <p className="ui-progress__detail">{detail}</p>}
    </div>
  );
}
