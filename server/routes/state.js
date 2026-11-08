import { Router } from "express";
import { store } from "../store.js";
import { authRequired } from "../middleware.js";
import { config, publicUrls } from "../config.js";
import { providerInfo } from "../services/ai.js";

const router = Router();

/**
 * Stan startowy pulpitu — frontend weryfikuje się tym jednym wywołaniem,
 * a dalsze aktualizacje przychodzą przez Socket.IO.
 */
router.get("/state", authRequired, (req, res) => {
  res.json({
    tasks: store.data.tasks,
    messages: store.recentMessages(50),
    activity: store.recentActivity(30),
    users: store.usersWithPresence(),
    conversation: store.getConversation(req.user.id),
    me: store.safeUser(req.user),
  });
});

/** Informacje o instancji (adresy LAN, statusy integracji) — dla ekranu logowania. */
router.get("/info", (req, res) => {
  res.json({
    name: "WorkHub",
    port: config.port,
    maxUsers: config.maxUsers,
    registered: store.data.users.length,
    urls: publicUrls(),
    github: { tokenSet: Boolean(config.githubToken) },
    ai: providerInfo(),
  });
});

export default router;
