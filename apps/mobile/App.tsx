import { useEffect, useState } from "react";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import "./src/i18n";
import { ScanScreen } from "./src/screens/ScanScreen";
import { QueueScreen } from "./src/screens/QueueScreen";
import { ConfirmScreen } from "./src/screens/ConfirmScreen";
import { RemindersScreen } from "./src/screens/RemindersScreen";
import { DocumentsScreen } from "./src/screens/DocumentsScreen";
import { registerExpoPush } from "./src/lib/push";

type Tab = "scan" | "queue" | "documents" | "confirm" | "reminders";

export default function App() {
  const { t } = useTranslation();
  const TABS: { key: Tab; label: string }[] = [
    { key: "scan", label: t("app.tabs.scan") },
    { key: "queue", label: t("app.tabs.queue") },
    { key: "documents", label: t("app.tabs.documents") },
    { key: "confirm", label: t("app.tabs.confirm") },
    { key: "reminders", label: t("app.tabs.reminders") },
  ];
  const [tab, setTab] = useState<Tab>("scan");

  useEffect(() => {
    registerExpoPush().catch((err) => console.warn("Push-Registrierung fehlgeschlagen:", err));
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />

      <View style={styles.content}>
        {tab === "scan" && <ScanScreen onUploaded={() => setTab("queue")} />}
        {tab === "queue" && <QueueScreen />}
        {tab === "documents" && <DocumentsScreen />}
        {tab === "confirm" && <ConfirmScreen />}
        {tab === "reminders" && <RemindersScreen />}
      </View>

      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={styles.tabButton}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  content: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#222",
    backgroundColor: "#111",
  },
  tabButton: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabLabel: { color: "#888", fontSize: 13 },
  tabLabelActive: { color: "#fff", fontWeight: "700" },
});
