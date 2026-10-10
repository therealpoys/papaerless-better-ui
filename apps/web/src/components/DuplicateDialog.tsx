import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@papaerless/ui";
import type { DuplicateChoice, DuplicateHit } from "../lib/duplicates";

interface Props {
  fileName: string;
  existing: DuplicateHit;
  onChoose: (choice: DuplicateChoice) => void;
}

/** Warnt vor dem Upload, dass dieselbe Datei in Paperless schon liegt. */
export function DuplicateDialog({ fileName, existing, onChoose }: Props) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="review-dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onChoose("skip");
      }}
    >
      <h2 id={titleId}>{t("duplicate.title")}</h2>
      <p className="review-dialog__file">{fileName}</p>
      <p className="review-dialog__note" role="alert">
        {t("duplicate.message", { title: existing.title })}
      </p>
      <div className="review-dialog__actions">
        <button type="button" className="review-dialog__later" onClick={() => onChoose("add")}>
          {t("duplicate.addAnyway")}
        </button>
        <button type="button" className="review-dialog__later" onClick={() => onChoose("open")}>
          {t("duplicate.openExisting")}
        </button>
        <Button onClick={() => onChoose("skip")}>{t("duplicate.skip")}</Button>
      </div>
    </dialog>
  );
}
