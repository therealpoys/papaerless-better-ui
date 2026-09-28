import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { env } from "./env.js";
import { documentRoutes } from "./routes/documents.js";
import { metadataRoutes } from "./routes/metadata.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(multipart);

app.get("/health", async () => ({ status: "ok" }));

await app.register(documentRoutes, { prefix: "/api" });
await app.register(metadataRoutes, { prefix: "/api" });

app
  .listen({ port: env.apiPort, host: "0.0.0.0" })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
