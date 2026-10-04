import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";

interface Props {
  documentId: number;
  /** Alternativtext; leer = rein dekorativ. */
  alt?: string;
  className?: string;
}

type State = "idle" | "loading" | "ready" | "error";

/** Vorschaubild eines Dokuments. Wird erst geladen, wenn es sichtbar wird (IntersectionObserver),
 * per Auth-Fetch als Blob geholt und als Object-URL angezeigt; die URL wird beim Unmount freigegeben. */
export function DocumentThumbnail({ documentId, alt = "", className = "" }: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<State>("idle");
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    let objectUrl: string | null = null;
    setState("loading");
    api
      .fetchThumbnail(documentId, controller.signal)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
        setState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setSrc(null);
    };
  }, [visible, documentId]);

  return (
    <div ref={ref} className={`doc-thumb doc-thumb--${state} ${className}`.trim()}>
      {state === "ready" && src ? (
        <img src={src} alt={alt} loading="lazy" />
      ) : state === "error" ? (
        <span className="doc-thumb__placeholder" role="img" aria-label={t("folders.thumbnailError")}>
          📄
        </span>
      ) : (
        <span className="doc-thumb__placeholder doc-thumb__placeholder--loading" aria-hidden="true" />
      )}
    </div>
  );
}
