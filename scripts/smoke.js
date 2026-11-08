/**
 * Test dymny WorkHub. Wymaga URUCHOMIONEGO serwera (npm start / npm run dev:server).
 * Uruchomienie:  npm run smoke          (serwer pod http://localhost:3000)
 *                BASE=http://host:port npm run smoke
 *
 * Sprawdza: /api/info, rejestracja, /api/state, logowanie,
 * chat na żywo (Socket.IO), zadania (Socket.IO), presence, streaming AI (błąd bez Ollamy).
 */
import { io } from "socket.io-client";

const BASE = process.env.BASE || "http://localhost:3000";
const stamp = Date.now().toString(36).slice(-5);
// stałe konta smoke — test jest idempotentny (logowanie albo rejestracja)
const u1 = "smoke_a";
const u2 = "smoke_b";
const PASS = "smoke-pass";

async function registerOrLogin(username, password) {
  const reg = await j("/api/auth/register", { method: "POST", body: { username, password } });
  if (reg.status === 200 && reg.data.token) return { token: reg.data.token };
  const log = await j("/api/auth/login", { method: "POST", body: { username, password } });
  if (log.status === 200 && log.data.token) return { token: log.data.token };
  return { error: reg.data.error || log.data.error };
}

let passed = 0;
let failed = 0;
const ok = (name) => {
  passed++;
  console.log(`  ✔ ${name}`);
};
const fail = (name, err) => {
  failed++;
  console.log(`  ✘ ${name}${err ? ` — ${err}` : ""}`);
};

async function j(path, { method = "GET", token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

/**
 * Czuwa na evencie, dopóki payload nie spełni `predicate` (domyślnie każdy).
 * Dzięki predykatowi test nie „łapie” starych eventów w transicie —
 * broadcasty są asynchroniczne, a poprzednie akcje mogły już rozsyłać swoje eventy.
 */
function waitFor(socket, event, predicate = () => true, ms = 5000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`timeout na „${event}”`));
    }, ms);
    function handler(payload) {
      if (predicate(payload)) {
        clearTimeout(t);
        socket.off(event, handler);
        resolve(payload);
      }
    }
    socket.on(event, handler);
  });
}

const connect = (token) =>
  new Promise((resolve, reject) => {
    const s = io(BASE, { auth: { token }, transports: ["websocket", "polling"] });
    const t = setTimeout(() => reject(new Error("timeout połączenia socket")), 5000);
    s.on("connect", () => {
      clearTimeout(t);
      resolve(s);
    });
    s.on("connect_error", (e) => {
      clearTimeout(t);
      reject(e);
    });
  });

console.log(`WorkHub smoke test → ${BASE}\n`);

/* 1. info */
try {
  const { status, data } = await j("/api/info");
  status === 200 && data.name === "WorkHub" ? ok("GET /api/info") : fail("GET /api/info", `status=${status}`);
  console.log(`      adresy LAN: ${(data.urls || []).join(", ") || "(brak — tylko localhost)"}`);
} catch (e) {
  fail("GET /api/info", e.message);
  console.error("\nSerwer nie działa? Uruchom najpierw:  npm start");
  process.exit(1);
}

/* 2. konta smoke + stan + logowanie */
let t1 = null;
let t2 = null;
try {
  const r1 = await registerOrLogin(u1, PASS);
  if (r1.token) {
    ok(`konto „${u1}” (rejestracja/logowanie)`);
    t1 = r1.token;
  } else {
    fail("konto smoke_a", r1.error);
    console.error(
      "\n  Konta smoke nie mogą powstać — instancja ma prawdopodobnie już zajęty limit MAX_USERS.\n  Do testów: usuń data/workhub.json albo tymczasowo podnieś MAX_USERS w .env.\n"
    );
    process.exit(2);
  }
} catch (e) {
  fail("konto smoke_a", e.message);
}
try {
  const r2 = await registerOrLogin(u2, PASS);
  if (r2.token) {
    ok(`konto „${u2}” (rejestracja/logowanie)`);
    t2 = r2.token;
  } else {
    fail("konto smoke_b", r2.error);
  }
} catch (e) {
  fail("konto smoke_b", e.message);
}
try {
  const s = await j("/api/state", { token: t1 });
  s.status === 200 && Array.isArray(s.data.tasks) ? ok("GET /api/state") : fail("GET /api/state", `status=${s.status}`);
} catch (e) {
  fail("GET /api/state", e.message);
}
try {
  const l = await j("/api/auth/login", { method: "POST", body: { username: u1, password: PASS } });
  l.status === 200 ? ok("logowanie (hasło OK)") : fail("logowanie", `status=${l.status}`);
  const bad = await j("/api/auth/login", { method: "POST", body: { username: u1, password: "zle-haslo" } });
  bad.status === 401 ? ok("logowanie (złe hasło → 401)") : fail("logowanie złe hasło", `status=${bad.status}`);
} catch (e) {
  fail("logowanie", e.message);
}

