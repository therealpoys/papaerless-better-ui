/**
 * Plattformneutrale Design-Tokens. Werte hier sind die Quelle der Wahrheit;
 * `tokens.css` bildet dieselbe Palette als CSS Custom Properties für die Web-App ab.
 * `apps/mobile` kann diese Konstanten direkt importieren (z.B. für StyleSheet-Farben),
 * auch ohne die DOM-Komponenten aus diesem Package zu nutzen.
 */

export const colors = {
  light: {
    bg: "#ffffff",
    bgMuted: "#f5f5f5",
    surface: "#ffffff",
    border: "#d9d9d9",
    text: "#1a1a1a",
    textMuted: "#666666",
    accent: "#2563eb",
    accentContrast: "#ffffff",
    success: "#2e7d32",
    successBg: "#e8f5e9",
    warning: "#b45309",
    warningBg: "#fef3c7",
    danger: "#c0392b",
    dangerBg: "#fdecea",
  },
  dark: {
    bg: "#121212",
    bgMuted: "#1e1e1e",
    surface: "#1a1a1a",
    border: "#3a3a3a",
    text: "#f2f2f2",
    textMuted: "#aaaaaa",
    accent: "#4f8dff",
    accentContrast: "#0b1020",
    success: "#6fcf74",
    successBg: "#173620",
    warning: "#f2b84b",
    warningBg: "#3a2c10",
    danger: "#f2685c",
    dangerBg: "#3a1a17",
  },
} as const;

export const spacing = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.5rem",
  xxl: "2rem",
} as const;

export const radius = {
  sm: "6px",
  md: "8px",
  lg: "12px",
  pill: "999px",
} as const;

export const fontSize = {
  xs: "0.75rem",
  sm: "0.82rem",
  md: "0.9rem",
  lg: "1.1rem",
  xl: "1.4rem",
} as const;

/** Konfidenz-Schwellen für KI-Vorschläge, geteilt zwischen Web- und Mobile-UI. */
export const confidenceLevels = {
  high: { min: 0.75, label: "sicher", color: colors.light.success },
  medium: { min: 0.4, label: "eher unsicher", color: colors.light.warning },
  low: { min: 0, label: "unsicher", color: colors.light.danger },
} as const;

export function confidenceLevel(confidence: number): keyof typeof confidenceLevels {
  if (confidence >= confidenceLevels.high.min) return "high";
  if (confidence >= confidenceLevels.medium.min) return "medium";
  return "low";
}
