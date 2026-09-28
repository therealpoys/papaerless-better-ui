import webPush from "web-push";
import { env } from "./env.js";
import { pushStore } from "./push-store.js";

const webPushConfigured = Boolean(env.webPushPublicKey && env.webPushPrivateKey);
if (webPushConfigured) {
  webPush.setVapidDetails(env.webPushContactEmail, env.webPushPublicKey!, env.webPushPrivateKey!);
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

async function sendExpoPush(token: string, payload: PushPayload): Promise<void> {
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(process.env.EXPO_ACCESS_TOKEN
        ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({
      to: token,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
    }),
  });
}

export async function broadcastPush(payload: PushPayload): Promise<void> {
  const subscriptions = await pushStore.list();

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        if (sub.kind === "web" && webPushConfigured && sub.endpoint && sub.keys) {
          await webPush.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys },
            JSON.stringify(payload),
          );
        } else if (sub.kind === "expo" && sub.expoToken) {
          await sendExpoPush(sub.expoToken, payload);
        }
      } catch (err) {
        // Einzelne fehlgeschlagene Zustellung (z.B. abgelaufenes Abo) soll die anderen nicht blockieren
        console.error(`Push an ${sub.id} fehlgeschlagen:`, err);
      }
    }),
  );
}
