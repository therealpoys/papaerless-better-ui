import { useRef, useState } from "react";
import { api } from "../lib/api";

interface UploadZoneProps {
  onUploaded: () => void;
}

export function UploadZone({ onUploaded }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        await api.uploadDocument(file);
      }
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload fehlgeschlagen");
    } finally {
      setIsUploading(false);
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
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="application/pdf,image/*,.eml"
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      {isUploading ? (
        <p>Lade hoch…</p>
      ) : (
        <p>Datei hierher ziehen oder klicken zum Auswählen</p>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
