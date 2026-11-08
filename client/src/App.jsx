import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { api, getToken, setToken, clearToken } from "./api.js";
import Login from "./components/Login.jsx";
import Dashboard from "./components/Dashboard.jsx";
import { Icon } from "./components/Icons.jsx";

const EMPTY_HUB = {
  tasks: [],
  messages: [],
  activity: [],
  users: [],
  conversation: null,
  typing: {},
};

export default function App() {
  const [token, setTokenState] = useState(getToken);
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(Boolean(getToken()));
  const [info, setInfo] = useState(null);
  const [hub, setHub] = useState(EMPTY_HUB);
  const [toasts, setToasts] = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem("workhub_theme") || "dark");
  const socketRef = useRef(null);

  /* ---------- motyw ---------- */
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("workhub_theme", theme);
  }, [theme]);

  /* ---------- toasty ---------- */
  const toast = useCallback((text, kind = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-3), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  /* ---------- info o instancji (adresy LAN, integracje) ---------- */
  useEffect(() => {
    api("/api/info").then(setInfo).catch(() => {});
  }, []);

  /* ---------- weryfikacja sesji przy starcie ---------- */
  useEffect(() => {
    if (!getToken()) {
      setChecking(false);
      return;
    }
    api("/api/auth/me")
      .then(({ user }) => setUser(user))
      .catch(() => clearToken())
      .finally(() => setChecking(false));
  }, []);

  /* ---------- Socket.IO: cały „wspólny pulpit” w czasie rzeczywistym ---------- */
  useEffect(() => {
    if (!user) return;
    const socket = io({ auth: { token: getToken() } });
    socketRef.current = socket;

    socket.on("connect", () => {
      api("/api/state")
        .then((s) => setHub(s))
        .catch((e) => toast(e.message, "error"));
    });
    socket.on("chat:new", ({ message }) =>
      setHub((h) => ({ ...h, messages: [...h.messages, message].slice(-200) }))
    );
    socket.on("typing", ({ username, typing }) =>
      setHub((h) => ({ ...h, typing: { ...h.typing, [username]: typing } }))
    );
    socket.on("tasks:changed", ({ tasks }) => setHub((h) => ({ ...h, tasks })));
    socket.on("activity:new", ({ item }) =>
      setHub((h) => ({ ...h, activity: [item, ...h.activity].slice(0, 80) }))
    );
    socket.on("presence:changed", ({ users }) => setHub((h) => ({ ...h, users })));
    socket.on("error:generic", ({ error }) => toast(error, "error"));
    socket.on("connect_error", (err) => {
      if (err.message === "unauthorized") {
        clearToken();
        setTokenState(null);
        setUser(null);
        toast("Sesja wygasła — zaloguj się ponownie.", "error");
      } else {
        toast("Przerwanie połączenia z serwerem — łączenie…", "error");
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user, toast]);

  /* ---------- logowanie / rejestracja / wylogowanie ---------- */
  const onAuthed = useCallback((t, u) => {
    setToken(t);
    setTokenState(t);
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignorujemy — i tak kasujemy token lokalnie */
    }
    clearToken();
    setTokenState(null);
    setUser(null);
    setHub(EMPTY_HUB);
  }, []);

  if (checking) {
    return (
      <div className="boot">
        <div className="boot-logo">
          <Icon name="logo" size={44} strokeWidth={1.6} />
        </div>
        <div className="boot-bars">
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }

  return (
    <>
      {!user ? (
        <Login onAuthed={onAuthed} info={info} toast={toast} />
      ) : (
        <Dashboard
          user={user}
          hub={hub}
          setHub={setHub}
          socket={socketRef.current}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          onLogout={logout}
          toast={toast}
        />
      )}
      {toasts.length > 0 && (
        <div className="toasts" role="status">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.kind}`}>
              <Icon name={t.kind === "error" ? "alert" : "ai"} size={16} />
              <span>{t.text}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
