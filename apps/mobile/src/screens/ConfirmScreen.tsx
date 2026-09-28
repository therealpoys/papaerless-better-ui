import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { MetadataSuggestion } from "@papaerless/shared-types";
import { colors, confidenceLevel } from "@papaerless/ui/src/tokens";
import { api } from "../lib/api";

const CONFIDENCE_LABEL: Record<ReturnType<typeof confidenceLevel>, string> = {
  high: "sicher",
  medium: "eher unsicher",
  low: "unsicher",
};

export function ConfirmScreen() {
  const [aiEnabled, setAiEnabled] = useState(false);
  const [suggestions, setSuggestions] = useState<MetadataSuggestion[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const reload = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const status = await api.aiStatus();
      setAiEnabled(status.enabled);
      if (status.enabled) {
        setSuggestions(await api.listSuggestions());
      }
    } catch {
      // Backend evtl. nicht erreichbar – Liste bleibt einfach leer
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleAccept(suggestion: MetadataSuggestion) {
    await api.applySuggestion(suggestion.documentId, suggestion);
    reload();
  }

  async function handleReject(suggestion: MetadataSuggestion) {
    await api.dismissSuggestion(suggestion.documentId);
    reload();
  }

  if (!aiEnabled) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>
          KI-Erkennung ist deaktiviert (optional). Ohne Vorschläge gibt es hier nichts schnell zu
          bestätigen – Dokumente lassen sich trotzdem ganz normal in Paperless bearbeiten.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={reload} />}
    >
      {suggestions.length === 0 && <Text style={styles.empty}>Keine offenen Vorschläge.</Text>}

      {suggestions.map((suggestion) => (
        <View key={suggestion.documentId} style={styles.card}>
          <Text style={styles.title}>{suggestion.title ?? `Dokument #${suggestion.documentId}`}</Text>
          {suggestion.correspondent && <Text style={styles.meta}>{suggestion.correspondent}</Text>}
          {suggestion.tags && suggestion.tags.length > 0 && (
            <Text style={styles.meta}>{suggestion.tags.join(" · ")}</Text>
          )}
          <Text
            style={[
              styles.confidence,
              styles[`confidence_${confidenceLevel(suggestion.confidence)}` as const],
            ]}
          >
            {CONFIDENCE_LABEL[confidenceLevel(suggestion.confidence)]} ·{" "}
            {Math.round(suggestion.confidence * 100)}%
          </Text>

          <View style={styles.row}>
            <TouchableOpacity style={styles.acceptButton} onPress={() => handleAccept(suggestion)}>
              <Text style={styles.acceptText}>Übernehmen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rejectButton} onPress={() => handleReject(suggestion)}>
              <Text style={styles.rejectText}>Verwerfen</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  empty: { color: "#666", textAlign: "center", marginTop: 40 },
  card: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  title: { fontWeight: "700", fontSize: 15 },
  meta: { color: "#555", marginTop: 4 },
  confidence: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
    alignSelf: "flex-start",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  confidence_high: { color: colors.light.success, backgroundColor: colors.light.successBg },
  confidence_medium: { color: colors.light.warning, backgroundColor: colors.light.warningBg },
  confidence_low: { color: colors.light.danger, backgroundColor: colors.light.dangerBg },
  row: { flexDirection: "row", gap: 10, marginTop: 12 },
  acceptButton: {
    flex: 1,
    backgroundColor: colors.light.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  acceptText: { color: "#fff", fontWeight: "600" },
  rejectButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.light.danger,
  },
  rejectText: { color: colors.light.danger, fontWeight: "600" },
});
