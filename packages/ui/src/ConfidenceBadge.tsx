import { confidenceLevel } from "./tokens";

const LEVEL_LABEL: Record<ReturnType<typeof confidenceLevel>, string> = {
  high: "sicher",
  medium: "eher unsicher",
  low: "unsicher",
};

/** Macht die Konfidenz eines KI-Vorschlags auf einen Blick erfassbar (Farbe + Label + %),
 * statt nur eine nackte Prozentzahl zu zeigen. */
export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const level = confidenceLevel(confidence);
  return (
    <span className={`ui-confidence ui-confidence--${level}`}>
      {LEVEL_LABEL[level]} · {Math.round(confidence * 100)}%
    </span>
  );
}
