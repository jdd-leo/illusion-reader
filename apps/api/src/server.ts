import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Server } from "node:http";
import { analyzeRoute } from "./analyze/route";
import { devRoute } from "./dev/route";
import { attachRelay } from "./relay";

try {
  process.loadEnvFile(".env");
} catch {
  // sem .env: variáveis vêm do ambiente
}

const PORT = Number(process.env.PORT ?? 8787);

const app = new Hono();
app.use("*", cors());
app.route("/pages", analyzeRoute);
app.route("/dev", devRoute);

const server = serve({ fetch: app.fetch, port: PORT, hostname: "0.0.0.0" }, () => {
  console.log(`[api] http e relay em 0.0.0.0:${PORT}`);
}) as Server;

const rooms = attachRelay(server);
app.get("/health", (c) => c.json({ ok: true, rooms: rooms.size }));
