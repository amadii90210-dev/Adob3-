import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: Vite (5173) proxyfikuje API i Socket.IO na backend (3000),
// więc klient zawsze mówi z jednym originem — zero problemów z CORS.
// root = katalog client/, żeby build działał zarówno z repo root (skrypty npm),
// jak i z samego client/.
const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: rootDir,
  plugins: [react()],
  server: {
    host: true, // dostępny też z LAN w trybie dev
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
      "/socket.io": { target: "http://localhost:3000", ws: true },
    },
  },
  build: {
    outDir: "dist", // → client/dist
    sourcemap: false,
  },
});
