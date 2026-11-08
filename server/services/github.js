import { config } from "../config.js";

const API = "https://api.github.com";

export class GithubError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

async function gh(pathname, { token, limit } = {}) {
  const headers = {
    "User-Agent": "WorkHub",
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const tok = token || config.githubToken;
  if (tok) headers.Authorization = `Bearer ${tok}`;

  let res;
  try {
    res = await fetch(API + pathname, { headers });
  } catch {
    throw new GithubError("Nie można połączyć się z GitHub (brak internetu na maszynie serwera?).");
  }

  if (res.status === 403 || res.status === 429) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    const reset = Number(res.headers.get("x-ratelimit-reset") || 0);
    if (remaining === "0" || res.status === 429) {
      const when = reset ? new Date(reset * 1000).toLocaleTimeString("pl-PL") : "";
      throw new GithubError(
        `Limit zapytań GitHub wyczerpany. Odnowi się ok. ${when}. Dodaj GITHUB_TOKEN w .env, aby podnieść limit.`,
        429
      );
    }
    throw new GithubError("GitHub: dostęp niedozwolony (sprawdź uprawnienia tokenu).", 403);
  }
  if (res.status === 404) throw new GithubError("Nie znaleziono (404) — sprawdź nazwę użytkownika/repozytorium.", 404);

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new GithubError(`GitHub zwrócił błąd ${res.status}${body?.message ? `: ${body.message}` : ""}.`, res.status);
  }
  return limit ? body.slice(0, limit) : body;
}

/** Profil użytkownika/orgu. */
export const getUser = (username) => gh(`/users/${encodeURIComponent(username)}`);

/** Lista repozytoriów użytkownika/orgu. */
export const listUserRepos = (username, { perPage = 30 } = {}) =>
  gh(
    `/users/${encodeURIComponent(username)}/repos?per_page=${perPage}&sort=pushed&direction=desc`,
    { limit: perPage }
  );

/** Szukaj repozytoriów (dla odnalezienia repo bez znajomości ownera). */
export async function searchRepos(query, { perPage = 20 } = {}) {
  const body = await gh(`/search/repositories?q=${encodeURIComponent(query)}&per_page=${perPage}`);
  return (body.items || []).slice(0, perPage); // odpowiedź search: { total_count, items: [] }
}

/** Szczegóły repozytorium. */
export const getRepo = (owner, name) => gh(`/repos/${owner}/${name}`);

/** Gałęzie repozytorium. */
export const listBranches = (owner, name, { perPage = 30 } = {}) =>
  gh(`/repos/${owner}/${name}/branches?per_page=${perPage}`, { limit: perPage });

/**
 * Zawartość katalogu (`p` — ścieżka, "" = korzeń).
 * Zwraca pozycje: { name, type: "dir"|"file", path, size? }
 */
export async function listTree(owner, name, { ref, p = "" } = {}) {
  const r = await getRepo(owner, name);
  const branch = ref || r.default_branch;
  const items = await gh(
    `/repos/${owner}/${name}/contents/${p ? encodeURIComponent(p) + "?" : ""}ref=${encodeURIComponent(branch)}`
  );
  if (!Array.isArray(items)) throw new GithubError("Nie udało się odczytać katalogu.", 502);
  const mapped = items.map((t) => ({
    name: t.name,
    type: t.type === "dir" ? "dir" : "file",
    path: t.path,
    size: t.size ?? null,
  }));
  mapped.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
  return { branch, items: mapped };
}

/** Ostatnie commity. */
export const listCommits = (owner, name, { ref, perPage = 15 } = {}) =>
  gh(`/repos/${owner}/${name}/commits?per_page=${perPage}${ref ? `&sha=${encodeURIComponent(ref)}` : ""}`, {
    limit: perPage,
  });

/**
 * Zawartość pliku (tekst). Zbyt duże / binarne są oznaczane zamiast wracane.
 */
export async function getBlobText(owner, name, { p, ref, maxBytes = 250 * 1024 } = {}) {
  const r = await getRepo(owner, name);
  const branch = ref || r.default_branch;
  const res = await gh(`/repos/${owner}/${name}/contents/${encodeURIComponent(p)}?ref=${encodeURIComponent(branch)}`);
  if (!res || typeof res.content !== "string") {
    return { truncated: true, content: "", note: "Plik jest zmienną/large — pokaż go w GitHub." };
  }
  const content = Buffer.from(res.content, "base64").toString("utf8");
  if (res.size > maxBytes) {
    return { truncated: true, content: content.slice(0, maxBytes), note: `Plik większy niż ${Math.round(maxBytes / 1024)} kB — pokazano początek.` };
  }
  return { truncated: false, content, note: null };
}
