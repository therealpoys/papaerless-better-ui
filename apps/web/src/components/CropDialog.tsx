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
import {
  detectDocumentCorners,
  isAxisAligned,
  quadBounds,
  scaleQuad,
  warpPerspective,
  type Quad,
} from "../lib/edgeDetect";

/** Längste Kante, mit der die Erkennung bzw. Entzerrung im Canvas arbeitet. */
const DETECT_SIDE = 800;
const WARP_SIDE = 3000;

function readPixels(img: HTMLImageElement, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { pixels: ctx.getImageData(0, 0, canvas.width, canvas.height), scale };
}

/** Ecken des Dokuments in Pixeln des Originalbilds, oder null (nichts erkannt / Canvas nicht lesbar). */
function detectInImage(img: HTMLImageElement): Quad | null {
  try {
    const read = readPixels(img, DETECT_SIDE);
    if (!read) return null;
    const quad = detectDocumentCorners(read.pixels);
    return quad ? scaleQuad(quad, 1 / read.scale, 1 / read.scale) : null;
  } catch {
    return null;
  }
}

/** Entzerrt das Viereck (Originalpixel) und liefert eine JPEG-Datei. */
async function warpImage(img: HTMLImageElement, file: File, quad: Quad): Promise<File> {
  const read = readPixels(img, WARP_SIDE);
  if (!read) throw new Error("canvas");
  const warped = warpPerspective(read.pixels, scaleQuad(quad, read.scale, read.scale));
  if (!warped) throw new Error("warp");
  const canvas = document.createElement("canvas");
  canvas.width = warped.width;
  canvas.height = warped.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.putImageData(new ImageData(new Uint8ClampedArray(warped.data), warped.width, warped.height), 0, 0);
  const { type, extension } = CROP_OUTPUT;
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.92));
  if (!blob) throw new Error("toBlob");
  return new File([blob], croppedFileName(file.name, extension), { type });
}

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
  /** Automatisch erkannte Ecken (Originalpixel); null = nichts erkannt */
  const quadRef = useRef<Quad | null>(null);
  const [detection, setDetection] = useState<"none" | "found" | "missing">("none");

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

  /** Erkennt das Dokument und setzt den Rahmen darauf; ohne Treffer gilt das ganze Bild. */
  function autoDetect() {
    const img = imgRef.current;
    const display = sizeRef.current;
    if (!img || !display || !img.naturalWidth) return;
    const quad = detectInImage(img);
    quadRef.current = quad;
    setDetection(quad ? "found" : "missing");
    if (!quad) {
      setRect({ x: 0, y: 0, w: display.w, h: display.h });
      return;
    }
    const b = quadBounds(scaleQuad(quad, display.w / img.naturalWidth, display.h / img.naturalHeight));
    setRect({ x: b.x, y: b.y, w: Math.max(b.w, 1), h: Math.max(b.h, 1) });
  }

  function measure() {
    const img = imgRef.current;
    if (!img || !img.clientWidth || !img.clientHeight) return;
    const next = { w: img.clientWidth, h: img.clientHeight };
    const prev = sizeRef.current;
    sizeRef.current = next;
    setSize(next);
    if (!prev) {
      // Erstes Laden: erkannte Ecken als Vorauswahl
      autoDetect();
      return;
    }
    setRect((current) => {
      if (!current) return { x: 0, y: 0, w: next.w, h: next.h };
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
      const natural = { w: img.naturalWidth, h: img.naturalHeight };
      const source = toSourceRect(rect, size, natural);
      const quad = quadRef.current;
      if (quad) {
        // Rahmen unverändert aus der Erkennung und Dokument schief: Perspektive entzerren
        const auto = toSourceRect(quadBounds(quad), natural, natural);
        const tol = Math.max(3, natural.w * 0.005);
        const same =
          Math.abs(auto.x - source.x) <= tol &&
          Math.abs(auto.y - source.y) <= tol &&
          Math.abs(auto.w - source.w) <= tol &&
          Math.abs(auto.h - source.h) <= tol;
        if (same && !isAxisAligned(quad, natural.w * 0.01)) {
          try {
            onConfirm(await warpImage(img, file, quad));
            return;
          } catch {
            // Entzerren fehlgeschlagen: normal zuschneiden
          }
        }
      }
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
      <header className="crop-dialog__header">
        <h2 id={titleId} className="crop-dialog__title">
          {t("crop.title")}
          {position && <span className="crop-dialog__position">{position}</span>}
        </h2>
        <p className="crop-dialog__hint">{t("crop.hint")}</p>
        {detection !== "none" && (
          <p
            className={`crop-dialog__status crop-dialog__status--${detection}`}
            role="status"
            data-testid="crop-detection"
          >
            {t(detection === "found" ? "crop.detected" : "crop.notDetected")}
          </p>
        )}
      </header>

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

      <footer className="crop-dialog__actions">
        <button
          type="button"
          className="ui-button ui-button--primary crop-dialog__primary"
          disabled={!rect || working}
          onClick={() => void confirm()}
        >
          {working ? t("crop.working") : t("crop.confirm")}
        </button>
        <div className="crop-dialog__secondary">
          <button type="button" className="ui-button" disabled={!rect || working} onClick={autoDetect}>
            {t("crop.autoDetect")}
          </button>
          <button type="button" className="ui-button" disabled={working} onClick={onUseOriginal}>
            {t("crop.useOriginal")}
          </button>
          <button type="button" className="ui-button" disabled={working} onClick={onDiscard}>
            {t("crop.discard")}
          </button>
        </div>
      </footer>
    </dialog>
  );
}
