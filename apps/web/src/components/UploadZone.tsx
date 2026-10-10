import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Correspondent, DocumentType, MetadataSuggestion, Tag } from "@papaerless/shared-types";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { api } from "../lib/api";
import { isNative } from "../lib/platform";
import { fileFromPhotoPath } from "../lib/photo";
import { UploadProgress, type UploadStage } from "@papaerless/ui";
import { UploadReviewDialog } from "./UploadReviewDialog";
import { CropDialog } from "./CropDialog";
import { isCroppable } from "../lib/crop";
import { heuristicSuggestion } from "../lib/uploadReview";
import { findDuplicate, type DuplicateChoice, type DuplicateHit } from "../lib/duplicates";
import { DuplicateDialog } from "./DuplicateDialog";
import {
  classifyUploadError,
  computeUploadProgress,
  formatElapsed,
  mergeUploadItems,
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
  /** Von außen angelieferte Dateien (z. B. "Teilen mit…"); laufen durch denselben Flow wie ausgewählte. */
  incomingFiles?: File[];
  onIncomingTaken?: () => void;
  /** "Vorhandenes öffnen" in der Duplikat-Warnung. */
  onOpenDocument?: (id: number) => void;
}

interface PendingReview {
  itemId: number;
  documentId: number;
  fileName: string;
  suggestion: MetadataSuggestion;
  source: "ai" | "auto";
}

