import { useSyncExternalStore } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "@papaerless/ui/src/tokens";
import { uploadQueue } from "../lib/uploadQueue";

const STATUS_LABEL: Record<string, string> = {
  uploading: "Lädt hoch…",
  processing: "Wird von Paperless verarbeitet…",
  needs_review: "Prüfung nötig",
  done: "Fertig",
  failed: "Fehlgeschlagen",
};

export function QueueScreen() {
  const jobs = useSyncExternalStore(uploadQueue.subscribe, uploadQueue.getSnapshot);

  if (jobs.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>Keine Uploads in der Warteschlange.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.retryAll} onPress={() => uploadQueue.retryFailed()}>
        <Text style={styles.retryAllText}>Fehlgeschlagene erneut versuchen</Text>
      </TouchableOpacity>

      <FlatList
        data={jobs}
        keyExtractor={(job) => job.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.fileName}</Text>
              <Text
                style={[styles.itemStatus, item.status === "failed" && styles.itemStatusError]}
              >
                {STATUS_LABEL[item.status] ?? item.status}
                {item.error ? `: ${item.error}` : ""}
              </Text>
            </View>
            <TouchableOpacity onPress={() => uploadQueue.remove(item.id)}>
              <Text style={styles.remove}>Entfernen</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  empty: { color: "#666", textAlign: "center", marginTop: 40 },
  retryAll: { alignSelf: "flex-end", marginBottom: 12 },
  retryAllText: { color: colors.light.accent, fontSize: 13 },
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  itemInfo: { flex: 1 },
  itemName: { fontWeight: "600" },
  itemStatus: { color: "#666", fontSize: 12, marginTop: 2 },
  itemStatusError: { color: colors.light.danger },
  remove: { color: colors.light.danger, fontSize: 13 },
});
