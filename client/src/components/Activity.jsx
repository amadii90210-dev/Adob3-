import { Icon } from "./Icons.jsx";
import { timeAgo, clock } from "../lib/format.js";
import { Empty } from "./bits.jsx";

const TYPE_ICON = {
  message: "chat",
  task_add: "plus",
  task_done: "tasks",
  task_delete: "trash",
  ai: "ai",
  repo: "repo",
  join: "user",
  leave: "user",
  register: "user",
  info: "activity",
};

export default function Activity({ items }) {
  return (
    <div className="activity">
      {items.length === 0 && <Empty text="Tu pojawią się wasze działania: komunikaty, zadania, modele AI, repozytoria." />}
      <ul className="activity-list">
        {items.map((a, i) => (
          <li key={a.id} className="activity-item" style={{ "--i": Math.min(i, 10) }}>
            <span className={`activity-ico activity-${a.type}`}>
              <Icon name={TYPE_ICON[a.type] || "activity"} size={13} />
            </span>
            <span className="activity-text">
              <b>{a.username}</b> {a.text}
            </span>
            <span className="activity-time" title={clock(a.at)}>
              {timeAgo(a.at)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
