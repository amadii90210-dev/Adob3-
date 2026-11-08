import { config } from "../config.js";

export class AIError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

const provider = config.aiProvider; // "ollama" | "openai"

/* ============================== OLLAMA ============================== */

async function ollamaJson(pathname, init = {}) {
  let res;
  try {
    res = await fetch(`${config.ollamaUrl}${pathname}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    });
  } catch {
    throw new AIError(
      `Ollama jest niedostępna pod ${config.ollamaUrl}. Uruchom „ollama serve” na maszynie serwera lub zmień OLLAMA_URL w .env.`
    );
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new AIError(`Ollama: ${res.status} — ${body?.error || "nieznany błąd"}.`, 502);
  }
  return body;
}

async function ollamaListModels() {
  const body = await ollamaJson("/api/tags");
  const models = (body.models || []).map((m) => m.name);
  if (models.length === 0) {
    throw new AIError(
      "Ollama działa, ale nie ma żadnych modeli. Pobierz np. „ollama pull qwen2.5:3b”."
    );
  }
  return models;
}

/**
 * Generator: yield { delta: "..." } z każdym kawałkiem tekstu.
 * Ollama streamuje NDJSON: {"message":{"content":"..."}, "done":false}
 */
async function* ollamaStream({ model, messages }) {
  let res;
  try {
    res = await fetch(`${config.ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, stream: true }),
    });
  } catch {
    throw new AIError(`Nie można połączyć się z Ollama (${config.ollamaUrl}).`);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const msg = body?.error || res.status === 404 ? `Model „${model}” nie istnieje w Ollama — pobrań go lub wybierz inny.` : `Ollama: ${res.status}`;
    throw new AIError(msg);
  }

  const decoder = new TextDecoder();
  let buf = "";
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let obj;
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }
      if (obj.error) throw new AIError(`Ollama: ${obj.error}`);
      const delta = obj.message?.content || "";
      if (delta) yield { delta };
      if (obj.done) return;
    }
  }
}

/* ========================= OPENAI (kompat.) ========================= */

async function openaiFetch(pathname, init = {}) {
  if (!config.aiApiKey) {
    throw new AIError("Ustaw AI_API_KEY w .env, aby korzystać z zewnętrznego API (AI_PROVIDER=openai).");
  }
  let res;
  try {
    res = await fetch(`${config.aiBaseUrl}${pathname}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.aiApiKey}`,
        ...(init.headers || {}),
      },
    });
  } catch {
    throw new AIError(`Nie można połączyć się z API AI (${config.aiBaseUrl}).`);
  }
  return res;
}

async function openaiListModels() {
  const res = await openaiFetch("/models");
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new AIError(`API AI: ${res.status} — ${body?.error?.message || body?.message || "nieznany błąd"}.`);
  }
  const body = await res.json();
  const models = (body.data || []).map((m) => m.id).sort();
  if (models.length === 0 && config.aiModel) return [config.aiModel];
  return models;
}

/**
 * Generator: yield { delta }. Format SSE: data: {"choices":[{"delta":{"content":"..."}}]}
 */
async function* openaiStream({ model, messages }) {
  const res = await openaiFetch("/chat/completions", {
    method: "POST",
    body: JSON.stringify({ model, messages, stream: true }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new AIError(
      `API AI: ${res.status} — ${body?.error?.message || body?.message || "błąd żądania"} (sprawdź model/klucz).`
    );
  }
  const decoder = new TextDecoder();
  let buf = "";
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return;
      let obj;
      try {
        obj = JSON.parse(payload);
      } catch {
        continue;
      }
      const delta = obj.choices?.[0]?.delta?.content || "";
      if (delta) yield { delta };
    }
  }
}

/* ============================== API modułu ============================== */

export function providerInfo() {
  if (provider === "openai") {
    return { provider: "openai", url: config.aiBaseUrl, ready: Boolean(config.aiApiKey) };
  }
  return { provider: "ollama", url: config.ollamaUrl, ready: true };
}

export async function listModels() {
  if (provider === "openai") return openaiListModels();
  return ollamaListModels();
}

export async function* streamChat({ model, messages }) {
  if (!model) throw new AIError("Nie wybrano modelu.", 400);
  if (provider === "openai") yield* openaiStream({ model, messages });
  else yield* ollamaStream({ model, messages });
}
