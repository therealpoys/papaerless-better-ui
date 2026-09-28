import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Registriert Expo Push für Erinnerungen (Fälligkeiten, Vertragskündigungen).
 * Läuft still ins Leere auf Simulatoren/ohne Berechtigung – Push ist optional.
 */
export async function registerExpoPush(): Promise<void> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") return;

  const { data: token } = await Notifications.getExpoPushTokenAsync();
  await api.registerExpoPush(token);
}
