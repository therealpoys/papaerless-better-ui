export type UploadStage = "uploading" | "processing" | "done";

const STEPS: { key: UploadStage; label: string }[] = [
  { key: "uploading", label: "Hochladen" },
  { key: "processing", label: "OCR läuft" },
  { key: "done", label: "Fertig" },
];

/** Macht den sonst stillen Zeitraum zwischen Upload und fertigem OCR-Ergebnis sichtbar,
 * statt dass Nutzer:innen nur eine leere Liste sehen und raten, ob etwas passiert. */
export function UploadProgress({ stage }: { stage: UploadStage }) {
  const activeIndex = STEPS.findIndex((s) => s.key === stage);
  return (
    <div className="ui-progress" aria-live="polite">
      {STEPS.map((step, index) => (
        <span key={step.key} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
          <span
            className={`ui-progress__dot ${
              index < activeIndex ? "ui-progress__dot--done" : index === activeIndex ? "ui-progress__dot--active" : ""
            }`}
          />
          {step.label}
          {index < STEPS.length - 1 && <span aria-hidden="true">→</span>}
        </span>
      ))}
    </div>
  );
}
