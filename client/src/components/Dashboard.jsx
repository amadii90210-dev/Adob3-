import Header from "./Header.jsx";
import Tile from "./Tile.jsx";
import Chat from "./Chat.jsx";
import Tasks from "./Tasks.jsx";
import Activity from "./Activity.jsx";
import Repos from "./Repos.jsx";
import AIChat from "./AIChat.jsx";

export default function Dashboard({ user, hub, setHub, socket, theme, onToggleTheme, onLogout, toast }) {
  const done = hub.tasks.filter((t) => t.done).length;
  const total = hub.tasks.length;
  const typingUsers = Object.entries(hub.typing || {})
    .filter(([name, on]) => on && name !== user.username)
    .map(([name]) => name);

  return (
    <div className="app">
      {/* animowane tło: siatka + dryfujące plamy akcentu */}
      <div className="bg-fx" aria-hidden="true">
        <div className="bg-grid" />
        <div className="bg-blob bg-blob-a" />
        <div className="bg-blob bg-blob-b" />
      </div>

      <Header
        user={user}
        users={hub.users}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onLogout={onLogout}
      />

      <main className="grid">
        <Tile i={0} id="ai" title="Model AI" icon="ai" className="tile-ai">
          <AIChat socket={socket} conversation={hub.conversation} setHub={setHub} toast={toast} />
        </Tile>

        <Tile
          i={1}
          id="chat"
          title="Czat"
          icon="chat"
          className="tile-chat"
          footer={
            typingUsers.length > 0 ? (
              <span className="tile-live">
                {typingUsers.join(", ")} pisze<span className="dots"><span>.</span><span>.</span><span>.</span></span>
              </span>
            ) : (
              <span className="tile-live tile-live-idle">
                <span className="live-dot" /> na żywo
              </span>
            )
          }
        >
          <Chat messages={hub.messages} typing={hub.typing} me={user.username} socket={socket} />
        </Tile>

        <Tile i={2} id="repos" title="Repozytoria GitHub" icon="repo" className="tile-repos">
          <Repos socket={socket} toast={toast} />
        </Tile>

        <Tile
          i={3}
          id="tasks"
          title="Zadania"
          icon="tasks"
          className="tile-tasks"
          footer={
            total > 0 ? (
              <span className="tile-progress">
                <span className="tile-progress-bar">
                  <span style={{ width: `${(done / total) * 100}%` }} />
                </span>
                {done}/{total}
              </span>
            ) : (
              <span className="tile-live">wspólne</span>
            )
          }
        >
          <Tasks tasks={hub.tasks} me={user.username} socket={socket} />
        </Tile>

        <Tile i={4} id="activity" title="Aktywność" icon="activity" className="tile-activity">
          <Activity items={hub.activity} />
        </Tile>
      </main>
    </div>
  );
}
