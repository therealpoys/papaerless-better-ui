import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import jsQR from "jsqr";

interface Props {
  onCode: (text: string) => void;
  onCancel: () => void;
}

type BarcodeDetectorLike = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike;

/** Kamera-Vorschau, die QR-Codes liest (BarcodeDetector, sonst jsQR). Stoppt die Kamera beim Schließen. */
export function QrScanner({ onCode, onCancel }: Props) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<"unsupported" | "denied" | null>(null);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer = 0;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("unsupported");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
      } catch {
        setError("denied");
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((tr) => tr.stop());
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);

      const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
      const detector = Detector ? new Detector({ formats: ["qr_code"] }) : null;
      const canvas = document.createElement("canvas");

      const tick = async () => {
        if (stopped) return;
        if (video.readyState >= 2 && video.videoWidth > 0) {
          let text: string | null = null;
          try {
            if (detector) {
              text = (await detector.detect(video))[0]?.rawValue ?? null;
            } else {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext("2d", { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(video, 0, 0);
                const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
                text = jsQR(img.data, img.width, img.height)?.data ?? null;
              }
            }
          } catch {
            // einzelnes Bild nicht lesbar: nächstes versuchen
          }
          if (text && !stopped) {
            stopped = true;
            onCode(text);
            return;
          }
        }
        timer = window.setTimeout(() => void tick(), 200);
      };
      void tick();
    }
    void start();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
    // onCode absichtlich nicht als Abhängigkeit: die Kamera soll nicht neu starten
  }, []);

  return (
    <div className="qr-scanner">
      {error ? (
        <p className="settings-panel__error" role="alert">
          {t(`qr.scanner.${error}`)}
        </p>
      ) : (
        <>
          <video ref={videoRef} className="qr-scanner__video" playsInline muted aria-label={t("qr.scanner.preview")} />
          <p className="settings-panel__hint">{t("qr.scanner.hint")}</p>
        </>
      )}
      <button type="button" className="server-url__force" onClick={onCancel}>
        {t("qr.scanner.close")}
      </button>
    </div>
  );
}
