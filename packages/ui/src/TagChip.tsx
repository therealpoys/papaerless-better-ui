import type { ReactNode } from "react";

interface TagChipProps {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

/** Toggle-Chip für Tags, z.B. in Suchfilter und Dokument-Detail. Als echter Toggle-Button
 * per aria-pressed statt nur farblich markiert, damit auch Screenreader den Zustand erkennen. */
export function TagChip({ active = false, onClick, children }: TagChipProps) {
  return (
    <button
      type="button"
      className={`ui-tag-chip ${active ? "ui-tag-chip--active" : ""}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
