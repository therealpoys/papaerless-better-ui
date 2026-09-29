import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "@papaerless/ui";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Eigener Bestätigungsdialog (statt window.confirm). "Abbrechen" hat den Standardfokus,
 * damit ein versehentliches Enter nichts löscht. Esc und Klick daneben brechen ab. */
export function ConfirmDialog({
  open,
  title,
  children,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onCancel();
      }}
    >
      <h2 id={titleId} className="confirm-dialog__title">
        {title}
      </h2>
      <div className="confirm-dialog__body">{children}</div>
      <div className="confirm-dialog__actions">
        <button ref={cancelRef} type="button" className="ui-button ui-button--primary" onClick={onCancel}>
          {cancelLabel}
        </button>
        <Button variant="danger" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
