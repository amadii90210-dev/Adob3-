import { Router } from "express";
import { store } from "../store.js";
import { authRequired } from "../middleware.js";
import { listModels, streamChat, providerInfo, AIError } from "../services/ai.js";

const router = Router();

function sse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** Lista modeli (Ollama / API AI). */
router.get(
  "/models",
  authRequired,
  (req, res) => {
    listModels()
      .then((models) => res.json({ models, provider: providerInfo() }))
      .catch((err) =>
        res.status(err.status || 502).json({ error: err.message || "Nie udało się pobrać listy modeli." })
      );
  }
);

/** Bieżąca rozmowa bieżącego użytkownika. */
router.get("/conversation", authRequired, (req, res) => {
  res.json({ conversation: store.getConversation(req.user.id) });
});

/** Nowa rozmowa (kasuje poprzednią). */
router.post("/conversation/new", authRequired, (req, res) => {
  store.clearConversation(req.user.id);
  const conv = store.newConversation(req.user.id);
  res.json({ conversation: conv });
});

/**
 * Wyślij wiadomość do modelu. Odpowiedź strumieniowana przez SSE:
 *   event: start  { conversationId, user: {...} }
 *   event: token  { delta: "..." }        (wiele razy)
 *   event: done   { assistant: {...} }
 *   event: error  { error: "..." }
 */
router.post("/chat", authRequired, async (req, res) => {
  const { model, message } = req.body || {};
  const text = String(message || "").trim();
  if (!model) return res.status(400).json({ error: "Wybierz model." });
  if (!text) return res.status(400).json({ error: "Wpisz wiadomość." });
  if (text.length > 4000) return res.status(400).json({ error: "Wiadomość jest za długa (maks. 4000 znaków)." });

  const userMsg = store.addConversationMessage(req.user.id, "user", text);
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(": workhub stream\n\n");
  sse(res, "start", { conversationId: userMsg.id, user: { role: "user", content: text, at: userMsg.at } });

  const history = userMsg.messages
    .slice(0, -1) // bez właśnie dodanej (jest już lokalnie)
    .map((m) => ({ role: m.role, content: m.content }));
  history.push({ role: "user", content: text });

  let assistant = "";
  let clientGone = false;
  req.on("close", () => {
    clientGone = true;
  });

  try {
    for await (const { delta } of streamChat({ model, messages: history })) {
      if (clientGone) break;
      assistant += delta;
      sse(res, "token", { delta });
    }
    if (clientGone) {
      if (assistant) store.addConversationMessage(req.user.id, "assistant", assistant);
      return;
    }
    if (!assistant) assistant = "(model nie zwrócił treści)";
    const saved = store.addConversationMessage(req.user.id, "assistant", assistant);
    store.logActivity("ai", `użył modelu ${model}`, req.user.username);
    sse(res, "done", { assistant: saved.messages[saved.messages.length - 1] });
  } catch (err) {
    sse(res, "error", { error: err instanceof AIError ? err.message : err.message || "Błąd modelu AI." });
  } finally {
    res.end();
  }
});

export default router;
