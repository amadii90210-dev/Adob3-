import { store } from "./store.js";

/**
 * Warstwa czasu rzeczywistego. Każdy zalogowany klient dostaje ten sam
 * strumień zdarzeń (pokój globalny „hub”) — stąd „wspólny pulpit”.
 *
 *   klient -> serwer:  chat:message { text }
 *                      typing { typing }
 *                      tasks:create { title }
 *                      tasks:toggle { id }
 *                      tasks:delete { id }
 *                      activity:log { type, text }   (akcje klienta, np. przegląd repo)
 *
 *   serwer -> klienci: chat:new { message }
 *                      typing { username, typing }
 *                      tasks:changed { tasks, event, task }
 *                      activity:new { item }
 *                      presence:changed { users }
 */
export function setupSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    const user = store.userByToken(token);
    if (!user) return next(new Error("unauthorized"));
    socket.data.user = user;
    next();
  });

  const emitPresence = () => {
    io.emit("presence:changed", { users: store.usersWithPresence() });
  };

  const log = (type, text, username) => {
    const item = store.logActivity(type, text, username);
    io.emit("activity:new", { item });
  };

  io.on("connection", (socket) => {
    const user = socket.data.user;

    // ---- presence ----
    const cameOnline = store.addPresence(user.id, socket.id);
    socket.join("hub");
    emitPresence();
    if (cameOnline) log("join", "jest teraz online", user.username);

    // ---- chat ----
    socket.on("chat:message", (payload) => {
      const text = String(payload?.text || "").trim();
      if (!text) return;
      if (text.length > 1000) return socket.emit("error:generic", { error: "Wiadomość jest za długa (maks. 1000 znaków)." });
      const message = store.addMessage(user, text);
      io.emit("chat:new", { message });
      log("message", "wysłał komunikat w czacie", user.username);
    });

    // ---- wskaźnik „pisze…” ----
    socket.on("typing", (payload) => {
      const typing = Boolean(payload?.typing);
      socket.to("hub").emit("typing", { username: user.username, typing });
    });

    // ---- zadania ----
    socket.on("tasks:create", (payload) => {
      const title = String(payload?.title || "").trim();
      if (!title) return;
      if (title.length > 200) return socket.emit("error:generic", { error: "Zadanie jest za długie (maks. 200 znaków)." });
      const task = store.addTask(title, user);
      io.emit("tasks:changed", { tasks: store.data.tasks, event: "create", task });
      log("task_add", `dodał zadanie: „${title}”`, user.username);
    });

    socket.on("tasks:toggle", (payload) => {
      const task = store.setTaskDone(String(payload?.id || ""), Boolean(payload?.done), user);
      if (!task) return;
      io.emit("tasks:changed", { tasks: store.data.tasks, event: "toggle", task });
      log(
        "task_done",
        task.done ? `oznakował jako zrobione: „${task.title}”` : `przywrocił zadanie: „${task.title}”`,
        user.username
      );
    });

    socket.on("tasks:delete", (payload) => {
      const removed = store.deleteTask(String(payload?.id || ""));
      if (!removed) return;
      io.emit("tasks:changed", { tasks: store.data.tasks, event: "delete", task: null });
      log("task_delete", "usunął zadanie", user.username);
    });

    // ---- działania klienta w kafelkach (repo, AI…) logowane na pulpicie ----
    socket.on("activity:log", (payload) => {
      const type = String(payload?.type || "info").slice(0, 32);
      const text = String(payload?.text || "").trim().slice(0, 200);
      if (!text) return;
      log(type, text, user.username);
    });

    // ---- rozłączenie ----
    socket.on("disconnect", () => {
      // zamknięta karta/komputer nie wyśle „typing: false” — czyścimy po stronie serwera
      socket.to("hub").emit("typing", { username: user.username, typing: false });
      const wentOffline = store.removePresence(user.id, socket.id);
      emitPresence();
      if (wentOffline) log("leave", "odszedł offline", user.username);
    });
  });
}
