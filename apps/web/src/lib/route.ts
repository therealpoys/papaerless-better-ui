import type { DocumentSearchParams, DocumentSortField, SortOrder } from "@papaerless/shared-types";

export type SimpleTab = "home" | "inbox" | "reminders" | "expenses" | "settings" | "help" | "trash";

export type Route =
  | { tab: SimpleTab }
  | { tab: "documents"; documentId: number | null; filters: DocumentSearchParams; page: number }
  | { tab: "folders"; folderId: string | null; documentId: number | null };

export type Tab = Route["tab"];

const SIMPLE_TABS: SimpleTab[] = ["inbox", "reminders", "expenses", "trash", "settings", "help"];
const SORT_FIELDS: DocumentSortField[] = ["created", "added", "title", "score"];

function toId(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n > 0 ? n : null;
}

function toNumber(value: string | null): number | undefined {
  if (value === null) return undefined;
  return toId(value) ?? undefined;
}

/** Liest eine URL (Pfad + Query) in eine Route. Unbekanntes landet auf der Startseite. */
export function parseRoute(pathname: string, search: string): Route {
  const [first, second, third, fourth] = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(search);

  if (first === "documents") {
    const filters: DocumentSearchParams = {};
    const query = params.get("q");
    if (query) filters.query = query;
    const tags = (params.get("tags") ?? "")
      .split(",")
      .map((s) => toId(s))
      .filter((n): n is number => n !== null);
    if (tags.length > 0) filters.tags = tags;
    const correspondent = toNumber(params.get("correspondent"));
    if (correspondent) filters.correspondent = correspondent;
    const documentType = toNumber(params.get("type"));
    if (documentType) filters.documentType = documentType;
    const from = params.get("from");
    if (from) filters.dateFrom = from;
    const to = params.get("to");
    if (to) filters.dateTo = to;
    const sort = params.get("sort") as DocumentSortField | null;
    if (sort && SORT_FIELDS.includes(sort)) {
      filters.sort = sort;
      const order = params.get("order");
      if (order === "asc" || order === "desc") filters.sortOrder = order as SortOrder;
    }
    return { tab: "documents", documentId: toId(second), filters, page: toNumber(params.get("page")) ?? 1 };
  }

  if (first === "folders") {
    const folderId = second ?? null;
    return {
      tab: "folders",
      folderId,
      documentId: folderId && third === "documents" ? toId(fourth) : null,
    };
  }

  if (SIMPLE_TABS.includes(first as SimpleTab)) return { tab: first as SimpleTab };
  return { tab: "home" };
}

/** Gegenstück zu parseRoute: baut Pfad + Query für eine Route. */
export function buildPath(route: Route): string {
  switch (route.tab) {
    case "home":
      return "/";
    case "documents": {
      const { filters, page } = route;
      const params = new URLSearchParams();
      if (filters.query) params.set("q", filters.query);
      if (filters.tags?.length) params.set("tags", filters.tags.join(","));
      if (filters.correspondent) params.set("correspondent", String(filters.correspondent));
      if (filters.documentType) params.set("type", String(filters.documentType));
      if (filters.dateFrom) params.set("from", filters.dateFrom);
      if (filters.dateTo) params.set("to", filters.dateTo);
      if (filters.sort) {
        params.set("sort", filters.sort);
        if (filters.sortOrder) params.set("order", filters.sortOrder);
      }
      if (page > 1) params.set("page", String(page));
      const qs = params.toString();
      return `/documents${route.documentId ? `/${route.documentId}` : ""}${qs ? `?${qs}` : ""}`;
    }
    case "folders": {
      if (!route.folderId) return "/folders";
      const base = `/folders/${encodeURIComponent(route.folderId)}`;
      return route.documentId ? `${base}/documents/${route.documentId}` : base;
    }
    default:
      return `/${route.tab}`;
  }
}
