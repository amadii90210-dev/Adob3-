import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icons.jsx";
import { clock } from "../lib/format.js";
import { Empty } from "./bits.jsx";

export default function Chat({ messages, typing, me, socket }) {
  const [text, setText] = useState("");
  const boxRef = useRef(null);
  const endRef = useRef(null);
  const stickRef = useRef(true);
  const lastTypingSent = useRef(0);

  useEffect(() => {
    if (stickRef.current) {
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
    }
  }, [messages, typing]);

  function onScroll() {
    const el = boxRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
  }

  function send(e) {
    e?.preventDefault();
    const t = text.trim();
    if (!t) return;
    socket.emit("chat:message", { text: t });
    socket.emit("typing", { typing: false });
    setText("");
    stickRef.current = true;
  }

  function onInput(e) {
    setText(e.target.value);
    const now = Date.now();
    if (e.target.value && now - lastTypingSent.current > 1200) {
      lastTypingSent.current = now;
      socket.emit("typing", { typing: true });
    }
  }

  const typers = Object.entries(typing || {})
    .filter(([name, on]) => on && name !== me)
    .map(([name]) => name);

  return (
    <div className="chat">
      <div className="chat-list" ref={boxRef} onScroll={onScroll}>
        {messages.length === 0 && typers.length === 0 && (
          <Empty text="Brak komunikatów. Napisz coś — druga osoba zobaczy od razu." icon="chat" />
        )}
        {messages.map((m) => {
          const mine = m.username === me;
          return (
            <div key={m.id} className={`msg ${mine ? "mine" : "theirs"}`}>
              <div className="msg-bubble">
                <div className="msg-meta">
                  <b>{mine ? "Ty" : m.username}</b>
                  <span>{clock(m.at)}</span>
                </div>
                <div className="msg-text">{m.text}</div>
              </div>
            </div>
          );
        })}
        {typers.length > 0 && (
          <div className="msg theirs">
            <div className="msg-bubble typing-bubble">
              <span className="typing-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <em>{typers.join(" i ")} pisze…</em>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form className="chat-form" onSubmit={send}>
        <input
          value={text}
          onChange={onInput}
          onBlur={() => socket.emit("typing", { typing: false })}
          placeholder="Napisz do drugiej osoby…"
          maxLength={1000}
          autoComplete="off"
        />
        <button className="btn btn-primary btn-icon" type="submit" disabled={!text.trim()} title="Wyślij" aria-label="Wyślij">
          <Icon name="send" size={16} />
        </button>
      </form>
    </div>
  );
}
