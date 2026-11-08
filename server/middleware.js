import { store } from "./store.js";

/** Wymaga nagłówka „Authorization: Bearer <token>” (lub ?token= dla testów). */
export function authRequired(req, res, next) {
  const token =
    (req.headers.authorization || "").replace(/^Bearer\s+/i, "") ||
    req.headers["x-workhub-token"] ||
    (typeof req.query.token === "string" ? req.query.token : "");
  const user = store.userByToken(token);
  if (!user) {
    return res.status(401).json({ error: "Brak ważnego tokenu — zaloguj się ponownie." });
  }
  req.user = user;
  next();
}

/** Zwraca czytelny błąd JSON (komunikaty po polsku). */
export function httpError(res, status, message) {
  return res.status(status).json({ error: message });
}
