import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ErrorState, UploadProgress, type UploadStage } from "@papaerless/ui";
import { api } from "../lib/api";

interface UploadZoneProps {
  onUploaded: () => void;
}

/** OCR läuft asynchron in Paperless – wir wissen nicht, wann es fertig ist, geben aber
 * eine grobe Schätzung als "wird verarbeitet"-Phase aus, statt den Fortschritt einfach
 * verschwinden zu lassen (siehe Roadmap "Upload-Flow: Fortschritt sichtbar machen"). */
const PROCESSING_HINT_MS = 3000;

export function UploadZone({ onUploaded }: UploadZoneProps) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [stage, setStage] = useState<UploadStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFiles, setLastFiles] = useState<FileList | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setLastFiles(files);
    setStage("uploading");
    setError(null);
    try {
      for (const file of Array.from(files)) {
        await api.uploadDocument(file);
      }
      setStage("processing");
      setTimeout(() => {
        setStage("done");
        onUploaded();
        setTimeout(() => setStage(null), 1500);
      }, PROCESSING_HINT_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("uploadZone.uploadFailed"));
      setStage(null);
    }
  }

  return (
    <div
      className={`upload-zone ${isDragging ? "upload-zone--active" : ""}`}
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
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={t("uploadZone.dropAreaAriaLabel")}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="application/pdf,image/*,.eml"
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      {stage ? (
        <UploadProgress
          stage={stage}
          labels={{
            uploading: t("uploadZone.progress.uploading"),
            processing: t("uploadZone.progress.processing"),
            done: t("uploadZone.progress.done"),
          }}
        />
      ) : (
        <p>{t("uploadZone.dropAreaLabel")}</p>
      )}
      {error && (
        <ErrorState message={error} onRetry={() => handleFiles(lastFiles)} retryLabel={t("common.retry")} />
      )}
    </div>
  );
}
