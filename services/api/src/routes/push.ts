import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { env } from "../env.js";
import { pushStore } from "../push-store.js";

interface WebSubscriptionBody {
  kind: "web";
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
}

interface ExpoSubscriptionBody {
  kind: "expo";
  token: string;
}

export async function pushRoutes(app: FastifyInstance) {
  app.get("/push/public-key", async () => ({ publicKey: env.webPushPublicKey ?? null }));

  app.post("/push/subscriptions", async (request, reply) => {
    const body = request.body as WebSubscriptionBody | ExpoSubscriptionBody;

    if (body.kind === "web") {
      if (!body.subscription?.endpoint) {
        return reply.code(400).send({ error: "subscription.endpoint fehlt" });
      }
      const record = await pushStore.add({
        id: randomUUID(),
        kind: "web",
        createdAt: new Date().toISOString(),
        endpoint: body.subscription.endpoint,
        keys: body.subscription.keys,
      });
      return { id: record.id };
    }

    if (body.kind === "expo") {
      if (!body.token) {
        return reply.code(400).send({ error: "token fehlt" });
      }
      const record = await pushStore.add({
        id: randomUUID(),
        kind: "expo",
        createdAt: new Date().toISOString(),
        expoToken: body.token,
      });
      return { id: record.id };
    }

    return reply.code(400).send({ error: "Unbekannter kind-Wert" });
  });

  app.delete("/push/subscriptions/:id", async (request) => {
    const { id } = request.params as { id: string };
    await pushStore.remove(id);
    return { ok: true };
  });
}
