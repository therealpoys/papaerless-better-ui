import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";

interface ShareConfirmDialogProps {
  files: File[];
  onConfirm: () => void;
  onCancel: () => void;
}

/** Rückfrage, wenn per "Teilen mit…" Dateien ankommen: erst nach Bestätigung geht es in den Upload. */
export function ShareConfirmDialog({ files, onConfirm, onCancel }: ShareConfirmDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby={titleId}
      data-testid="share-confirm"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <h2 id={titleId} className="confirm-dialog__title">
        {t("share.title", { count: files.length })}
      </h2>
      <ul className="confirm-dialog__list">
        {files.map((file, i) => (
          <li key={`${file.name}-${i}`} className="confirm-dialog__doc">
            {file.name}
          </li>
        ))}
      </ul>
      <div className="confirm-dialog__actions">
        <button type="button" className="ui-button" onClick={onCancel}>
          {t("share.cancel")}
        </button>
        <button type="button" className="ui-button ui-button--primary" onClick={onConfirm}>
          {t("share.confirm", { count: files.length })}
        </button>
      </div>
    </dialog>
  );
}
