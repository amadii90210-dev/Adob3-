import { Icon } from "./Icons.jsx";

/**
 * Kafel pulpitu. `i` — indeks do kaskadowego opóźnienia animacji wejścia.
 */
export default function Tile({ i = 0, id, title, icon, footer = null, className = "", children }) {
  return (
    <section className={`tile ${className}`} style={{ "--i": i }} id={`tile-${id}`}>
      <header className="tile-head">
        <div className="tile-title">
          <span className="tile-icon">
            <Icon name={icon} size={16} />
          </span>
          <h2>{title}</h2>
        </div>
        {footer}
      </header>
      <div className="tile-body">{children}</div>
    </section>
  );
}
