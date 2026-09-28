import { useSyncExternalStore } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { colors } from "@papaerless/ui/src/tokens";
import { uploadQueue } from "../lib/uploadQueue";

export function QueueScreen() {
  const { t } = useTranslation();
  const STATUS_LABEL: Record<string, string> = {
    uploading: t("queueScreen.status.uploading"),
    processing: t("queueScreen.status.processing"),
    needs_review: t("queueScreen.status.needs_review"),
    done: t("queueScreen.status.done"),
    failed: t("queueScreen.status.failed"),
  };
  const jobs = useSyncExternalStore(uploadQueue.subscribe, uploadQueue.getSnapshot);

  if (jobs.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>{t("queueScreen.empty")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.retryAll} onPress={() => uploadQueue.retryFailed()}>
        <Text style={styles.retryAllText}>{t("queueScreen.retryFailed")}</Text>
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
              <Text style={styles.remove}>{t("queueScreen.remove")}</Text>
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
