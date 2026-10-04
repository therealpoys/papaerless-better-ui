import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Correspondent, DocumentType, MetadataSuggestion, Tag } from "@papaerless/shared-types";
import { api } from "../lib/api";
import { UploadProgress, type UploadStage } from "@papaerless/ui";
import { UploadReviewDialog } from "./UploadReviewDialog";
import { heuristicSuggestion } from "../lib/uploadReview";
import {
  classifyUploadError,
  computeUploadProgress,
  formatElapsed,
  remainingTimeParts,
  validateFile,
  waitForDocumentId,
  type UploadErrorKey,
} from "../lib/upload";

interface UploadZoneProps {
  onUploaded: () => void;
  aiEnabled?: boolean;
  tags: Tag[];
  correspondents: Correspondent[];
  documentTypes: DocumentType[];
  onMetadataChanged: () => void;
}

interface PendingReview {
  itemId: number;
  documentId: number;
  fileName: string;
  suggestion: MetadataSuggestion;
  source: "ai" | "auto";
}

type ItemStatus = "waiting" | "uploading" | "reading" | "done" | "error";

interface UploadItem {
  id: number;
  file: File;
  status: ItemStatus;
  error?: UploadErrorKey;
  percent?: number;
  remainingSeconds?: number | null;
  /** Beginn der aktuellen Phase (ms), für die verstrichene Zeit */
  phaseStartedAt?: number;
}

const ACCEPT = "application/pdf,image/*,.eml";
let nextId = 1;

