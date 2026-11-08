import { Icon } from "./Icons.jsx";

/** Pusty stan kafelka. */
export function Empty({ text, icon = "activity" }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={22} />
      </span>
      <p>{text}</p>
    </div>
  );
}

/** Czytelny błąd z opcjonalną podpowiedzią. */
export function ErrorBox({ error, hint, onRetry }) {
  if (!error) return null;
  return (
    <div className="error-box">
      <div className="error-box-head">
        <Icon name="alert" size={16} />
        <span>{error}</span>
      </div>
      {hint && <div className="error-box-hint">{hint}</div>}
      {onRetry && (
        <button className="btn btn-ghost btn-sm" onClick={onRetry}>
          <Icon name="refresh" size={14} /> Spróbuj ponownie
        </button>
      )}
    </div>
  );
}

/** Skeleton loading. */
export function Skeleton({ rows = 4, lines = true }) {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Ładowanie">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skel-row" style={{ "--d": i * 90 }}>
          <span className="skel skel-ico" />
          {lines && (
            <>
              <span className="skel skel-line" style={{ width: `${88 - (i % 3) * 18}%` }} />
              <span className="skel skel-line skel-thin" style={{ width: `${55 - (i % 4) * 8}%` }} />
            </>
          )}
        </div>
      ))}
    </div>
  );
}
