import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@papaerless/ui";
import { api } from "../lib/api";
import { clampZoom, MAX_ZOOM, MIN_ZOOM, previewKind, stepZoom } from "../lib/preview";
import { DocumentThumbnail } from "./DocumentThumbnail";

interface Props {
  documentId: number;
  title: string;
}

/** Große Vorschau (Thumbnail der ersten Seite). Ein Klick lädt die Vollansicht (PDF/Bild) und zeigt
 * sie in einem Dialog – Bilder mit Zoom, PDFs mit allen Seiten – oder öffnet sie in einem neuen Tab. */
export function DocumentPreview({ documentId, title }: Props) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [kind, setKind] = useState<ReturnType<typeof previewKind>>("other");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [newTab, setNewTab] = useState(false);

  // Bei Dokumentwechsel alles zurücksetzen.
  useEffect(() => {
    setOpen(false);
    setStatus("idle");
    setBlobUrl(null);
    setZoom(MIN_ZOOM);
  }, [documentId]);

  useEffect(() => {
    if (status !== "loading") return;
    const controller = new AbortController();
    api
      .fetchPreview(documentId, controller.signal)
      .then((blob) => {
        setKind(previewKind(blob.type));
        setBlobUrl(URL.createObjectURL(blob));
        setStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
    return () => controller.abort();
  }, [status, documentId]);

  useEffect(() => {
    if (!blobUrl) return;
    return () => URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

  useEffect(() => {
    if (status === "ready" && newTab && blobUrl) {
      window.open(blobUrl, "_blank", "noopener");
      setNewTab(false);
    }
  }, [status, newTab, blobUrl]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  function openDialog() {
    setOpen(true);
    if (status === "idle" || status === "error") setStatus("loading");
  }

  function openInTab() {
    if (status === "ready" && blobUrl) {
      window.open(blobUrl, "_blank", "noopener");
    } else {
      setNewTab(true);
      if (status !== "loading") setStatus("loading");
    }
  }

  return (
    <div className="doc-preview">
      <button type="button" className="doc-preview__open" onClick={openDialog} aria-label={t("documentDetail.preview.open")}>
        <DocumentThumbnail documentId={documentId} alt={t("documentDetail.preview.alt")} />
      </button>
      <div className="doc-preview__actions">
        <Button variant="secondary" onClick={openDialog}>
          {t("documentDetail.preview.pdfPages")}
        </Button>
        <Button variant="secondary" onClick={openInTab}>
          {t("documentDetail.preview.openTab")}
        </Button>
      </div>
      {status === "error" && !open && (
        <p className="hint" role="alert">
          {t("documentDetail.preview.failed")}
        </p>
      )}

      <dialog
        ref={dialogRef}
        className="preview-dialog"
        aria-label={t("documentDetail.preview.dialogTitle")}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setOpen(false);
        }}
      >
        <div className="preview-dialog__bar">
          <strong>{title}</strong>
          {kind === "image" && status === "ready" && (
            <>
              <Button variant="secondary" onClick={() => setZoom((z) => stepZoom(z, -1))} disabled={zoom <= MIN_ZOOM}>
                {t("documentDetail.preview.zoomOut")}
              </Button>
              <Button variant="secondary" onClick={() => setZoom((z) => stepZoom(z, 1))} disabled={zoom >= MAX_ZOOM}>
                {t("documentDetail.preview.zoomIn")}
              </Button>
            </>
          )}
          <Button variant="secondary" onClick={openInTab} disabled={status !== "ready"}>
            {t("documentDetail.preview.openTab")}
          </Button>
          <Button onClick={() => setOpen(false)}>{t("documentDetail.preview.close")}</Button>
        </div>
        <div className="preview-dialog__body">
          {status === "loading" && <p aria-live="polite">{t("documentDetail.preview.loading")}</p>}
          {status === "error" && <p role="alert">{t("documentDetail.preview.failed")}</p>}
          {status === "ready" && blobUrl && kind === "image" && (
            <img src={blobUrl} alt={t("documentDetail.preview.alt")} style={{ width: `${clampZoom(zoom) * 100}%` }} />
          )}
          {status === "ready" && blobUrl && kind === "pdf" && (
            <iframe src={blobUrl} title={t("documentDetail.preview.dialogTitle")} />
          )}
          {status === "ready" && kind === "other" && <p>{t("documentDetail.preview.pdfFallback")}</p>}
        </div>
      </dialog>
    </div>
  );
}
