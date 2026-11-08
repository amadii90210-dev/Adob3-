import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "./config.js";

/**
 * Prosta lokalna baza danych w pliku JSON.
 * Dane trzymane w pamięci, z debounced atomowym zapisem na dysk.
 * Struktura:
 *   users:         [{ id, username, passHash, salt, createdAt }]
 *   tokens:        [{ token, userId, createdAt }]
 *   tasks:         [{ id, title, done, createdById, createdAt, doneAt, doneById }]
 *   messages:      [{ id, userId, username, text, createdAt }]
 *   activity:      [{ id, type, text, username, at }]   (ostatnie MAX_ACTIVITY)
 *   conversations: { [userId]: { id, title, messages: [{ role, content, at }] } }
 */

const MAX_ACTIVITY = 120;
const MAX_MESSAGES = 400;
const SAVE_DELAY = 300;

const EMPTY = { users: [], tokens: [], tasks: [], messages: [], activity: [], conversations: {} };

class Store {
  constructor(file) {
    this.file = file;
    this.data = { ...EMPTY };
    this.presence = new Map(); // userId -> Set<socketId>
    this._saveTimer = null;
    this.load();
  }

  /* ---------------- persystencja ---------------- */

  load() {
    try {
      const raw = fs.readFileSync(this.file, "utf8");
      const parsed = JSON.parse(raw);
      this.data = { ...structuredClone(EMPTY), ...parsed };
    } catch {
      // brak pliku = pierwsza start — zostajemy przy pustych danych
    }
  }

  scheduleSave() {
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this.saveNow();
    }, SAVE_DELAY);
  }

  saveNow() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = this.file + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.error("[store] zapis nie powiódł się:", err.message);
    }
  }

  close() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this.saveNow();
  }

  /* ---------------- użytkownicy i tokeny ---------------- */

  hashPassword(password, salt) {
    return crypto.scryptSync(password, salt, 64).toString("hex");
  }

  createUser(username, password) {
    if (this.data.users.length >= config.maxUsers) {
      const e = new Error(`Osiągnięto limit użytkowników (${config.maxUsers}). Zmień MAX_USERS w .env, aby dodać kolejnych.`);
      e.status = 403;
      throw e;
    }
    if (this.getUserByUsername(username)) {
      const e = new Error("Taka nazwa użytkownika już istnieje.");
      e.status = 409;
      throw e;
    }
    const salt = crypto.randomBytes(16).toString("hex");
    const user = {
      id: crypto.randomUUID(),
      username: username.toLowerCase(),
      passHash: this.hashPassword(password, salt),
      salt,
      createdAt: Date.now(),
    };
    this.data.users.push(user);
    this.scheduleSave();
    return user;
  }

  getUserById(id) {
    return this.data.users.find((u) => u.id === id) || null;
  }

  getUserByUsername(name) {
    return this.data.users.find((u) => u.username === String(name || "").toLowerCase()) || null;
  }

  verifyPassword(user, password) {
    const h = this.hashPassword(password, user.salt);
    return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(user.passHash));
  }

  issueToken(userId) {
    const token = crypto.randomBytes(32).toString("hex");
    this.data.tokens.push({ token, userId, createdAt: Date.now() });
    // nie pozwól tokenom kisić się bez końca
    const cutoff = Date.now() - 1000 * 60 * 60 * 24 * 30;
    this.data.tokens = this.data.tokens.filter((t) => t.createdAt > cutoff);
    this.scheduleSave();
    return token;
  }

  userByToken(token) {
    if (!token) return null;
    const t = this.data.tokens.find((x) => x.token === token);
    return t ? this.getUserById(t.userId) : null;
  }

  revokeToken(token) {
    this.data.tokens = this.data.tokens.filter((t) => t.token !== token);
    this.scheduleSave();
  }

  safeUser(u) {
    return u ? { id: u.id, username: u.username, createdAt: u.createdAt } : null;
  }

  /* ---------------- presence (online) ---------------- */

  addPresence(userId, socketId) {
    let set = this.presence.get(userId);
    if (!set) {
      set = new Set();
      this.presence.set(userId, set);
    }
    const wasOffline = set.size === 0;
    set.add(socketId);
    return wasOffline;
  }

  removePresence(userId, socketId) {
    const set = this.presence.get(userId);
    if (!set) return false;
    set.delete(socketId);
    if (set.size === 0) this.presence.delete(userId);
    return set.size === 0;
  }

  isOnline(userId) {
    return (this.presence.get(userId)?.size || 0) > 0;
  }

  onlineUsers() {
    return this.data.users.filter((u) => this.isOnline(u.id)).map((u) => this.safeUser(u));
  }

  usersWithPresence() {
    return this.data.users.map((u) => ({ ...this.safeUser(u), online: this.isOnline(u.id) }));
  }

  /* ---------------- dane wspólne ---------------- */

  addTask(title, user) {
    const task = {
      id: crypto.randomUUID(),
      title,
      done: false,
      createdById: user.id,
      createdBy: user.username,
      createdAt: Date.now(),
      doneAt: null,
      doneBy: null,
    };
    this.data.tasks.unshift(task);
    this.scheduleSave();
    return task;
  }

  setTaskDone(id, done, user) {
    const task = this.data.tasks.find((t) => t.id === id);
    if (!task) return null;
    task.done = done;
    task.doneAt = done ? Date.now() : null;
    task.doneBy = done ? user.username : null;
    this.scheduleSave();
    return task;
  }

  deleteTask(id) {
    const before = this.data.tasks.length;
    this.data.tasks = this.data.tasks.filter((t) => t.id !== id);
    const removed = this.data.tasks.length !== before;
    if (removed) this.scheduleSave();
    return removed;
  }

  addMessage(user, text) {
    const msg = {
      id: crypto.randomUUID(),
      userId: user.id,
      username: user.username,
      text,
      at: Date.now(),
    };
    this.data.messages.push(msg);
    if (this.data.messages.length > MAX_MESSAGES) {
      this.data.messages = this.data.messages.slice(-MAX_MESSAGES);
    }
    this.scheduleSave();
    return msg;
  }

  recentMessages(n = 50) {
    return this.data.messages.slice(-n);
  }

  logActivity(type, text, username) {
    const item = { id: crypto.randomUUID(), type, text, username, at: Date.now() };
    this.data.activity.push(item);
    if (this.data.activity.length > MAX_ACTIVITY) {
      this.data.activity = this.data.activity.slice(-MAX_ACTIVITY);
    }
    this.scheduleSave();
    return item;
  }

  recentActivity(n = 30) {
    return this.data.activity.slice(-n).reverse();
  }

  /* ---------------- rozmowy AI (jedna na użytkownika) ---------------- */

  getConversation(userId) {
    return this.data.conversations[userId] || null;
  }

  newConversation(userId) {
    const conv = { id: crypto.randomUUID(), title: "Nowa rozmowa", messages: [], at: Date.now() };
    this.data.conversations[userId] = conv;
    this.scheduleSave();
    return conv;
  }

  addConversationMessage(userId, role, content) {
    let conv = this.data.conversations[userId];
    if (!conv) conv = this.newConversation(userId);
    conv.messages.push({ role, content, at: Date.now() });
    // trzymaj ostatnie 60 wiadomości w konwersacji
    if (conv.messages.length > 60) conv.messages = conv.messages.slice(-60);
    this.scheduleSave();
    return conv;
  }

  clearConversation(userId) {
    this.data.conversations[userId] = null;
    this.scheduleSave();
  }
}

export const store = new Store(config.dataFile);
