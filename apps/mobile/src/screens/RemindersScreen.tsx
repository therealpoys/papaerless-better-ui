import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { Reminder } from "@papaerless/shared-types";
import { colors } from "@papaerless/ui/src/tokens";
import { api } from "../lib/api";

const KIND_LABEL: Record<Reminder["kind"], string> = {
  due_date: "Fälligkeit",
  cancellation_deadline: "Kündigungsfrist",
};

/**
 * Nur Ansicht + Erledigt-Markieren: Erinnerungen werden bisher nur im Web
 * (Dokument-Detail) angelegt, da die Mobile-App keine Dokumentliste/-detail
 * hat, von wo aus man das tun könnte.
 */
export function RemindersScreen() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsRefreshing(true);
    try {
      setReminders(await api.listReminders());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Laden fehlgeschlagen");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleDismiss(id: string) {
    await api.dismissReminder(id);
    reload();
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={reload}>
          <Text style={styles.retryText}>Erneut versuchen</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={reload} />}
    >
      {reminders.length === 0 && (
        <Text style={styles.empty}>
          Keine Erinnerungen. Im Web unter „Dokumente" lässt sich am Dokument eine Erinnerung
          anlegen (z.B. für Vertragskündigungen oder Zahlungsfristen).
        </Text>
      )}

      {reminders.map((r) => {
        const isOverdue = new Date(r.dueDate) < new Date();
        return (
          <View key={r.id} style={[styles.card, isOverdue && styles.cardOverdue]}>
            <Text style={styles.title}>{r.documentTitle}</Text>
            <Text style={styles.meta}>
              {KIND_LABEL[r.kind]} · fällig {new Date(r.dueDate).toLocaleDateString("de-DE")}
              {isOverdue ? " · überfällig" : ""}
              {r.note ? ` · ${r.note}` : ""}
            </Text>
            <TouchableOpacity style={styles.doneButton} onPress={() => handleDismiss(r.id)}>
              <Text style={styles.doneText}>Erledigt</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  empty: { color: "#666", textAlign: "center", marginTop: 40 },
  retryButton: { alignSelf: "center", marginTop: 12 },
  retryText: { color: colors.light.accent, fontWeight: "600" },
  card: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  cardOverdue: { borderColor: colors.light.danger },
  title: { fontWeight: "700", fontSize: 15 },
  meta: { color: "#666", fontSize: 12, marginTop: 4 },
  doneButton: {
    alignSelf: "flex-start",
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.light.accent,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  doneText: { color: colors.light.accent, fontWeight: "600", fontSize: 13 },
});
