import type { ReactNode } from "react";

interface FieldProps {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
}

/** Label + Control als Einheit, konsistent beschriftet statt Placeholder-only Inputs. */
export function Field({ label, children, hint }: FieldProps) {
  return (
    <label className="ui-field">
      <span className="ui-field__label">{label}</span>
      {children}
      {hint && <span className="ui-field__hint">{hint}</span>}
    </label>
  );
}
