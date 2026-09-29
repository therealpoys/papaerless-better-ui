import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Correspondent, DocumentType, MetadataSuggestion, Tag } from "@papaerless/shared-types";
import { Button } from "@papaerless/ui";
import { api } from "../lib/api";
import { friendlyError } from "../lib/errors";
import { formFromSuggestion, saveReview, type Choice, type ReviewForm } from "../lib/uploadReview";

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
  const id = useId();
  return (
    <div className="review-dialog__field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={toValue(value)} onChange={(e) => onChange(fromValue(e.target.value))}>
        <option value="">{t("uploadReview.none")}</option>
        {typeof value === "string" && (
          <option value={toValue(value)}>{t("uploadReview.newEntry", { name: value })}</option>
        )}
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
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
  const [showAllTags, setShowAllTags] = useState(false);
  const newTags = form.tags.filter((tag): tag is string => typeof tag === "string");
  const toggleTag = (tag: number | string) =>
    setForm((f) => ({ ...f, tags: f.tags.includes(tag) ? f.tags.filter((x) => x !== tag) : [...f.tags, tag] }));

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

  const allChips = [
    ...tags.map((tag) => ({ key: String(tag.id), value: tag.id as number | string, label: tag.name })),
    ...newTags.map((name) => ({ key: `new-${name}`, value: name as number | string, label: t("uploadReview.newEntry", { name }) })),
  ];
  // Ausgewählte zuerst; der Rest ist eingeklappt, wenn es viele Schlagwörter gibt.
  const sorted = [...allChips.filter((c) => form.tags.includes(c.value)), ...allChips.filter((c) => !form.tags.includes(c.value))];
  const LIMIT = 8;
  const chips = showAllTags ? sorted : sorted.slice(0, Math.max(LIMIT, form.tags.length));
  const hiddenCount = sorted.length - chips.length;

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

      <div className="review-dialog__field">
        <span id={`${titleId}-tags`}>{t("uploadReview.tags")}</span>
        <div className="review-dialog__chips" role="group" aria-labelledby={`${titleId}-tags`}>
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className="review-dialog__chip"
              aria-pressed={form.tags.includes(chip.value)}
              onClick={() => toggleTag(chip.value)}
            >
              {form.tags.includes(chip.value) ? "✓ " : ""}
              {chip.label}
            </button>
          ))}
          {chips.length === 0 && <span>{t("uploadReview.noTags")}</span>}
        </div>
        {hiddenCount > 0 && (
          <button type="button" className="review-dialog__more" onClick={() => setShowAllTags(true)}>
            {t("uploadReview.moreTags", { count: hiddenCount })}
          </button>
        )}
      </div>

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