type ItemStatus = "waiting" | "uploading" | "reading" | "done" | "error" | "skipped";

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
  incomingFiles,
  onIncomingTaken,
  onOpenDocument,
}: UploadZoneProps) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  /** Bilder, die noch zugeschnitten werden sollen (das erste ist gerade im Dialog) */
  const [cropQueue, setCropQueue] = useState<File[]>([]);
  const [cropTotal, setCropTotal] = useState(0);
  const queueRef = useRef<UploadItem[]>([]);
  const runningRef = useRef(false);
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

  const [duplicatePrompt, setDuplicatePrompt] = useState<{
    fileName: string;
    existing: DuplicateHit;
    resolve: (choice: DuplicateChoice) => void;
  } | null>(null);
  const onOpenDocumentRef = useRef(onOpenDocument);
  onOpenDocumentRef.current = onOpenDocument;

  function askDuplicate(fileName: string, existing: DuplicateHit): Promise<DuplicateChoice> {
    return new Promise((resolve) => setDuplicatePrompt({ fileName, existing, resolve }));
  }

  /** Lädt eine Datei hoch; liefert true, wenn der Upload geklappt hat. */
  async function processItem(item: UploadItem): Promise<boolean> {
    let uploaded = false;
    {
      const invalid = validateFile(item.file);
      if (invalid) {
        patch(item.id, { status: "error", error: invalid });
        return false;
      }
      // Dieselbe Datei schon in Paperless? Dann erst fragen (die Warteschlange wartet auf die Antwort).
      const existing = await findDuplicate(item.file, { lookup: api.findDuplicate });
      if (existing) {
        const choice = await askDuplicate(item.file.name, existing);
        if (choice !== "add") {
          patch(item.id, { status: "skipped" });
          if (choice === "open") onOpenDocumentRef.current?.(existing.id);
          return false;
        }
      }
      const uploadStart = Date.now();
      patch(item.id, { status: "uploading", error: undefined, percent: 0, remainingSeconds: null });
      try {
        const { taskId } = await api.uploadDocument(item.file, (loaded, total) => {
          const info = computeUploadProgress(loaded, total, Date.now() - uploadStart);
          patch(item.id, { percent: info.percent, remainingSeconds: info.remainingSeconds });
        });
        uploaded = true;
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
    return uploaded;
  }

  // Der Worker läuft mit dem jeweils neuesten processItem (aktuelle Tags, KI-Schalter usw.).
  const processItemRef = useRef(processItem);
  processItemRef.current = processItem;
  const onUploadedRef = useRef(onUploaded);
  onUploadedRef.current = onUploaded;

  /** Arbeitet die Warteschlange nacheinander ab. Neue Dateien können jederzeit dazukommen. */
  async function runQueue() {
    if (runningRef.current) return;
    runningRef.current = true;
    setBusy(true);
    let anyDone = false;
    let item: UploadItem | undefined;
    while ((item = queueRef.current.shift())) {
      if (await processItemRef.current(item)) anyDone = true;
    }
    runningRef.current = false;
    setBusy(false);
    if (anyDone) onUploadedRef.current();
  }

  function enqueue(list: UploadItem[]) {
    if (list.length === 0) return;
    setItems((prev) => mergeUploadItems(prev, list));
    queueRef.current.push(...list);
    void runQueue();
  }

  function enqueueFiles(files: File[]) {
    enqueue(files.map((file) => ({ id: nextId++, file, status: "waiting" as const })));
  }

  /** Bilder gehen erst durch den Zuschnitt-Dialog, PDFs und E-Mails direkt in den Upload. */
  function addFiles(files: File[]) {
    const images = files.filter(isCroppable);
    enqueueFiles(files.filter((file) => !isCroppable(file)));
    if (images.length === 0) return;
    setCropQueue((prev) => {
      if (prev.length === 0) setCropTotal(images.length);
      else setCropTotal((total) => total + images.length);
      return [...prev, ...images];
    });
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    addFiles(Array.from(files));
  }

  /** Aktuelles Bild aus dem Zuschnitt nehmen; bei `file` wird es (zugeschnitten) hochgeladen. */
  function finishCrop(file?: File) {
    if (file) enqueueFiles([file]);
    setCropQueue((prev) => {
      const rest = prev.slice(1);
      if (rest.length === 0) setCropTotal(0);
      return rest;
    });
  }

  /** Native App: Kamera-Plugin statt <input capture>; das Foto läuft durch denselben Upload-Flow. */
  async function takeNativePhoto() {
    try {
      const photo = await Camera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.Uri,
        quality: 90,
        correctOrientation: true,
      });
      if (!photo.webPath) return;
      const file = await fileFromPhotoPath(photo.webPath, photo.format);
      addFiles([file]);
    } catch {
      // Abbruch durch den Nutzer oder fehlende Berechtigung: nichts hochladen
    }
  }

  const addFilesRef = useRef(addFiles);
  addFilesRef.current = addFiles;
  useEffect(() => {
    if (!incomingFiles || incomingFiles.length === 0) return;
    addFilesRef.current(incomingFiles);
    onIncomingTaken?.();
  }, [incomingFiles, onIncomingTaken]);

  function retryFailed() {
    const failed = items.filter((item) => item.status === "error");
    if (failed.length === 0) return;
    const ids = new Set(failed.map((item) => item.id));
    setItems((prev) => prev.map((item) => (ids.has(item.id) ? { ...item, status: "waiting", error: undefined } : item)));
    queueRef.current.push(...failed.map((item): UploadItem => ({ ...item, status: "waiting", error: undefined })));
    void runQueue();
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
    items.length > 0 &&
    !busy &&
    items.some((item) => item.status === "done") &&
    items.every((item) => item.status === "done" || item.status === "skipped");

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

      <button type="button" className="upload-card__main" onClick={() => fileInputRef.current?.click()}>
        <span className="upload-card__main-icon" aria-hidden="true">
          +
        </span>
        {t("uploadZone.addButton")}
      </button>
      <button
        type="button"
        className="upload-card__camera"
        onClick={() => (isNative() ? void takeNativePhoto() : cameraInputRef.current?.click())}
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
      {cropQueue[0] && (
        <CropDialog
          key={`${cropQueue[0].name}-${cropQueue[0].lastModified}-${cropQueue[0].size}-${cropTotal - cropQueue.length}`}
          file={cropQueue[0]}
          position={
            cropTotal > 1
              ? t("crop.position", { current: cropTotal - cropQueue.length + 1, total: cropTotal })
              : undefined
          }
          onConfirm={(file) => finishCrop(file)}
          onUseOriginal={() => finishCrop(cropQueue[0])}
          onDiscard={() => finishCrop()}
        />
      )}
      {duplicatePrompt && (
        <DuplicateDialog
          fileName={duplicatePrompt.fileName}
          existing={duplicatePrompt.existing}
          onChoose={(choice) => {
            duplicatePrompt.resolve(choice);
            setDuplicatePrompt(null);
          }}
        />
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
