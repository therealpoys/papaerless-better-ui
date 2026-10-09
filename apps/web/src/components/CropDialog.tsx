import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  adjustRect,
  CROP_OUTPUT,
  croppedFileName,
  isFullRect,
  toSourceRect,
  type CropHandle,
  type Rect,
  type Size,
} from "../lib/crop";

interface CropDialogProps {
  file: File;
  /** z. B. "Bild 2 von 3"; leer bei einem einzelnen Bild */
  position?: string;
  /** Zugeschnittenes (oder, wenn nichts verändert wurde, das ursprüngliche) Bild hochladen */
  onConfirm: (file: File) => void;
  /** Original ohne Zuschnitt hochladen */
  onUseOriginal: () => void;
  /** Dieses Bild nicht hochladen */
  onDiscard: () => void;
}

const HANDLES: CropHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/** Schneidet das Bild in einem Canvas zu und liefert eine neue Datei. */
async function cropImage(img: HTMLImageElement, file: File, source: Rect): Promise<File> {
  const { type, extension } = CROP_OUTPUT;
  const canvas = document.createElement("canvas");
  canvas.width = source.w;
  canvas.height = source.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#fff"; // JPEG kennt keine Transparenz
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, source.x, source.y, source.w, source.h, 0, 0, source.w, source.h);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.92));
  if (!blob) throw new Error("toBlob");
  return new File([blob], croppedFileName(file.name, extension), { type });
}

export function CropDialog({ file, position, onConfirm, onUseOriginal, onDiscard }: CropDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ handle: CropHandle; x: number; y: number; rect: Rect } | null>(null);
  const sizeRef = useRef<Size | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [failed, setFailed] = useState(false);
  const [working, setWorking] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  // Die URL im Effekt anlegen und wieder freigeben (React StrictMode führt Effekte im Dev-Modus doppelt aus).
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // Format nicht darstellbar (z. B. HEIC im Browser): kein Zuschnitt möglich, Original hochladen.
  useEffect(() => {
    if (failed) onUseOriginal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failed]);

  function measure() {
    const img = imgRef.current;
    if (!img || !img.clientWidth || !img.clientHeight) return;
    const next = { w: img.clientWidth, h: img.clientHeight };
    const prev = sizeRef.current;
    sizeRef.current = next;
    setSize(next);
    setRect((current) => {
      if (!current || !prev) return { x: 0, y: 0, w: next.w, h: next.h };
      // Bei geänderter Anzeigegröße (Drehen, Fenster) den Rahmen mitskalieren.
      const fx = next.w / prev.w;
      const fy = next.h / prev.h;
      return { x: current.x * fx, y: current.y * fy, w: current.w * fx, h: current.h * fy };
    });
  }

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  });

  function startDrag(handle: CropHandle, e: React.PointerEvent) {
    if (!rect) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { handle, x: e.clientX, y: e.clientY, rect };
  }

  function moveDrag(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || !size) return;
    setRect(adjustRect(d.rect, d.handle, e.clientX - d.x, e.clientY - d.y, size));
  }

  function endDrag() {
    drag.current = null;
  }

  async function confirm() {
    const img = imgRef.current;
    if (!img || !rect || !size) return;
    if (isFullRect(rect, size)) {
      onConfirm(file);
      return;
    }
    setWorking(true);
    try {
      const source = toSourceRect(rect, size, { w: img.naturalWidth, h: img.naturalHeight });
      onConfirm(await cropImage(img, file, source));
    } catch {
      // Zuschnitt nicht möglich: lieber das Original hochladen als gar nichts
      onUseOriginal();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="crop-dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onDiscard();
      }}
    >
      <h2 id={titleId} className="crop-dialog__title">
        {t("crop.title")}
        {position && <span className="crop-dialog__position"> – {position}</span>}
      </h2>
      <p className="crop-dialog__hint">{t("crop.hint")}</p>

      <div className="crop-dialog__stage">
        <div className="crop-dialog__frame">
          <img
            ref={imgRef}
            src={url ?? undefined}
            alt={t("crop.imageAlt", { name: file.name })}
            className="crop-dialog__image"
            draggable={false}
            onLoad={measure}
            onError={() => setFailed(true)}
          />
          {rect && size && (
            <div
              className="crop-dialog__box"
              data-testid="crop-box"
              style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
              onPointerDown={(e) => startDrag("move", e)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              {HANDLES.map((handle) => (
                <span
                  key={handle}
                  className={`crop-dialog__handle crop-dialog__handle--${handle}`}
                  data-handle={handle}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    startDrag(handle, e);
                  }}
                  onPointerMove={(e) => {
                    e.stopPropagation();
                    moveDrag(e);
                  }}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="crop-dialog__actions">
        <button
          type="button"
          className="ui-button ui-button--primary"
          disabled={!rect || working}
          onClick={() => void confirm()}
        >
          {t("crop.confirm")}
        </button>
        <button type="button" className="ui-button" disabled={working} onClick={onUseOriginal}>
          {t("crop.useOriginal")}
        </button>
        <button type="button" className="ui-button" disabled={working} onClick={onDiscard}>
          {t("crop.discard")}
        </button>
      </div>
    </dialog>
  );
}
