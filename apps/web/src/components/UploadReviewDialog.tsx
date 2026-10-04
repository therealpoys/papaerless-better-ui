import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Correspondent, DocumentType, MetadataSuggestion, Tag } from "@papaerless/shared-types";
import { Button, Combobox } from "@papaerless/ui";
import { TagCombobox } from "./TagCombobox";
import { api } from "../lib/api";
import { friendlyError } from "../lib/errors";
import { choiceFromComboId, comboIdFromChoice, formFromSuggestion, saveReview, type Choice, type ReviewForm } from "../lib/uploadReview";

interface Props {
  documentId: number;
  fileName: string;
  suggestion: MetadataSuggestion;
  source: "ai" | "auto";
  tags: Tag[];
  correspondents: Correspondent[];
  documentTypes: DocumentType[];
  /** `saved` = Angaben wurden gespeichert (sonst "Später"). */
  onClose: (saved: boolean) => void;
}

const NEW_PREFIX = "new:";
const toValue = (c: Choice) => (c === null ? "" : typeof c === "string" ? NEW_PREFIX + c : String(c));
const fromValue = (v: string): Choice => (v === "" ? null : v.startsWith(NEW_PREFIX) ? v.slice(NEW_PREFIX.length) : Number(v));

/** Durchsuchbare Auswahl. Neue Namen bekommen intern negative IDs und werden erst beim Speichern angelegt. */
function ChoiceSelect({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: Choice;
  items: { id: number; name: string }[];
  onChange: (c: Choice) => void;
}) {
  const { t } = useTranslation();
  const extrasRef = useRef<string[]>(typeof value === "string" ? [value] : []);
  const [, rerender] = useState(0);

  const options = [...items, ...extrasRef.current.map((name, i) => ({ id: -(i + 1), name }))];
  const comboValue = comboIdFromChoice(value, extrasRef.current);

  return (
    <div className="review-dialog__field">
      <span>{label}</span>
      <Combobox
        aria-label={label}
        options={options}
        value={comboValue}
        emptyLabel={t("uploadReview.pickOrType")}
        removeSelectionLabel={t("common.combobox.removeSelection")}
        noResultsHint={t("common.combobox.noResults")}
        createOptionLabel={(name) => t("uploadReview.createOption", { name })}
        onCreate={async (name) => {
          const known = items.find((i) => i.name.toLowerCase() === name.toLowerCase());
          if (known) return known;
          let index = extrasRef.current.findIndex((e) => e.toLowerCase() === name.toLowerCase());
          if (index < 0) {
            extrasRef.current = [...extrasRef.current, name];
            index = extrasRef.current.length - 1;
            rerender((n) => n + 1);
          }
          return { id: -(index + 1), name: extrasRef.current[index] };
        }}
        onChange={(id) => onChange(choiceFromComboId(id, extrasRef.current))}
      />
    </div>
  );
}

/** Schlagwörter: durchsuchbare Mehrfachauswahl; neue Namen werden wie bei ChoiceSelect erst beim Speichern angelegt. */
function TagSelect({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: (number | string)[];
  items: { id: number; name: string }[];
  onChange: (v: (number | string)[]) => void;
}) {
  const { t } = useTranslation();
  const extrasRef = useRef<string[]>([]);
  for (const v of value) if (typeof v === "string" && !extrasRef.current.includes(v)) extrasRef.current.push(v);
  const options = [...items, ...extrasRef.current.map((name, i) => ({ id: -(i + 1), name }))];
  const ids = value.map((v) => comboIdFromChoice(v, extrasRef.current)).filter((x): x is number => x !== null);

  return (
    <div className="review-dialog__field">
      <span>{label}</span>
      <TagCombobox
        aria-label={label}
        placeholder={t("uploadReview.pickOrType")}
        options={options}
        values={ids}
        createOptionLabel={(name) => t("uploadReview.createOption", { name })}
        onCreate={async (name) => {
          const known = items.find((i) => i.name.toLowerCase() === name.toLowerCase());
          if (known) return known;
          let index = extrasRef.current.findIndex((e) => e.toLowerCase() === name.toLowerCase());
          if (index < 0) index = extrasRef.current.push(name) - 1;
          return { id: -(index + 1), name: extrasRef.current[index] };
        }}
        onChange={(next) =>
          onChange(next.map((id) => choiceFromComboId(id, extrasRef.current)).filter((c): c is number | string => c !== null))
        }
      />
    </div>
  );
}

/** Öffnet sich nach dem Upload: Vorschläge (falls KI aktiv) prüfen und Angaben setzen. */
export function UploadReviewDialog({
  documentId,
  fileName,
  suggestion,
  source,
  tags,
  correspondents,
  documentTypes,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [form, setForm] = useState<ReviewForm>(() =>
    formFromSuggestion(suggestion, { tags, correspondents, documentTypes }, fileName.replace(/\.[^.]+$/, "")),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const hasHits = Boolean(suggestion.correspondent || suggestion.documentType || suggestion.tags?.length);
  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveReview(api, documentId, form);
      await api.dismissSuggestion(documentId).catch(() => undefined);
      onClose(true);
    } catch (err) {
      setError(friendlyError(err, t, t("uploadReview.saveFailed")));
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="review-dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!saving) onClose(false);
      }}
    >
      <h2 id={titleId}>{t("uploadReview.title")}</h2>
      <p className="review-dialog__file">{fileName}</p>

      <p className="review-dialog__note">
        {source === "ai"
          ? t("uploadReview.noteAi")
          : hasHits
            ? t("uploadReview.noteAuto")
            : t("uploadReview.noteNothing")}
      </p>

      <div className="review-dialog__field">
        <label htmlFor={`${titleId}-t`}>{t("uploadReview.titleLabel")}</label>
        <input id={`${titleId}-t`} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>

      <ChoiceSelect
        label={t("uploadReview.correspondent")}
        value={form.correspondent}
        items={correspondents}
        onChange={(c) => setForm({ ...form, correspondent: c })}
      />
      <ChoiceSelect
        label={t("uploadReview.documentType")}
        value={form.documentType}
        items={documentTypes}
        onChange={(c) => setForm({ ...form, documentType: c })}
      />

      <TagSelect label={t("uploadReview.tags")} value={form.tags} items={tags} onChange={(v) => setForm({ ...form, tags: v })} />

      {error && (
        <p role="alert" className="review-dialog__error">
          {error}
        </p>
      )}

      <div className="review-dialog__actions">
        <button type="button" className="review-dialog__later" onClick={() => onClose(false)} disabled={saving}>
          {t("uploadReview.later")}
        </button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? t("uploadReview.saving") : t("uploadReview.save")}
        </Button>
      </div>
    </dialog>
  );
}
