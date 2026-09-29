import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import type { Correspondent, DocumentType, PaperlessDocument, Tag } from "@papaerless/shared-types";
import { colors } from "@papaerless/ui/src/tokens";
import { api } from "../lib/api";
import { DocumentDetailScreen } from "./DocumentDetailScreen";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

export function DocumentsScreen() {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [docs, setDocs] = useState<PaperlessDocument[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [correspondents, setCorrespondents] = useState<Correspondent[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // Verwirft Antworten veralteter Anfragen (schnelles Tippen / Refresh während Paginierung)
  const requestSeq = useRef(0);

  // Debounce: erst nach kurzer Tipp-Pause wird gesucht
  useEffect(() => {
    const handle = setTimeout(() => setQuery(input.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [input]);

  const loadMetadata = useCallback(() => {
    Promise.all([api.listTags(), api.listCorrespondents(), api.listDocumentTypes()])
      .then(([tg, co, dt]) => {
        setTags(tg);
        setCorrespondents(co);
        setDocumentTypes(dt);
      })
      .catch(() => {
        // Nur Anzeige-Namen; die Liste bleibt ohne sie nutzbar.
      });
  }, []);

  useEffect(loadMetadata, [loadMetadata]);

  const load = useCallback(
    async (targetPage: number, mode: "replace" | "append") => {
      const seq = ++requestSeq.current;
      setIsLoading(true);
      try {
        const res = await api.listDocuments({ query: query || undefined, page: targetPage, pageSize: PAGE_SIZE });
        if (seq !== requestSeq.current) return;
        setDocs((cur) => (mode === "append" ? [...cur, ...res.results] : res.results));
        setCount(res.count);
        setPage(targetPage);
        setError(null);
      } catch (err) {
        if (seq !== requestSeq.current) return;
        setError(err instanceof Error ? err.message : t("documentsScreen.loadFailed"));
      } finally {
        if (seq === requestSeq.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [query, t],
  );

  useEffect(() => {
    load(1, "replace");
  }, [load]);

  function handleRefresh() {
    setIsRefreshing(true);
    loadMetadata();
    load(1, "replace");
  }

  function handleEndReached() {
    if (isLoading || docs.length === 0 || docs.length >= count) return;
    load(page + 1, "append");
  }

  if (selectedId !== null) {
    return (
      <DocumentDetailScreen
        documentId={selectedId}
        tags={tags}
        correspondents={correspondents}
        documentTypes={documentTypes}
        onBack={() => setSelectedId(null)}
        onSaved={(updated) => setDocs((cur) => cur.map((d) => (d.id === updated.id ? updated : d)))}
      />
    );
  }

  const tagName = (id: number) => tags.find((x) => x.id === id)?.name;
  const correspondentName = (id: number | null) =>
    id === null ? undefined : correspondents.find((x) => x.id === id)?.name;

  const isInitialLoad = isLoading && docs.length === 0 && !error;

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        value={input}
        onChangeText={setInput}
        placeholder={t("documentsScreen.searchPlaceholder")}
        accessibilityLabel={t("documentsScreen.searchAriaLabel")}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
      />

      {error && docs.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => load(1, "replace")}>
            <Text style={styles.retryText}>{t("documentsScreen.retry")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={docs}
          keyExtractor={(d) => String(d.id)}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            docs.length > 0 ? <Text style={styles.count}>{t("documentsScreen.count", { count })}</Text> : null
          }
          ListEmptyComponent={
            isInitialLoad ? (
              <ActivityIndicator style={styles.spinner} />
            ) : (
              <Text style={styles.empty}>
                {query ? t("documentsScreen.noResults", { query }) : t("documentsScreen.empty")}
              </Text>
            )
          }
          ListFooterComponent={
            docs.length > 0 && isLoading ? (
              <Text style={styles.footer}>{t("documentsScreen.loadingMore")}</Text>
            ) : error ? (
              <TouchableOpacity style={styles.retryButton} onPress={() => load(page + 1, "append")}>
                <Text style={styles.retryText}>
                  {error} – {t("documentsScreen.retry")}
                </Text>
              </TouchableOpacity>
            ) : null
          }
          renderItem={({ item }) => {
            const corr = correspondentName(item.correspondent);
            return (
              <TouchableOpacity style={styles.card} onPress={() => setSelectedId(item.id)}>
                <Text style={styles.title}>{item.title || t("documentsScreen.untitled")}</Text>
                <Text style={styles.meta}>
                  {new Date(item.created).toLocaleDateString("de-DE")}
                  {corr ? ` · ${corr}` : ""}
                </Text>
                {item.tags.length > 0 && (
                  <View style={styles.tagRow}>
                    {item.tags.map((id) => {
                      const name = tagName(id);
                      return name ? (
                        <View key={id} style={styles.chip}>
                          <Text style={styles.chipText}>{name}</Text>
                        </View>
                      ) : null;
                    })}
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center" },
  search: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 15,
  },
  count: { color: "#666", fontSize: 12, marginBottom: 8 },
  spinner: { marginTop: 40 },
  empty: { color: "#666", textAlign: "center", marginTop: 40 },
  footer: { color: "#666", textAlign: "center", paddingVertical: 12 },
  retryButton: { alignSelf: "center", marginTop: 12 },
  retryText: { color: colors.light.accent, fontWeight: "600" },
  card: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 14, marginBottom: 12 },
  title: { fontWeight: "700", fontSize: 15 },
  meta: { color: "#666", fontSize: 12, marginTop: 4 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chip: { borderWidth: 1, borderColor: "#ccc", borderRadius: 12, paddingVertical: 2, paddingHorizontal: 8 },
  chipText: { fontSize: 11, color: "#444" },
});
