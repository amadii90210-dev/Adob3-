import { Router } from "express";
import { store } from "../store.js";
import { authRequired } from "../middleware.js";

const router = Router();

const USERNAME_RE = /^[a-zA-Z0-9_\-]{3,20}$/;

router.post("/register", (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (typeof username !== "string" || !USERNAME_RE.test(username)) {
      return res.status(400).json({ error: "Nazwa użytkownika: 3–20 znaków (litery, cyfry, _ lub -)." });
    }
    if (typeof password !== "string" || password.length < 4) {
      return res.status(400).json({ error: "Hasło musi mieć co najmniej 4 znaki." });
    }
    const user = store.createUser(username, password);
    const token = store.issueToken(user.id);
    store.logActivity("register", `dołączył do WorkHub`, user.username);
    res.json({ token, user: store.safeUser(user) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  const user = store.getUserByUsername(username);
  if (!user || !store.verifyPassword(user, String(password || ""))) {
    return res.status(401).json({ error: "Nieprawidłowa nazwa użytkownika lub hasło." });
  }
  const token = store.issueToken(user.id);
  res.json({ token, user: store.safeUser(user) });
});

router.post("/logout", authRequired, (req, res) => {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  store.revokeToken(token);
  res.json({ ok: true });
});

router.get("/me", authRequired, (req, res) => {
  res.json({ user: store.safeUser(req.user) });
});

/** Wszyscy użytkownicy + status online (do paska obecności). */
router.get("/users", authRequired, (req, res) => {
  res.json({ users: store.usersWithPresence() });
});

export default router;
