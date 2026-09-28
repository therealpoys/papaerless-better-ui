import { confidenceLevel } from "./tokens";

const DEFAULT_LEVEL_LABEL: Record<ReturnType<typeof confidenceLevel>, string> = {
  high: "sicher",
  medium: "eher unsicher",
  low: "unsicher",
};

/** Macht die Konfidenz eines KI-Vorschlags auf einen Blick erfassbar (Farbe + Label + %),
 * statt nur eine nackte Prozentzahl zu zeigen. levelLabels ist überschreibbar statt fest
 * verdrahtet, weil diese Komponente keine eigene i18n-Anbindung hat – Aufrufer übersetzen selbst. */
export function ConfidenceBadge({
  confidence,
  levelLabels = DEFAULT_LEVEL_LABEL,
}: {
  confidence: number;
  levelLabels?: Record<ReturnType<typeof confidenceLevel>, string>;
}) {
  const level = confidenceLevel(confidence);
  return (
    <span className={`ui-confidence ui-confidence--${level}`}>
      {levelLabels[level]} · {Math.round(confidence * 100)}%
    </span>
  );
}
