import dotenv from "dotenv";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const num = (v, d) => (Number.isFinite(Number(v)) && v !== "" ? Number(v) : d);

export const config = {
  port: num(process.env.PORT, 3000),
  host: process.env.HOST || "0.0.0.0",
  maxUsers: num(process.env.MAX_USERS, 2),
  dataFile: process.env.DATA_FILE || path.join(__dirname, "..", "data", "workhub.json"),

  // --- AI ---
  aiProvider: (process.env.AI_PROVIDER || "ollama").toLowerCase(), // "ollama" | "openai"
  ollamaUrl: (process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/+$/, ""),
  aiBaseUrl: (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, ""),
  aiApiKey: process.env.AI_API_KEY || "",
  aiModel: process.env.AI_MODEL || "",

  // --- GitHub ---
  githubToken: process.env.GITHUB_TOKEN || "",
};

/** Adresy LAN (IPv4), pod którymi drugi komputer może otworzyć WorkHub. */
export function lanAddresses() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const list of Object.values(ifaces)) {
    for (const i of list || []) {
      if (i.family === "IPv4" && !i.internal) out.push(i.address);
    }
  }
  return out;
}

export function publicUrls() {
  return lanAddresses().map((ip) => `http://${ip}:${config.port}`);
}
