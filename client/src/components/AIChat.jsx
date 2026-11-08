import { useEffect, useRef, useState } from "react";
import { api, apiStream, sseStream } from "../api.js";
import { Icon } from "./Icons.jsx";
import { clock } from "../lib/format.js";
import { Empty, ErrorBox, Skeleton } from "./bits.jsx";

export default function AIChat({ socket, conversation, setHub, toast }) {
  const [models, setModels] = useState([]);
  const [modelsState, setModelsState] = useState("loading"); // loading | ok | error
  const [modelsErr, setModelsErr] = useState(null);
  const [provider, setProvider] = useState(null);
  const [model, setModel] = useState("");
  const [modelManual, setModelManual] = useState("");
  const [messages, setMessages] = useState(() => conversation?.messages || []);
  const [busy, setBusy] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState(null);
  const [text, setText] = useState("");

  const boxRef = useRef(null);
  const endRef = useRef(null);
  const stickRef = useRef(true);
  const abortRef = useRef(null);

  /* ---- lista modeli ---- */
  function loadModels() {
    setModelsState("loading");
    setModelsErr(null);
    api("/api/ai/models")
      .then((d) => {
        setModels(d.models);
        setProvider(d.provider);
        setModelsState("ok");
        setModel((m) => m || d.models[0] || "");
      })
      .catch((e) => {
        setModelsState("error");
        setModelsErr(e.message);
      });
  }
  useEffect(loadModels, []);

  /* ---- synchronizacja z nową rozmową (zmiana id = nowa konwersacja) ---- */
  const convId = conversation?.id;
  useEffect(() => {
    setMessages(conversation?.messages || []);
    setStreamText("");
  }, [convId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- auto-scroll ---- */
  useEffect(() => {
    if (stickRef.current) {
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
    }
  }, [messages, streamText, busy]);

  function onScroll() {
    const el = boxRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
  }

  const effectiveModel = model || modelManual.trim();

  async function send(e) {
    e?.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    if (!effectiveModel) {
      setError("Wybierz model z listy lub wpisz jego nazwę.");
      return;
    }
    setError(null);
    setBusy(true);
    setStreamText("");
    setMessages((ms) => [...ms, { role: "user", content: t, at: Date.now() }]);
    setText("");
    stickRef.current = true;

    let acc = "";
    try {
      const res = await apiStream("/api/ai/chat", { model: effectiveModel, message: t });
      for await (const { event, data } of sseStream(res)) {
        if (event === "token") {
          acc += data.delta;
          setStreamText(acc);
        } else if (event === "done") {
          setMessages((ms) => [...ms, data.assistant]);
          setStreamText("");
        } else if (event === "error") {
          setError(data.error);
          if (acc) {
            setMessages((ms) => [...ms, { role: "assistant", content: acc, at: Date.now(), partial: true }]);
          }
          setStreamText("");
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function newConversation() {
    try {
      const d = await api("/api/ai/conversation/new", { method: "POST" });
      setHub((h) => ({ ...h, conversation: d.conversation }));
      setError(null);
    } catch (e) {
      toast(e.message, "error");
    }
  }

  const noMessages = messages.length === 0 && !streamText && !busy;

  return (
    <div className="ai">
      <div className="ai-toolbar">
        <div className="ai-model">
          {modelsState === "loading" && <Skeleton rows={1} lines={false} />}
          {modelsState === "ok" && (
            <select value={model} onChange={(e) => setModel(e.target.value)} className="select" title="Model">
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
          {modelsState === "error" && (
            <input
              value={modelManual}
              onChange={(e) => setModelManual(e.target.value)}
              className="input"
              placeholder="Nazwa modelu (np. llama3.2)"
              title={modelsErr}
            />
          )}
          {provider && (
            <span className="ai-provider" title={`Źródło: ${provider.url}`}>
              {provider.provider === "ollama" ? "Ollama" : "API"}
            </span>
          )}
        </div>
        {messages.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={newConversation} title="Wyczyść rozmowę">
            <Icon name="plus" size={14} /> Nowa
          </button>
        )}
      </div>

      {modelsState === "error" && (
        <ErrorBox
          error={modelsErr}
          hint={
            provider?.provider === "ollama"
              ? "Na maszynie serwera: „ollama serve”, potem np. „ollama pull qwen2.5:3b”. W międzyczasie możesz wpisać nazwę modelu ręcznie."
              : "Uzupełnij AI_API_KEY / AI_BASE_URL w .env (AI_PROVIDER=openai)."
          }
          onRetry={loadModels}
        />
      )}

      <div className="ai-list" ref={boxRef} onScroll={onScroll}>
        {noMessages && !modelsErr && (
          <Empty text="Zapytaj model o cokolwiek — odpowiedź pojawi się tu na żywo, token po tokenie." icon="ai" />
        )}
        {messages.map((m, i) => (
          <div key={i} className={`ai-msg ${m.role}`}>
            <div className="ai-msg-head">
              <span className="ai-msg-role">{m.role === "user" ? "Ty" : "Model"}</span>
              <span className="ai-msg-time">{m.at ? clock(m.at) : ""}</span>
              {m.partial && <span className="ai-msg-partial">urwane</span>}
            </div>
            <div className="ai-msg-text">{m.content}</div>
          </div>
        ))}
        {busy && (
          <div className="ai-msg assistant streaming">
            <div className="ai-msg-head">
              <span className="ai-msg-role">Model</span>
              <span className="ai-msg-time">
                pisze<span className="dots"><span>.</span><span>.</span><span>.</span></span>
              </span>
            </div>
            {streamText ? (
              <div className="ai-msg-text">
                {streamText}
                <span className="caret" aria-hidden="true" />
              </div>
            ) : (
              <span className="typing-dots big" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            )}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <ErrorBox error={error} onRetry={() => setError(null)} />

      <form className="chat-form" onSubmit={send}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={busy ? "Model odpowiada…" : "Napisz prompt… (Enter = wyślij, Shift+Enter = nowa linia)"}
          maxLength={4000}
          rows={2}
          disabled={busy}
        />
        <button className="btn btn-primary btn-icon" type="submit" disabled={!text.trim() || busy} title="Wyślij" aria-label="Wyślij">
          <Icon name={busy ? "refresh" : "send"} size={16} className={busy ? "spin" : ""} />
        </button>
      </form>
    </div>
  );
}
