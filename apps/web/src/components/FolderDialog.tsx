import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Correspondent, DocumentType, Folder, FolderCriterion, Tag } from "@papaerless/shared-types";
import { Button, Combobox } from "@papaerless/ui";
import {
  FOLDER_CRITERION_KINDS,
  MAX_FOLDER_NAME_LENGTH,
  draftFromFolder,
  validateFolderDraft,
  type FolderCriterionKind,
} from "../lib/folders";

interface Props {
  /** Vorhandener Ordner = Bearbeiten, sonst Neu anlegen. */
  folder?: Folder;
  tags: Tag[];
  correspondents: Correspondent[];
  documentTypes: DocumentType[];
  onCancel: () => void;
  onSubmit: (value: { name: string; criterion: FolderCriterion }) => Promise<void>;
}

export function FolderDialog({ folder, tags, correspondents, documentTypes, onCancel, onSubmit }: Props) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameId = useId();
  const kindId = useId();
  const initial = folder ? draftFromFolder(folder) : { name: "", kind: "tag" as FolderCriterionKind, criterionId: null };
  const [name, setName] = useState(initial.name);
  const [kind, setKind] = useState<FolderCriterionKind>(initial.kind);
  const [criterionId, setCriterionId] = useState<number | null>(initial.criterionId);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const options = kind === "tag" ? tags : kind === "correspondent" ? correspondents : documentTypes;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = validateFolderDraft({ name, kind, criterionId });
    if (!result.ok) {
      setError(t(`folders.dialog.errors.${result.error}`, { max: MAX_FOLDER_NAME_LENGTH }));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(result.value);
    } catch {
      setError(t("folders.dialog.errors.saveFailed"));
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="review-dialog folder-dialog"
      aria-labelledby={`${nameId}-title`}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <form onSubmit={handleSubmit}>
        <h2 id={`${nameId}-title`}>{folder ? t("folders.dialog.editTitle") : t("folders.dialog.createTitle")}</h2>
        <div className="review-dialog__field">
          <label htmlFor={nameId}>{t("folders.dialog.name")}</label>
          <input
            id={nameId}
            type="text"
            value={name}
            maxLength={MAX_FOLDER_NAME_LENGTH}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            autoFocus
          />
        </div>
        <div className="review-dialog__field">
          <label htmlFor={kindId}>{t("folders.dialog.kind")}</label>
          <select
            id={kindId}
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as FolderCriterionKind);
              setCriterionId(null);
            }}
          >
            {FOLDER_CRITERION_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`folders.kinds.${k}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="review-dialog__field">
          <span>{t(`folders.dialog.value.${kind}`)}</span>
          {/* key: Combobox hält internen Suchtext, beim Wechsel der Art neu starten */}
          <Combobox
            key={kind}
            options={options}
            value={criterionId}
            onChange={setCriterionId}
            aria-label={t(`folders.dialog.value.${kind}`)}
            emptyLabel={t("folders.dialog.pick")}
            removeSelectionLabel={t("common.combobox.removeSelection")}
            noResultsHint={t("common.combobox.noResults")}
          />
        </div>
        {error && (
          <p className="review-dialog__error" role="alert">
            {error}
          </p>
        )}
        <div className="review-dialog__actions">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t("folders.dialog.cancel")}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? t("folders.dialog.saving") : t("folders.dialog.save")}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
