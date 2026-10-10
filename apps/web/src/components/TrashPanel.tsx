import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TrashList } from "@papaerless/shared-types";
import { Button, EmptyState, ErrorState } from "@papaerless/ui";
import { api } from "../lib/api";
import { friendlyError } from "../lib/errors";
import { daysLeftInTrash } from "../lib/trash";
import { ConfirmDialog } from "./ConfirmDialog";

interface TrashPanelProps {
  /** Nach Wiederherstellen/Löschen aufrufen, damit z. B. die Dokumentliste neu lädt. */
  onChanged?: () => void;
}

type Pending = { kind: "one"; id: number; title: string } | { kind: "all" } | null;

export function TrashPanel({ onChanged }: TrashPanelProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<TrashList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending>(null);

  const reload = useCallback(() => {
    setError(null);
    api
      .listTrash()
      .then(setData)
      .catch((err) => setError(friendlyError(err, t, t("trash.loadFailed"))));
  }, [t]);

  useEffect(reload, [reload]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      reload();
      onChanged?.();
    } catch (err) {
      setActionError(friendlyError(err, t, t("trash.actionFailed")));
    } finally {
      setBusy(false);
    }
  }

  function confirmPending() {
    const current = pending;
    setPending(null);
    if (current?.kind === "one") run(() => api.deleteFromTrash([current.id]));
    else if (current?.kind === "all") run(() => api.emptyTrash());
  }

  if (error) return <ErrorState message={error} onRetry={reload} retryLabel={t("common.retry")} />;
  if (!data) return <p>{t("trash.loading")}</p>;

  const { results, retentionDays } = data;

  return (
    <section className="trash">
      <p className="trash__hint">{t("trash.hint", { count: retentionDays })}</p>

      {results.length === 0 ? (
        <EmptyState title={t("trash.empty.title")} description={t("trash.empty.description")} />
      ) : (
        <>
          <div className="trash__toolbar">
            <Button variant="danger" disabled={busy} onClick={() => setPending({ kind: "all" })}>
              {t("trash.emptyAll")}
            </Button>
          </div>
          {actionError && <p role="alert" className="trash__error">{actionError}</p>}
          <ul className="reminder-list">
            {results.map((doc) => {
              const left = daysLeftInTrash(doc.deletedAt, retentionDays);
              return (
                <li key={doc.id} className="reminder-list__item">
                  <div>
                    <strong>{doc.title || t("documentDetail.untitledFallback")}</strong>
                    <div className="reminder-list__meta">
                      {t("trash.deletedOn", { date: new Date(doc.deletedAt).toLocaleDateString("de-DE") })} ·{" "}
                      {t("trash.daysLeft", { count: left })}
                    </div>
                  </div>
                  <div className="trash__actions">
                    <Button variant="secondary" disabled={busy} onClick={() => run(() => api.restoreFromTrash([doc.id]))}>
                      {t("trash.restore")}
                    </Button>
                    <Button
                      variant="danger"
                      disabled={busy}
                      onClick={() => setPending({ kind: "one", id: doc.id, title: doc.title })}
                    >
                      {t("trash.deleteForever")}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <ConfirmDialog
        open={pending !== null}
        title={
          pending?.kind === "all"
            ? t("trash.confirmEmpty.title", { count: results.length })
            : t("trash.confirmDelete.title")
        }
        cancelLabel={t("trash.cancel")}
        confirmLabel={pending?.kind === "all" ? t("trash.confirmEmpty.confirm") : t("trash.confirmDelete.confirm")}
        onCancel={() => setPending(null)}
        onConfirm={confirmPending}
      >
        {pending?.kind === "one" && <p className="confirm-dialog__doc">{pending.title}</p>}
        <p>{t("trash.irreversible")}</p>
      </ConfirmDialog>
    </section>
  );
}
