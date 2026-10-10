import { useEffect } from "react";

export interface UndoToastData {
  /** Ändert sich pro Hinweis, damit der Timer bei einem neuen Hinweis neu startet. */
  id: number;
  message: string;
  actionLabel: string;
  onAction: () => void;
}

interface UndoToastProps {
  toast: UndoToastData | null;
  durationMs: number;
  onDismiss: () => void;
}

/** Kurzer Hinweis unten am Bildschirm mit einer Aktion (z. B. "Rückgängig"). */
export function UndoToast({ toast, durationMs, onDismiss }: UndoToastProps) {
  const toastId = toast?.id;
  useEffect(() => {
    if (toastId === undefined) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [toastId, durationMs, onDismiss]);

  if (!toast) return null;
  return (
    <div className="undo-toast" role="status" aria-live="polite">
      <span>{toast.message}</span>
      <button type="button" className="undo-toast__action" onClick={toast.onAction}>
        {toast.actionLabel}
      </button>
    </div>
  );
}
