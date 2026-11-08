import { useState } from "react";
import { api } from "../api.js";
import { Icon } from "./Icons.jsx";

export default function Login({ onAuthed, info, toast }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const data = await api(path, { method: "POST", body: { username, password } });
      onAuthed(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function copyUrl(url) {
    // Clipboard API działa w kontekście secure (https/localhost);
    // pod adresem IP w LAN trzeba skopiować ręcznie.
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(
        () => toast("Adres skopiowany do schowka."),
        () => toast("Nie udało się skopiować.", "error")
      );
    } else {
      toast(`Skopiuj adres ręcznie: ${url}`);
    }
  }

  const full = info ? info.registered >= info.maxUsers : false;

  return (
    <div className="login">
      <div className="login-brand">
        <div className="login-brand-inner">
          <div className="brand">
            <span className="brand-mark">
              <Icon name="logo" size={26} strokeWidth={1.6} />
            </span>
            <span className="brand-name">
              Work<span>Hub</span>
            </span>
          </div>
          <h1 className="login-headline">
            Wspólny pulpit
            <br />
            dla waszej <em>dwójki</em>.
          </h1>
          <p className="login-sub">
            Repozytoria GitHub, modele AI, chat, zadania i aktywność — na żywo, z dwóch
            komputerów podłączonych do tej samej sieci WiFi.
          </p>

          {info && (
            <div className="login-meta">
              <div className="login-urls">
                <div className="login-urls-label">Otwórz na drugim komputerze (ta sama sieć):</div>
                {(info.urls.length ? info.urls : [`http://localhost:${info.port}`]).map((u) => (
                  <button key={u} className="url-chip" onClick={() => copyUrl(u)} title="Kliknij, aby skopiować">
                    <Icon name="link" size={14} />
                    {u}
                  </button>
                ))}
              </div>
              <div className="login-status">
                <span className={`chip ${info.ai.provider === "ollama" ? "chip-ai" : "chip-ai"}`}>
                  <Icon name="ai" size={13} />
                  AI: {info.ai.provider === "ollama" ? "Ollama" : "API"} · {info.ai.url}
                </span>
                <span className={`chip ${info.github.tokenSet ? "chip-ok" : "chip-warn"}`}>
                  <Icon name="repo" size={13} />
                  GitHub: {info.github.tokenSet ? "token ustawiony" : "tryb anonimowy"}
                </span>
                <span className={`chip ${full ? "chip-warn" : "chip-ok"}`}>
                  <Icon name="user" size={13} />
                  Konta: {info.registered}/{info.maxUsers}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="login-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              className={mode === "login" ? "active" : ""}
              onClick={() => {
                setMode("login");
                setError(null);
              }}
            >
              Logowanie
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              className={mode === "register" ? "active" : ""}
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              disabled={full}
            >
              Rejestracja
            </button>
          </div>

          <label className="field">
            <span>Nazwa użytkownika</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="np. asia lub piotrek"
              autoComplete="username"
              maxLength={20}
              required
            />
          </label>
          <label className="field">
            <span>Hasło</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="min. 4 znaki"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={4}
              required
            />
          </label>

          {error && (
            <div className="form-error">
              <Icon name="alert" size={15} />
              {error}
            </div>
          )}
          {full && mode !== "register" && (
            <div className="form-hint">
              Oba konta już istnieją. Jeśli potrzebujesz trzeciego — podnieś MAX_USERS w .env.
            </div>
          )}

          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? (
              <>
                <span className="spinner" /> {mode === "login" ? "Loguję…" : "Tworzę konto…"}
              </>
            ) : mode === "login" ? (
              "Wejdź do WorkHub"
            ) : (
              "Załóż konto i wejdź"
            )}
          </button>

          <p className="login-foot">
            {mode === "register"
              ? "Przypomnij hasło? Poproś kolegę o zresetowanie data/workhub.json — to wasza wspólna baza."
              : "Proste sesje: token trzyma się w localStorage przeglądarki."}
          </p>
        </form>
      </div>
    </div>
  );
}