export function UploadZone({
  onUploaded,
  aiEnabled = false,
  tags,
  correspondents,
  documentTypes,
  onMetadataChanged,
}: UploadZoneProps) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const working = items.some((item) => item.status === "reading");

  // Sekundentakt nur, solange eine Phase ohne Prozentangabe läuft.
  useEffect(() => {
    if (!working) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [working]);

  function patch(id: number, changes: Partial<UploadItem>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }

  async function uploadAll(list: UploadItem[]) {
    setBusy(true);
    let anyDone = false;
    for (const item of list) {
      const invalid = validateFile(item.file);
      if (invalid) {
        patch(item.id, { status: "error", error: invalid });
        continue;
      }
      const uploadStart = Date.now();
      patch(item.id, { status: "uploading", error: undefined, percent: 0, remainingSeconds: null });
      try {
        const { taskId } = await api.uploadDocument(item.file, (loaded, total) => {
          const info = computeUploadProgress(loaded, total, Date.now() - uploadStart);
          patch(item.id, { percent: info.percent, remainingSeconds: info.remainingSeconds });
        });
        anyDone = true;
        // Danach öffnet sich das Prüf-Fenster. Klappt das Einlesen nicht, ist der Upload trotzdem ok.
        patch(item.id, { status: "reading", phaseStartedAt: Date.now() });
        try {
          const documentId = await waitForDocumentId(api.getUploadTask, taskId);
          if (documentId) {
            if (aiEnabled) {
              // Die KI braucht Minuten: nicht darauf warten. Der Server rechnet weiter, das Dokument
              // zeigt in der Liste selbst an, dass der Vorschlag noch entsteht.
              void api.suggestMetadata(documentId).catch(() => undefined);
            } else {
              // Ohne KI erkennen wir Titel, Absender & Co. selbst aus dem Text.
              const doc = await api.getDocument(documentId);
              const suggestion = heuristicSuggestion(doc, item.file.name, { tags, correspondents, documentTypes });
              setReviews((prev) => [
                ...prev,
                { itemId: item.id, documentId, fileName: item.file.name, suggestion, source: "auto" },
              ]);
            }
          }
        } catch {
          // kein Fenster – das Dokument liegt trotzdem in der Liste
        }
        patch(item.id, { status: "done" });
      } catch (err) {
        patch(item.id, { status: "error", error: classifyUploadError(err) });
      }
    }
    setBusy(false);
    if (anyDone) onUploaded();
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || busy) return;
    const list: UploadItem[] = Array.from(files).map((file) => ({
      id: nextId++,
      file,
      status: "waiting",
    }));
    setItems(list);
    void uploadAll(list);
  }

  function retryFailed() {
    if (busy) return;
    const failed = items.filter((item) => item.status === "error");
    if (failed.length === 0) return;
    const ids = new Set(failed.map((item) => item.id));
    const reset = failed.map((item): UploadItem => ({ ...item, status: "waiting", error: undefined }));
    setItems((prev) => prev.map((item) => (ids.has(item.id) ? { ...item, status: "waiting", error: undefined } : item)));
    void uploadAll(reset);
  }

  function renderProgress(item: UploadItem) {
    if (item.status !== "uploading" && item.status !== "reading") return null;
    const labels: Record<UploadStage, string> = {
      uploading: t("uploadZone.stages.uploading"),
      processing: t("uploadZone.stages.processing"),
      done: t("uploadZone.status.done"),
    };
    const barLabel = t("uploadZone.progressBarLabel", { name: item.file.name });
    if (item.status === "uploading") {
      const parts = item.remainingSeconds == null ? null : remainingTimeParts(item.remainingSeconds);
      const remaining = parts
        ? t(`uploadZone.remaining_${parts.unit}`, { count: parts.value })
        : t("uploadZone.calculating");
      return (
        <UploadProgress
          stage="uploading"
          labels={labels}
          percent={item.percent ?? 0}
          barLabel={barLabel}
          detail={`${t("uploadZone.uploadPercent", { percent: item.percent ?? 0 })} – ${remaining}`}
        />
      );
    }
    const elapsed = formatElapsed(now - (item.phaseStartedAt ?? now));
    return (
      <UploadProgress
        stage="processing"
        labels={labels}
        barLabel={barLabel}
        detail={t("uploadZone.working", { elapsed })}
      />
    );
  }

  const hasError = items.some((item) => item.status === "error");
  const allDone =
    items.length > 0 && !busy && items.every((item) => item.status === "done");

  return (
    <section
      className={`upload-card ${isDragging ? "upload-card--active" : ""}`}
      aria-label={t("uploadZone.sectionAriaLabel")}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <button type="button" className="upload-card__main" disabled={busy} onClick={() => fileInputRef.current?.click()}>
        <span className="upload-card__main-icon" aria-hidden="true">
          +
        </span>
        {t("uploadZone.addButton")}
      </button>
      <button
        type="button"
        className="upload-card__camera"
        disabled={busy}
        onClick={() => cameraInputRef.current?.click()}
      >
        {t("uploadZone.cameraButton")}
      </button>
      <p className="upload-card__hint">{t("uploadZone.dropHint")}</p>

      {items.length > 0 && (
        <ul className="upload-card__list" aria-live="polite">
          {items.map((item) => (
            <li key={item.id} className={`upload-card__item upload-card__item--${item.status}`}>
              <span className="upload-card__name">{item.file.name}</span>
              <span className="upload-card__status">
                {item.status === "error" && item.error
                  ? t(`uploadZone.errors.${item.error}`)
                  : t(`uploadZone.status.${item.status}`)}
              </span>
              {renderProgress(item)}
            </li>
          ))}
        </ul>
      )}

      {allDone && (
        <p className="upload-card__success" role="status">
          {t("uploadZone.allDone", { count: items.length })}
        </p>
      )}
      {hasError && !busy && (
        <button type="button" className="upload-card__retry" onClick={retryFailed}>
          {t("uploadZone.retry")}
        </button>
      )}
      {reviews[0] && (
        <UploadReviewDialog
          key={reviews[0].documentId}
          documentId={reviews[0].documentId}
          fileName={reviews[0].fileName}
          suggestion={reviews[0].suggestion}
          source={reviews[0].source}
          tags={tags}
          correspondents={correspondents}
          documentTypes={documentTypes}
          onClose={(saved) => {
            setReviews((prev) => prev.slice(1));
            onMetadataChanged();
            if (saved) onUploaded();
          }}
        />
      )}
    </section>
  );
}
