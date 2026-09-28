import { api } from "./api";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

/**
 * Registriert Web Push für Erinnerungen. Läuft ins Leere (still), wenn der
 * Browser das nicht unterstützt oder das Backend keinen VAPID-Key konfiguriert
 * hat (Feature "Später – Push-Benachrichtigungen" ist dann einfach inaktiv).
 */
export async function registerWebPush(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  const { publicKey } = await api.webPushPublicKey();
  if (!publicKey) return;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  const registration = await navigator.serviceWorker.register("/sw.js");
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    }));

  await api.registerWebPush(subscription.toJSON());
}
