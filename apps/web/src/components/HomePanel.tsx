import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  Correspondent,
  DocumentType,
  Folder,
  FolderCriterion,
  PaperlessDocument,
  Reminder,
  Tag,
} from "@papaerless/shared-types";
import { Button, EmptyState } from "@papaerless/ui";
import { api } from "../lib/api";
import { criterionName } from "../lib/folders";
import { daysAgo, monthStart, summarizeReminders, topByCount, type RankedItem } from "../lib/dashboard";
import { DocumentThumbnail } from "./DocumentThumbnail";
import { FolderTile } from "./FoldersPanel";

type TabTarget = "documents" | "folders" | "inbox" | "reminders";

interface Props {
  tags: Tag[];
  correspondents: Correspondent[];
  documentTypes: DocumentType[];
  aiEnabled: boolean;
  onOpenDocument: (id: number) => void;
  onOpenFolder: (id: string) => void;
  onNavigate: (tab: TabTarget) => void;
}

const FOLDER_LIMIT = 4;
const RECENT_LIMIT = 6;

interface Counts {
  total: number;
  month: number;
  week: number;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("de-DE");
}

function Stat({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  const body = (
    <>
      <span className="home-stat__value">{value}</span>
      <span className="home-stat__label">{label}</span>
    </>
  );
  return onClick ? (
    <button type="button" className="home-stat home-stat--link" onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="home-stat">{body}</div>
  );
}

function BarList({ title, items, empty }: { title: string; items: RankedItem[]; empty: string }) {
  return (
    <section className="home-card">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="home-muted">{empty}</p>
      ) : (
        <ul className="home-bars">
          {items.map((i) => (
            <li key={i.id}>
              <span className="home-bars__name">{i.name}</span>
              <span className="home-bars__track" aria-hidden="true">
                <span className="home-bars__fill" style={{ width: `${Math.max(4, i.share * 100)}%` }} />
              </span>
              <span className="home-bars__count">{i.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function HomePanel({
  tags,
  correspondents,
  documentTypes,
  aiEnabled,
  onOpenDocument,
  onOpenFolder,
  onNavigate,
}: Props) {
  const { t } = useTranslation();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [recent, setRecent] = useState<PaperlessDocument[] | null>(null);
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [reminders, setReminders] = useState<Reminder[] | null>(null);
  const [inboxCount, setInboxCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    const count = (extra: { dateFrom?: string }) =>
      api.listDocuments({ ...extra, pageSize: 1 }).then((r) => r.count);
    Promise.all([count({}), count({ dateFrom: monthStart(now) }), count({ dateFrom: daysAgo(now, 6) })])
      .then(([total, month, week]) => !cancelled && setCounts({ total, month, week }))
      .catch(() => {});
    api
      .listDocuments({ pageSize: RECENT_LIMIT, sort: "created", sortOrder: "desc" })
      .then((r) => !cancelled && setRecent(r.results))
      .catch(() => !cancelled && setRecent([]));
    api.listFolders().then((f) => !cancelled && setFolders(f)).catch(() => !cancelled && setFolders([]));
    api.listReminders().then((r) => !cancelled && setReminders(r)).catch(() => !cancelled && setReminders([]));
    if (aiEnabled) {
      api.listSuggestions().then((s) => !cancelled && setInboxCount(s.length)).catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [aiEnabled]);

  const lookups = { tags, correspondents, documentTypes };
  function labelFor(criterion: FolderCriterion): string {
    const name = criterionName(criterion, lookups) ?? t("folders.unknownCriterion");
    return `${t(`folders.kinds.${criterion.kind}`)}: ${name}`;
  }

  const reminderSummary = summarizeReminders(reminders ?? [], new Date());
  const dash = "–";

  return (
    <div className="home">
      <h2>{t("home.title")}</h2>

      <div className="home-stats">
        <Stat label={t("home.stats.total")} value={counts ? String(counts.total) : dash} onClick={() => onNavigate("documents")} />
        <Stat label={t("home.stats.month")} value={counts ? String(counts.month) : dash} />
        <Stat label={t("home.stats.week")} value={counts ? String(counts.week) : dash} />
        {aiEnabled && (
          <Stat
            label={t("home.stats.inbox")}
            value={inboxCount === null ? dash : String(inboxCount)}
            onClick={() => onNavigate("inbox")}
          />
        )}
        <Stat
          label={t("home.stats.reminders")}
          value={reminders ? String(reminders.length) : dash}
          onClick={() => onNavigate("reminders")}
        />
      </div>

      <section className="home-section">
        <div className="folders__toolbar">
          <h3>{t("home.folders")}</h3>
          <Button variant="secondary" onClick={() => onNavigate("folders")}>
            {t("home.allFolders")}
          </Button>
        </div>
        {folders === null ? (
          <p role="status" className="home-muted">{t("folders.loading")}</p>
        ) : folders.length === 0 ? (
          <EmptyState
            title={t("folders.empty.title")}
            description={t("folders.empty.description")}
            action={<Button onClick={() => onNavigate("folders")}>{t("folders.create")}</Button>}
          />
        ) : (
          <div className="folders__grid">
            {folders.slice(0, FOLDER_LIMIT).map((f) => (
              <FolderTile
                key={f.id}
                folder={f}
                criterionLabel={labelFor(f.criterion)}
                reloadKey={0}
                onOpen={() => onOpenFolder(f.id)}
              />
            ))}
          </div>
        )}
      </section>

      {reminders && reminders.length > 0 && (
        <section className="home-card">
          <h3>
            {t("home.upcoming")}
            {reminderSummary.overdue > 0 && (
              <span className="home-badge">{t("home.overdue", { count: reminderSummary.overdue })}</span>
            )}
          </h3>
          <ul className="home-list">
            {reminderSummary.upcoming.map((r) => (
              <li key={r.id}>
                <button type="button" className="home-link" onClick={() => onOpenDocument(r.documentId)}>
                  {r.documentTitle}
                </button>
                <span className="home-muted">
                  {t(`remindersPanel.kind.${r.kind}`)} · {formatDate(r.dueDate)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="home-section">
        <h3>{t("home.recent")}</h3>
        {recent === null ? (
          <p role="status" className="home-muted">{t("folders.loading")}</p>
        ) : recent.length === 0 ? (
          <p className="home-muted">{t("home.recentEmpty")}</p>
        ) : (
          <div className="folders__grid folders__grid--docs">
            {recent.map((d) => {
              const sender = correspondents.find((c) => c.id === d.correspondent)?.name;
              return (
                <button key={d.id} type="button" className="folder-doc" onClick={() => onOpenDocument(d.id)}>
                  <DocumentThumbnail documentId={d.id} className="folder-doc__thumb" />
                  <span className="folder-doc__title">{d.title}</span>
                  <span className="folder-doc__meta">
                    {[sender, formatDate(d.created)].filter(Boolean).join(" · ")}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <div className="home-cards">
        <BarList title={t("home.top.correspondents")} items={topByCount(correspondents)} empty={t("home.top.empty")} />
        <BarList title={t("home.top.documentTypes")} items={topByCount(documentTypes)} empty={t("home.top.empty")} />
        <BarList title={t("home.top.tags")} items={topByCount(tags)} empty={t("home.top.empty")} />
      </div>
    </div>
  );
}
