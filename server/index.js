import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import { Server } from "socket.io";

import { config, publicUrls } from "./config.js";
import { store } from "./store.js";
import { setupSocket } from "./socket.js";
import authRoutes from "./routes/auth.js";
import stateRoutes from "./routes/state.js";
import reposRoutes from "./routes/repos.js";
import aiRoutes from "./routes/ai.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "../client/dist");

const app = express();
app.use(express.json({ limit: "1mb" }));

// ---- API ----
app.use("/api/auth", authRoutes);
app.use("/api", stateRoutes); // /api/state, /api/info
app.use("/api/repos", reposRoutes);
app.use("/api/ai", aiRoutes);

// nieznana ścieżka API -> czytelny błąd JSON
app.use("/api", (req, res) => res.status(404).json({ error: "Nie znaleziono endpointu." }));

// błędy parsowania JSON itd.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || "Błąd serwera." });
});

// ---- Socket.IO ----
const server = http.createServer(app);
const io = new Server(server, {
  // frontend jest serwowany z tej samej domen — CORS zostaje otwarty na wypadek dev Vite
  cors: { origin: true },
});
setupSocket(io);

// ---- Frontend (build Vite) ----
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get(/^(?!\/(api|socket\.io)\/).*/, (req, res) => {
    res.sendFile(path.join(DIST, "index.html"));
  });
} else {
  app.get("/", (req, res) =>
    res
      .type("text/plain")
      .send("WorkHub API działa. Frontend nie zbudowany — uruchom „npm run build” albo „npm run dev” (dev server na :5173).")
  );
}

server.listen(config.port, config.host, () => {
  console.log("\n  WorkHub uruchomiony");
  console.log(`  Serwer:  http://localhost:${config.port}`);
  for (const u of publicUrls()) console.log(`  Sieć:    ${u}`);
  console.log("\n  Otwórz adres sieci LAN na drugim komputerze w tej samej sieci WiFi.\n");
});

// ---- czyste zamknięcie ----
function shutdown() {
  console.log("\n[Zamknięcie] WorkHub się wyłącza…");
  io.close();
  server.close(() => {
    store.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
