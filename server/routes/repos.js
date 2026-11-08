import { Router } from "express";
import * as gh from "../services/github.js";
import { authRequired } from "../middleware.js";

const router = Router();
router.use(authRequired);

/** Walidacja segmentów owner/name — bez znaków specjalnych. */
function ident(s) {
  return /^[A-Za-z0-9_.-]{1,100}$/.test(String(s || ""));
}

function wrap(fn) {
  return (req, res) => {
    fn(req, res).catch((err) => {
      const status = err.status || 502;
      res.status(status).json({ error: err.message || "Błąd po stronie GitHub." });
    });
  };
}

/** Profil + repozytoria użytkownika. */
router.get(
  "/user/:username",
  wrap(async (req, res) => {
    const { username } = req.params;
    if (!ident(username)) return res.status(400).json({ error: "Nieprawidłowa nazwa użytkownika." });
    const [profile, repos] = await Promise.all([gh.getUser(username), gh.listUserRepos(username, { perPage: 30 })]);
    res.json({ profile, repos });
  })
);

/** Wyszukiwarka repozytoriów. */
router.get(
  "/search",
  wrap(async (req, res) => {
    const q = String(req.query.q || "").trim();
    if (!q) return res.status(400).json({ error: "Podaj frazę wyszukiwania." });
    const repos = await gh.searchRepos(q, { perPage: 20 });
    res.json({ repos });
  })
);

/** Szczegóły repozytorium. */
router.get(
  "/repo/:owner/:name",
  wrap(async (req, res) => {
    const { owner, name } = req.params;
    if (!ident(owner) || !ident(name)) return res.status(400).json({ error: "Nieprawidłowa nazwa repozytorium." });
    const repo = await gh.getRepo(owner, name);
    res.json({ repo });
  })
);

/** Gałęzie. */
router.get(
  "/repo/:owner/:name/branches",
  wrap(async (req, res) => {
    const { owner, name } = req.params;
    if (!ident(owner) || !ident(name)) return res.status(400).json({ error: "Nieprawidłowa nazwa repozytorium." });
    const branches = await gh.listBranches(owner, name, { perPage: 30 });
    res.json({ branches: branches.map((b) => b.name) });
  })
);

/** Drzewo plików (opcjonalnie z katalogiem `path` i gałęzią `ref`). */
router.get(
  "/repo/:owner/:name/tree",
  wrap(async (req, res) => {
    const { owner, name } = req.params;
    if (!ident(owner) || !ident(name)) return res.status(400).json({ error: "Nieprawidłowa nazwa repozytorium." });
    const tree = await gh.listTree(owner, name, { ref: req.query.ref, p: String(req.query.path || "") });
    res.json(tree);
  })
);

/** Ostatnie commity. */
router.get(
  "/repo/:owner/:name/commits",
  wrap(async (req, res) => {
    const { owner, name } = req.params;
    if (!ident(owner) || !ident(name)) return res.status(400).json({ error: "Nieprawidłowa nazwa repozytorium." });
    const commits = await gh.listCommits(owner, name, { ref: req.query.ref, perPage: 15 });
    res.json({
      commits: commits.map((c) => ({
        sha: c.sha.slice(0, 7),
        message: c.commit?.message?.split("\n")[0] || "",
        author: c.commit?.author?.name || c.author?.login || "?",
        email: c.commit?.author?.email || "",
        date: c.commit?.author?.date || "",
      })),
    });
  })
);

/** Zawartość pliku (tekst, z limitem rozmiaru). */
router.get(
  "/repo/:owner/:name/blob",
  wrap(async (req, res) => {
    const { owner, name } = req.params;
    if (!ident(owner) || !ident(name)) return res.status(400).json({ error: "Nieprawidłowa nazwa repozytorium." });
    const p = String(req.query.path || "");
    if (!p || p.includes("..")) return res.status(400).json({ error: "Podaj poprawną ścieżkę pliku." });
    const blob = await gh.getBlobText(owner, name, { p, ref: req.query.ref });
    res.json(blob);
  })
);

export default router;
