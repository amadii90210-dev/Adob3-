import { Icon } from "./Icons.jsx";
import { initials } from "../lib/format.js";

export default function Header({ user, users, theme, onToggleTheme, onLogout }) {
  const online = users.filter((u) => u.online);
  return (
    <header className="header">
      <div className="header-brand">
        <span className="brand-mark small">
          <Icon name="logo" size={19} strokeWidth={1.6} />
        </span>
        <span className="brand-name small">
          Work<span>Hub</span>
        </span>
      </div>

      <div className="header-right">
        <div className="presence" title={`Online: ${online.map((u) => u.username).join(", ") || "nikt"}`}>
          {users.map((u) => (
            <span key={u.id} className={`avatar ${u.online ? "on" : ""}`} title={`${u.username} — ${u.online ? "online" : "offline"}`}>
              {initials(u.username)}
              <i className="avatar-dot" />
            </span>
          ))}
          <span className="presence-count">{online.length}/{users.length} online</span>
        </div>

        <button
          className="btn btn-ghost btn-icon"
          onClick={onToggleTheme}
          title={theme === "dark" ? "Przełącz na jasny motyw" : "Przełącz na ciemny motyw"}
          aria-label="Przełącz motyw"
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} size={17} />
        </button>

        <button className="btn btn-ghost btn-icon" onClick={onLogout} title={`Wyloguj (${user.username})`} aria-label="Wyloguj">
          <Icon name="logout" size={17} />
        </button>
      </div>
    </header>
  );
}