/* 3. real-time */
if (t1 && t2) {
  let s1 = null;
  let s2 = null;
  try {
    [s1, s2] = await Promise.all([connect(t1), connect(t2)]);
    ok("Socket.IO: dwa połączenia (A i B)");

    // presence — A odłącza się i wraca, dzięki czemu B „łapie” event
    s1.disconnect();
    const presenceP = waitFor(s2, "presence:changed", (p) => p.users.some((u) => u.username === u1 && u.online));
    s1 = await connect(t1);
    await presenceP;
    ok("presence: B widzi A online");

    // chat — A pisze, B dostaje
    const chatP = waitFor(s2, "chat:new", (p) => p.message && p.message.text.includes("smoke-czat"));
    s1.emit("chat:message", { text: `smoke-czat-${stamp}` });
    await chatP;
    ok("chat: komunikat A → B na żywo");

    // typing — A pisze, B dostaje wskaźnik
    const typingP = waitFor(s2, "typing", (p) => p.username === u1 && p.typing === true);
    s1.emit("typing", { typing: true });
    await typingP;
    ok("typing: „pisze…” A → B");

    // zadania — A dodaje, B dostaje listę
    const taskTitle = `smoke-zadanie-${stamp}`;
    const taskP = waitFor(s2, "tasks:changed", (p) => p.event === "create" && p.tasks.some((t) => t.title === taskTitle));
    s1.emit("tasks:create", { title: taskTitle });
    const tc = await taskP;
    ok("zadania: dodanie A → B na żywo");

    // odhaczenie — czekamy na stan, w którym zadanie jest done
    const taskObj = tc.tasks.find((t) => t.title === taskTitle);
    const doneP = waitFor(s1, "tasks:changed", (p) => p.tasks.find((t) => t.id === taskObj.id)?.done === true);
    s2.emit("tasks:toggle", { id: taskObj.id, done: true });
    const td = await doneP;
    ok("zadania: odhaczenie B → A na żywo");

    // aktywność — filtry na konkretny wpis
    const actP = waitFor(s2, "activity:new", (p) => p.item && p.item.text.includes("smoke-aktywność"));
    s1.emit("activity:log", { type: "repo", text: "smoke-aktywność" });
    await actP;
    ok("aktywność: log A → B");

    // autoryzacja socket bez tokenu
    const bad = await new Promise((resolve) => {
      const b = io(BASE, { auth: { token: "nieprawidlowy" } });
      b.on("connect", () => resolve("połączono"));
      b.on("connect_error", () => resolve("odrzucono"));
      setTimeout(() => resolve("timeout"), 3000);
    });
    bad === "odrzucono" ? ok("Socket.IO: brak tokenu → odrzucone") : fail("Socket.IO auth", bad);

    // porządki: usuń zadania smoke
    s2.emit("tasks:delete", { id: td.tasks.find((t) => t.title.includes("smoke-zadanie"))?.id });
  } catch (e) {
    fail("real-time", e.message);
  } finally {
    s1?.disconnect();
    s2?.disconnect();
  }
}

/* 4. AI — bez Ollamy oczekujemy czytelnego błędu (502), z Ollamą listy modeli */
try {
  const m = await j("/api/ai/models", { token: t1 });
  if (m.status === 200 && Array.isArray(m.data.models) && m.data.models.length > 0) {
    ok(`AI: modele dostępne (${m.data.models.slice(0, 3).join(", ")}…)`);
  } else {
    m.data.error
      ? ok(`AI: brak dostawcy — czytelny błąd: „${m.data.error.slice(0, 60)}…”`)
      : fail("AI models", `status=${m.status}`);
  }
} catch (e) {
  fail("AI models", e.message);
}

/* 5. GitHub — bez internetu/tokena też musi zwrócić czytelny błąd */
try {
  const g = await j("/api/repos/user/torvalds", { token: t1 });
  g.status === 200 ? ok("GitHub: profil torvalds") : ok(`GitHub: komunikat błędu: „${String(g.data.error).slice(0, 50)}…”`);
} catch (e) {
  fail("GitHub", e.message);
}

console.log(`\nWynik: ${passed} OK, ${failed} błędów.`);
process.exit(failed > 0 ? 1 : 0);
