import { useState } from "react";
import { Icon } from "./Icons.jsx";
import { timeAgo } from "../lib/format.js";
import { Empty } from "./bits.jsx";

export default function Tasks({ tasks, me, socket }) {
  const [title, setTitle] = useState("");

  function add(e) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    socket.emit("tasks:create", { title: t });
    setTitle("");
  }

  return (
    <div className="tasks">
      <form className="tasks-add" onSubmit={add}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nowe wspólne zadanie…"
          maxLength={200}
          autoComplete="off"
        />
        <button className="btn btn-primary" type="submit" disabled={!title.trim()}>
          <Icon name="plus" size={15} /> Dodaj
        </button>
      </form>

      <div className="tasks-list">
        {tasks.length === 0 && <Empty text="Brak zadań. Dodaj pierwsze — oba komputery zobaczą je od razu." icon="tasks" />}
        {tasks.map((t) => (
          <div key={t.id} className={`task ${t.done ? "done" : ""}`}>
            <button
              className="task-check"
              role="checkbox"
              aria-checked={t.done}
              title={t.done ? "Oznacz jako nierozrobione" : "Oznacz jako zrobione"}
              onClick={() => socket.emit("tasks:toggle", { id: t.id, done: !t.done })}
            >
              <Icon name="tasks" size={13} strokeWidth={2.2} />
            </button>
            <div className="task-body" onClick={() => socket.emit("tasks:toggle", { id: t.id, done: !t.done })}>
              <span className="task-title">{t.title}</span>
              <span className="task-meta">
                {t.done ? (
                  <>
                    zrobione przez <b>{t.doneBy}</b> · {timeAgo(t.doneAt)}
                  </>
                ) : (
                  <>
                    dodał <b>{t.createdBy}</b> · {timeAgo(t.createdAt)}
                  </>
                )}
              </span>
            </div>
            <button
              className="task-del"
              title="Usuń zadanie"
              aria-label="Usuń zadanie"
              onClick={() => socket.emit("tasks:delete", { id: t.id })}
            >
              <Icon name="trash" size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
