import { useState } from "react";
import { api } from "../api.js";
import { Icon } from "./Icons.jsx";
import { langColor, timeAgo, fullDate } from "../lib/format.js";
import { Empty, ErrorBox, Skeleton } from "./bits.jsx";

function fmtSize(n) {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function Repos({ socket, toast }) {
  // --- faza wyboru repo ---
  const [ownerQ, setOwnerQ] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [results, setResults] = useState(null); // { profile, repos }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // --- faza podglądu repo ---
  const [repo, setRepo] = useState(null);
  const [branches, setBranches] = useState([]);
  const [branch, setBranch] = useState("");
  const [tab, setTab] = useState("files"); // files | commits
  const [path, setPath] = useState("");
  const [tree, setTree] = useState(null);
  const [treeLoading, setTreeLoading] = useState(false);
  const [commits, setCommits] = useState(null);
  const [file, setFile] = useState(null);

  async function run(fn) {
    setLoading(true);
    setError(null);
    try {
      const data = await fn();
      setResults(data);
    } catch (e) {
      setError(e.message);
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  function openRepo(owner, name, fullRepo = null) {
    setRepo(fullRepo || { owner, name, default_branch: "" });
    setFile(null);
    setPath("");
    setTab("files");
    setTree(null);
    setCommits(null);
    setError(null);
    socket?.emit("activity:log", { type: "repo", text: `przejrzał repo ${owner}/${name}` });

    (async () => {
      try {
        const base = `/api/repos/repo/${owner}/${name}`;
        const [d, br, tr, cm] = await Promise.all([
          api(base),
          api(`${base}/branches`),
          api(`${base}/tree`),
          api(`${base}/commits`),
        ]);
        setRepo(d.repo);
        setBranch(
          br.branches.includes(d.repo.default_branch)
            ? d.repo.default_branch
            : br.branches[0] || ""
        );
        setBranches(br.branches.includes(d.repo.default_branch) ? br.branches : [d.repo.default_branch, ...br.branches]);
        setTree(tr);
        setCommits(cm.commits);
      } catch (e) {
        setError(e.message);
        setRepo(null);
      }
    })();
  }

  async function changeBranch(b) {
    if (!repo || b === branch) return;
    setBranch(b);
    setTreeLoading(true);
    setFile(null);
    try {
      const base = `/api/repos/repo/${repo.owner}/${repo.name}`;
      const [tr, cm] = await Promise.all([
        api(`${base}/tree?ref=${encodeURIComponent(b)}`),
        api(`${base}/commits?ref=${encodeURIComponent(b)}`),
      ]);
      setTree(tr);
      setCommits(cm.commits);
    } catch (e) {
      setError(e.message);
    } finally {
      setTreeLoading(false);
    }
  }

  async function enterDir(p) {
    setFile(null);
    setPath(p);
    setTreeLoading(true);
    try {
      const base = `/api/repos/repo/${repo.owner}/${repo.name}`;
      const tr = await api(`${base}/tree?ref=${encodeURIComponent(branch)}&path=${encodeURIComponent(p)}`);
      setTree(tr);
    } catch (e) {
      setError(e.message);
    } finally {
      setTreeLoading(false);
    }
  }

  async function openFile(p) {
    setFile({ path: p, loading: true });
    try {
      const base = `/api/repos/repo/${repo.owner}/${repo.name}`;
      const d = await api(`${base}/blob?ref=${encodeURIComponent(branch)}&path=${encodeURIComponent(p)}`);
      setFile({ path: p, content: d.content, note: d.note, truncated: d.truncated });
    } catch (e) {
      setFile(null);
      toast(e.message, "error");
    }
  }

  function closeRepo() {
    setRepo(null);
    setResults(null);
    setError(null);
    setFile(null);
  }

  /* ============================ RENDER ============================ */

  if (repo) {
    const crumbs = path ? path.split("/") : [];
    return (
      <div className="repos">
        <div className="repo-bar">
          <button className="btn btn-ghost btn-sm" onClick={closeRepo} title="Wróć do listy">
            <Icon name="back" size={14} /> Wróć
          </button>
          <div className="repo-name" title={`${repo.owner}/${repo.name}`}>
            <Icon name="repo" size={15} />
            <b>
              {repo.owner}/{repo.name}
            </b>
          </div>
          <div className="repo-stats">
            {repo.language && (
              <span className="lang">
                <i style={{ background: langColor(repo.language) }} />
                {repo.language}
              </span>
            )}
            <span className="stars">
              <Icon name="star" size={13} />
              {repo.stargazers_count ?? repo.forks_count != null ? repo.stargazers_count : ""}
            </span>
            <select value={branch} onChange={(e) => changeBranch(e.target.value)} className="select" title="Gałąź">
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="repo-tabs">
          <button className={tab === "files" ? "active" : ""} onClick={() => { setTab("files"); setFile(null); }}>
            <Icon name="folder" size={14} /> Pliki
          </button>
          <button className={tab === "commits" ? "active" : ""} onClick={() => { setTab("commits"); setFile(null); }}>
            <Icon name="commit" size={14} /> Commity
          </button>
        </div>

        <ErrorBox error={error} />

        {tab === "files" && (
          <div className="repo-files">
            {file ? (
              <div className="file-view">
                <div className="file-view-head">
                  <button className="btn btn-ghost btn-sm" onClick={() => setFile(null)}>
                    <Icon name="back" size={13} /> Lista
                  </button>
                  <span className="file-path" title={file.path}>
                    {file.path}
                  </span>
                </div>
                {file.loading ? (
                  <Skeleton rows={8} lines={false} />
                ) : (
                  <>
                    {file.note && <div className="file-note">{file.note}</div>}
                    <pre className="file-content">
                      <code>{file.content || "(pusty plik)"}</code>
                    </pre>
                  </>
                )}
              </div>
            ) : treeLoading ? (
              <Skeleton rows={7} />
            ) : tree && tree.items.length > 0 ? (
              <>
                <div className="crumbs">
                  <button className={path ? "crumb crumb-active" : "crumb"} onClick={() => enterDir("")}>
                    /
                  </button>
                  {crumbs.map((c, i) => (
                    <span key={i} className="crumb-group">
                      <span className="crumb-sep">/</span>
                      <button
                        className="crumb"
                        onClick={() => enterDir(crumbs.slice(0, i + 1).join("/"))}
                      >
                        {c}
                      </button>
                    </span>
                  ))}
                </div>
                <ul className="tree">
                  {tree.items.map((it) => (
                    <li key={it.path}>
                      <button
                        className={`tree-item ${it.type}`}
                        onClick={() => (it.type === "dir" ? enterDir(it.path) : openFile(it.path))}
                        title={it.type === "dir" ? "Otwórz katalog" : "Pokaż zawartość"}
                      >
                        <Icon name={it.type === "dir" ? "folder" : "file"} size={15} />
                        <span className="tree-name">{it.name}</span>
                        {it.type === "file" && it.size != null && <span className="tree-size">{fmtSize(it.size)}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <Empty text="Pusty katalog." icon="folder" />
            )}
          </div>
        )}

        {tab === "commits" && (
          <div className="repo-commits">
            {treeLoading && !commits ? (
              <Skeleton rows={6} />
            ) : (
              <ul className="commit-list">
                {commits.map((c) => (
                  <li key={c.sha} className="commit" title={fullDate(new Date(c.date).getTime())}>
                    <span className="commit-sha">{c.sha}</span>
                    <span className="commit-msg">{c.message}</span>
                    <span className="commit-meta">
                      {c.author} · {timeAgo(new Date(c.date).getTime())}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  }

  /* --------- faza wyboru --------- */
  return (
    <div className="repos">
      <div className="repo-pick">
        <div className="repo-pick-row">
          <div className="field field-inline">
            <input
              value={ownerQ}
              onChange={(e) => setOwnerQ(e.target.value)}
              placeholder="Użytkownik lub org na GitHub, np. torvalds"
              maxLength={100}
              autoComplete="off"
              onKeyDown={(e) => e.key === "Enter" && ownerQ.trim() && run(() => api(`/api/repos/user/${encodeURIComponent(ownerQ.trim())}`))}
            />
          </div>
          <button className="btn btn-primary" onClick={() => run(() => api(`/api/repos/user/${encodeURIComponent(ownerQ.trim())}`))} disabled={!ownerQ.trim() || loading}>
            <Icon name="repo" size={15} /> Repo
          </button>
        </div>
        <div className="repo-pick-row">
          <div className="field field-inline">
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Albo wyszukaj: np. react, socket.io…"
              maxLength={100}
              autoComplete="off"
              onKeyDown={(e) => e.key === "Enter" && searchQ.trim() && run(() => api(`/api/repos/search?q=${encodeURIComponent(searchQ.trim())}`))}
            />
          </div>
          <button className="btn btn-ghost" onClick={() => run(() => api(`/api/repos/search?q=${encodeURIComponent(searchQ.trim())}`))} disabled={!searchQ.trim() || loading}>
            <Icon name="search" size={15} /> Szukaj
          </button>
        </div>
      </div>

      <ErrorBox error={error} />

      {loading && <Skeleton rows={5} />}

      {!loading && results && (
        <div className="repo-results">
          {results.profile && (
            <div className="repo-profile" title={`@${results.profile.login}`}>
              <img
                className="avatar-img"
                src={results.profile.avatar_url}
                alt=""
                onError={(e) => (e.target.style.display = "none")}
                loading="lazy"
              />
              <div>
                <b>@{results.profile.login}</b>
                <span>
                  {results.profile.name || "—"} · {results.profile.public_repos} publicznych repo
                </span>
              </div>
            </div>
          )}
          {results.repos.length === 0 && <Empty text="Brak repozytoriów (upewnij się, że nazwa istnieje, albo dodaj GITHUB_TOKEN w .env)." icon="repo" />}
          <ul className="repo-list">
            {results.repos.map((r) => (
              <li key={r.full_name}>
                <button className="repo-card" onClick={() => openRepo(r.owner.login, r.name, r)} title="Otwórz repozytorium">
                  <div className="repo-card-top">
                    <span className="repo-card-name">{r.name}</span>
                    {r.fork && <span className="repo-fork">fork</span>}
                    {r.language && (
                      <span className="lang">
                        <i style={{ background: langColor(r.language) }} />
                        {r.language}
                      </span>
                    )}
                  </div>
                  <span className="repo-card-desc">{r.description || "Brak opisu."}</span>
                  <span className="repo-card-meta">
                    <span>
                      <Icon name="star" size={12} /> {r.stargazers_count}
                    </span>
                    <span>
                      <Icon name="commit" size={12} /> aktualizacja {timeAgo(r.pushed_at)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && !results && !error && (
        <Empty text="Podaj użytkownika GitHub lub frazę wyszukiwania, aby zobaczyć repozytoria, pliki i commity." icon="repo" />
      )}
    </div>
  );
}
