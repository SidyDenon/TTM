import express from "express";
// import mysql from "mysql2/promise"; // Unused after unifying DB pool
import dotenv from "dotenv";
import cors from "cors";
import os from "os";
import cron from "node-cron";
import jwt from "jsonwebtoken";
import { createServer } from "http";
import https from "https";
import { Server } from "socket.io";
import db from "./config/db.js";

import clientsRoutes from "./routes/admin/clients.js";
import operatorsRoutes from "./routes/admin/operators.js";
import requestsRoutes from "./routes/admin/requests.js";
import authRoutes from "./routes/auth.js";
import clientRequestsRoutes from "./routes/client/requests.js";
import walletRoutes from "./routes/operator/wallet.js";
import authMiddleware from "./middleware/auth.js";
import transactionsRoutes from "./routes/admin/transactions.js";
import userPushTokenRoutes from "./routes/userPushToken.js";
import adminWithdrawalsRoutes from "./routes/admin/withdrawals.js";
import settingsRoutes from "./routes/admin/settings.js";
import dashboardRoutes from "./routes/admin/dashboard.js";
import servicesRoutes from "./routes/admin/services.js";
import configRoutes from "./routes/admin/config.js";
import servicesPublicRoutes from "./routes/public/services.public.js";
import operatorRoutes from "./routes/operator/requests.js";
import rbacRolesRoutes from "./routes/admin/rbac.roles.js";
import rbacUsersRoutes from "./routes/admin/rbac.users.js";
import { loadAdminPermissions } from "./middleware/checkPermission.js";

dotenv.config();

const app = express();
app.use(express.json());

// ---------------- CORS (Express) sécurisé ----------------
function normalizeOrigin(u) {
  if (!u) return "";
  let s = String(u).trim();
  // supprime espaces après http(s)://
  s = s.replace(/^(https?:\/\/)\s+/, "$1");
  // supprime les / finaux
  s = s.replace(/\/+$/g, "");
  return s;
}

function getLocalIPv4() {
  try {
    const nics = os.networkInterfaces();
    for (const name of Object.keys(nics)) {
      for (const info of nics[name] || []) {
        if (info && info.family === "IPv4" && !info.internal) {
          return info.address;
        }
      }
    }
  } catch {}
  return "127.0.0.1";
}

const LAN_IP = process.env.LOCAL_IP || getLocalIPv4();

const rawOrigins = (process.env.CORS_ORIGINS ||
  `http://localhost:5173,http://localhost:3000,http://${LAN_IP}:5173,http://${LAN_IP}:3000,http://${LAN_IP}:5000,http://10.0.2.2:5000`)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins = rawOrigins.map(normalizeOrigin);
const allowedOriginsSet = new Set(allowedOrigins);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // curl / apps natives
    const o = normalizeOrigin(origin);
    if (allowedOriginsSet.has(o)) return callback(null, true);
    console.warn("CORS refusé pour origin:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};
app.use(cors(corsOptions));
// Préflight explicite
// Express 5 + path-to-regexp v6: avoid '*' string path
app.options(/.*/, cors(corsOptions));

// ➜ Forcer JSON **uniquement** pour l’API (pas pour /uploads)
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) res.type("application/json");
  next();
});

// ---------------- MYSQL ----------------
// ---------------- Validation ENV ----------------
const skipDbCheck = process.env.SKIP_DB_CHECK === "1";
const requiredAlways = ["JWT_SECRET"]; // requis pour auth/API/Socket
const requiredForDb = ["DB_HOST", "DB_USER", "DB_NAME"]; // DB_PASS optionnel
const requiredEnv = [...requiredAlways, ...(skipDbCheck ? [] : requiredForDb)];
const missingEnv = requiredEnv.filter((k) => !process.env[k]);
if (missingEnv.length) {
  console.error("❌ Variables d'environnement manquantes:", missingEnv.join(", "));
  process.exit(1);
}

if (!skipDbCheck) {
  try {
    await db.query("SELECT 1");
    console.log("✅ Connexion DB réussie");
  } catch (err) {
    console.error("❌ Erreur connexion DB:", err.message);
    process.exit(1);
  }
} else {
  console.log("⚠️ SKIP_DB_CHECK=1 → ping DB ignoré (mode test)");
}

// ---------------- SOCKET.IO ----------------
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  pingInterval: 25000,
  pingTimeout: 60000,
});
app.set("io", io);

// ---------------- SUIVI DES UTILISATEURS ----------------
const onlineUsers = {
  clients: new Map(),
  operators: new Map(),
  admins: new Map(),
};

function joinRoleRooms(user, socket) {
  if (!user || !socket) return;
  const id = Number(user.id);
  const role = String(user.role || "").toLowerCase();
  const rooms = new Set();

  if (role === "admin") {
    rooms.add("admins");
    rooms.add(`admin:${id}`);
  }
  if (["operator", "operateur", "opérateur"].includes(role)) {
    rooms.add("operators");
    rooms.add(`operator:${id}`);
  }
  if (role === "client") {
    rooms.add("clients");
    rooms.add(`client:${id}`);
  }

  rooms.forEach((room) => {
    try {
      socket.join(room);
    } catch (err) {
      console.warn(`⚠️ Impossible de rejoindre la room ${room}:`, err?.message || err);
    }
  });
  if (rooms.size) {
    console.log(`🛰️ ${role} ${id} rejoint les rooms:`, Array.from(rooms).join(", "));
  }
}

export function emitMissionEvent(event, mission = {}, options = {}) {
  if (!event) return;
  const payload = { ...mission };
  const {
    admins = true,
    operators = true,
    clients = false,
    operatorId = mission?.operator_id,
    clientId = mission?.user_id,
    rooms = [],
  } = options;

  const targets = new Set(rooms);
  if (admins) targets.add("admins");
  if (operators) targets.add("operators");
  if (clients) targets.add("clients");
  if (operatorId) targets.add(`operator:${Number(operatorId)}`);
  if (clientId) targets.add(`client:${Number(clientId)}`);
  if (mission?.id) targets.add(`mission_${mission.id}`);

  console.log(
    `📡 [WS] ${event}`,
    { id: mission?.id ?? null, status: mission?.status ?? null, targets: Array.from(targets) }
  );

  for (const room of targets) {
    try {
      io.to(room).emit(event, payload);
    } catch (err) {
      console.warn(`⚠️ Emission ${event} vers ${room} échouée:`, err?.message || err);
    }
  }
}

// ✅ Middleware JWT (tolérant) pour Socket.IO
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    console.log("⚠️ Token absent — connexion autorisée temporairement");
    return next();
  }
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    // Normalise les rôles (opérateur/administrateur → operator/admin)
    const r = String(user.role || "").toLowerCase();
    if (r === "operateur" || r === "opérateur") user.role = "operator";
    if (r === "administrateur") user.role = "admin";
    socket.user = user;
    console.log(`🔐 Authentifié: ${user.role} ${user.id}`);
    next();
  } catch (err) {
    console.log("❌ Token invalide:", err.message);
    next(new Error("Token invalide"));
  }
});

io.on("connection", (socket) => {
  console.log("⚡ Nouveau client connecté:", socket.id);
  const user = socket.user;

  if (!user) {
    socket.on("register", (payload) => {
      try {
        const decoded = jwt.verify(payload.token, process.env.JWT_SECRET);
        socket.user = decoded;
        registerSocket(decoded, socket);
      } catch {
        console.log("❌ Token de register invalide");
        socket.disconnect();
      }
    });
  } else {
    registerSocket(user, socket);
  }

  socket.on("join_request", ({ requestId }) => {
    if (!socket.user) {
      console.log("⚠️ join_request refusé: utilisateur non authentifié");
      return;
    }
    if (!requestId) return;
    const room = `mission_${requestId}`;
    socket.join(room);
    console.log(`✅ ${socket.id} rejoint la room ${room}`);
  });

  socket.on("operator_location", async (data) => {
    const role = String(socket.user?.role || "").toLowerCase();
    if (!socket.user || !["operator", "operateur", "opérateur"].includes(role)) {
      console.log("⚠️ operator_location refusé: role non autorisé ou non authentifié");
      return;
    }
    const { requestId, operatorId, lat, lng } = data || {};
    const nlat = Number(lat);
    const nlng = Number(lng);
    if (!requestId || !Number.isFinite(nlat) || !Number.isFinite(nlng)) return;
    if (Number(operatorId) !== Number(socket.user.id)) {
      console.log(
        `⚠️ operator_location rejeté: operatorId ${operatorId} ≠ user.id ${socket.user.id}`
      );
      return;
    }
    const payload = {
      requestId,
      operatorId: Number(operatorId),
      lat: nlat,
      lng: nlng,
      timestamp: Date.now(),
    };
    io.to(`mission_${requestId}`).emit("operator_position_update", payload);
    // 🛰️ Diffusion aussi aux admins pour suivi temps réel sur la carte
    io.to("admins").emit("operator_position_update", payload);
  });

  socket.on("leave_request", ({ requestId }) => {
    if (!socket.user || !requestId) return;
    socket.leave(`mission_${requestId}`);
    console.log(`👋 ${socket.user?.role} ${socket.user?.id} quitte ${requestId}`);
  });

  socket.on("disconnect", (reason) => {
    console.log(`❌ Déconnexion socket ${socket.id} (${reason})`);
    cleanupSocket(socket.id);
  });

  socket.on("error", (error) => {
    console.error("❌ Erreur socket:", error);
  });
});

// ---------------- FONCTIONS WS ----------------
function registerSocket(user, socket) {
  const id = Number(user.id);
  const role = String(user.role || "").toLowerCase();

  const map = onlineUsers[`${role}s`];
  if (!map) {
    console.log("⚠️ Rôle inconnu:", role);
    return;
  }

  const oldSocketId = map.get(id);
  if (oldSocketId && oldSocketId !== socket.id) {
    const oldSocket = io.sockets.sockets.get(oldSocketId);
    if (oldSocket) {
      oldSocket.emit("session_replaced", { message: "Une nouvelle connexion a été établie" });
      oldSocket.disconnect(true);
      console.log(`⚠️ Ancienne session ${role} ${id} fermée`);
    }
  }

  map.set(id, socket.id);
  joinRoleRooms(user, socket);
  console.log("🧠 Utilisateurs connectés:", {
    clients: onlineUsers.clients.size,
    operators: onlineUsers.operators.size,
    admins: onlineUsers.admins.size,
  });

  console.log(`✅ ${role} ${id} enregistré sur socket ${socket.id}`);
  socket.emit("register_success", { userId: id });
}

function cleanupSocket(socketId) {
  let found = false;
  for (const [roleName, map] of Object.entries(onlineUsers)) {
    for (const [uid, sid] of map.entries()) {
      if (sid === socketId) {
        map.delete(uid);
        console.log(`🧹 Nettoyage ${roleName} ${uid}`);
        found = true;
      }
    }
  }
  if (!found) {
    console.log(`⚠️ Socket ${socketId} non trouvé dans onlineUsers`);
  }
}

// ✅ notifyOperators : Socket.IO **uniquement**
export async function notifyOperators(event, payload) {
  let count = 0;
  for (const [opId, socketId] of onlineUsers.operators.entries()) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit(event, payload);
      count++;
    } else {
      console.log(`⚠️ Socket ${socketId} n'existe plus pour opérateur ${opId}`);
      onlineUsers.operators.delete(opId);
    }
  }
  console.log(`📢 Notification Socket.IO "${event}" envoyée à ${count} opérateur(s)`);
}

export function notifyUser(userId, event, data) {
  try {
    const uid = Number(userId);
    const socketId = onlineUsers.clients.get(uid);

    if (socketId) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        console.log(`📤 [notifyUser] → user:${uid} event:${event} payload:`, data);
        socket.emit(event, data);
        return true;
      } else {
        console.log(`⚠️ [notifyUser] socket ${socketId} introuvable pour user ${uid} (cleanup)`);
        onlineUsers.clients.delete(uid);
      }
    } else {
      console.log(`⚠️ [notifyUser] user ${uid} non connecté (event:${event})`);
    }
    return false;
  } catch (err) {
    console.error("❌ [notifyUser] erreur :", err);
    return false;
  }
}

// ✅ Notifier une room spécifique
export function notifyRoom(requestId, event, data) {
  const room = `mission_${requestId}`;
  io.to(room).emit(event, data);
  console.log(`📢 Notification envoyée à la room ${room} : ${event}`);
}

// ---------------- ROUTES API ----------------
app.use(
  "/api/admin",
  (req, _res, next) => {
    req.db = db;
    next();
  },
  authMiddleware,
  loadAdminPermissions
);

app.use("/api/admin/clients", clientsRoutes(db));
app.use("/api/admin/operators", operatorsRoutes(db));
app.use("/api/admin/requests", requestsRoutes(db, io, emitMissionEvent));
app.use("/api/requests", clientRequestsRoutes(db, notifyOperators, emitMissionEvent));
app.use("/api/operator/wallet", walletRoutes(db));
app.use("/api/admin/transactions", transactionsRoutes(db));
app.use("/api/user", userPushTokenRoutes(db));
app.use("/api/admin/withdrawals", adminWithdrawalsRoutes(db));
app.use("/api/admin/settings", settingsRoutes(db));
app.use("/api/admin/dashboard", dashboardRoutes(db, io, emitMissionEvent));
app.use("/api/admin/services", servicesRoutes(db));
app.use("/api/admin/config", configRoutes(db));
app.use("/api/services/public", servicesPublicRoutes(db));
app.use("/api/operator", operatorRoutes(db));
app.use("/api/admin/rbac/roles", rbacRolesRoutes(db));
app.use("/api/admin/rbac/users", rbacUsersRoutes(db));
// ✅ Toutes les routes /api/admin sont protégées automatiquement
app.use("/api", authRoutes(db));

// ================= DEBUG REQUESTS =================
app.get("/api/admin/requests/_debug", async (req, res) => {
  try {
    // Adapte le nom de table si besoin: requests | missions | service_requests
    const [rows] = await db.query(
      `SELECT id, status, created_at
       FROM requests
       ORDER BY created_at DESC
       LIMIT 5`
    );
    res.json({ ok: true, sample: rows });
  } catch (e) {
    console.error("SQL DEBUG /_debug:", e.code, e.sqlMessage || e.message);
    res.status(500).json({
      ok: false,
      error: e.code || "DB_FAIL",
      detail: e.sqlMessage || e.message,
    });
  }
});

app.get("/api/admin/requests/_stats", async (req, res) => {
  try {
    // Mini stats pour débloquer ton Dashboard
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM requests`);

    const [byStatus] = await db.query(
      `SELECT status, COUNT(*) AS n
       FROM requests
       GROUP BY status
       ORDER BY n DESC`
    );

    const [latest] = await db.query(
      `SELECT id, status, created_at
       FROM requests
       ORDER BY created_at DESC
       LIMIT 10`
    );

    res.json({ total, byStatus, latest });
  } catch (e) {
    console.error("SQL DEBUG /_stats:", e.code, e.sqlMessage || e.message);
    res.status(500).json({
      error: e.code || "DB_FAIL",
      detail: e.sqlMessage || e.message,
    });
  }
});

// ---------- /me (unique) + compat /api/admin/me ----------
function safeParsePermissions(raw) {
  try {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "object" && !(raw instanceof Buffer)) {
      // cas d'un objet { perm: true, perm2: false }
      return Object.keys(raw).filter((k) => !!raw[k]);
    }
    if (raw instanceof Buffer) {
      const str = raw.toString("utf8").trim();
      if (!str) return [];
      const parsed = JSON.parse(str);
      return safeParsePermissions(parsed);
    }
    if (typeof raw === "string") {
      const str = raw.trim();
      if (!str) return [];
      const parsed = JSON.parse(str);
      return safeParsePermissions(parsed);
    }
  } catch (err) {
    console.warn("⚠️ Permissions JSON invalide:", err.message);
  }
  return [];
}

async function handleMe(req, res) {
  try {
    const user = req.user;

    if (user.role === "admin") {
      const [[row]] = await db.query(
        `SELECT u.id, u.name, u.email, u.is_super, r.name AS role_name, r.permissions
         FROM admin_users u
         LEFT JOIN admin_roles r ON r.id = u.role_id
         WHERE u.id = ?`,
        [user.id]
      );

      if (!row) return res.status(404).json({ error: "Admin introuvable" });

      const permissionsRaw = safeParsePermissions(row.permissions);
      // Canonicalisation simple (alignement front/back)
      const PERM_ALIASES = {
        dashboard_view: "can_view_dashboard",
        demandes_view: "requests_view",
        demandes_manage: "requests_manage",
        transactions_confirm: "transactions_manage",
        withdrawals_approve: "withdrawals_manage",
        withdrawals_reject: "withdrawals_manage",
      };
      const canon = (p) => PERM_ALIASES[p] || p;
      const permissions = Array.from(new Set((permissionsRaw || []).map(canon)));

      return res.json({
        id: row.id,
        name: row.name,
        email: row.email,
        role: "admin",
        role_name: row.role_name || null,
        is_super: !!row.is_super,
        permissions, // toujours un tableau
      });
    }

    // clients / opérateurs
    res.json({
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
    });
  } catch (err) {
    console.error("❌ /me:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

app.get("/api/me", authMiddleware, handleMe);
app.get("/api/admin/me", authMiddleware, handleMe); // compat front admin

// ---------- Debug RBAC: whoami (protégé) ----------
app.get(
  "/api/admin/_debug/whoami",
  authMiddleware,
  loadAdminPermissions,
  (req, res) => {
    const out = {
      id: req.user?.id,
      role: req.user?.role,
      isSuperAdmin: !!req.isSuperAdmin,
      permissions: req.adminPermissions || [],
    };
    res.json(out);
  }
);

// ---------- Configuration publique minimale ----------
app.get("/api/config/public", async (req, res) => {
  try {
    let commission = 10;
    let currency = "FCFA";
    try {
      const [[row]] = await db.query(
        "SELECT commission_percent, currency FROM configurations LIMIT 1"
      );
      if (row) {
        if (row.commission_percent != null)
          commission = Number(row.commission_percent);
        if (row.currency) currency = row.currency;
      }
    } catch (e) {
      // table absente → valeurs par défaut
    }
    res.json({ commission_percent: commission, currency });
  } catch (err) {
    res.status(500).json({ error: "CONFIG_FAIL" });
  }
});

// ---------------- PROXY GOOGLE DIRECTIONS ----------------
app.get("/api/directions", async (req, res) => {
  try {
    const { origin, destination, mode = "driving", provider } = req.query;
    if (!origin || !destination) {
      return res
        .status(400)
        .json({ error: "Paramètres requis: origin, destination" });
    }

    const key = process.env.GOOGLE_API_KEY;

    // Compat: Node < 18 (sans fetch global) → fallback HTTPS
    const fetchJsonCompat = async (targetUrl) => {
      if (typeof fetch === "function") {
        const r = await fetch(targetUrl);
        let json;
        try {
          json = await r.json();
        } catch {
          json = { error: "Réponse non-JSON depuis Google" };
        }
        return { ok: r.ok, status: r.status, json };
      }
      return await new Promise((resolve) => {
        https
          .get(targetUrl, (resp) => {
            let data = "";
            resp.on("data", (chunk) => (data += chunk));
            resp.on("end", () => {
              let parsed;
              try {
                parsed = JSON.parse(data);
              } catch (e) {
                parsed = { error: "Réponse non-JSON depuis Google" };
              }
              resolve({
                ok: resp.statusCode >= 200 && resp.statusCode < 300,
                status: resp.statusCode,
                json: parsed,
              });
            });
          })
          .on("error", (err) => {
            resolve({
              ok: false,
              status: 500,
              json: { error: err.message },
            });
          });
      });
    };

    // Tente Google si la clé est dispo (sauf si provider=osrm)
    let googleTried = false;
    if (key && provider !== "osrm") {
      googleTried = true;
      const gUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
        origin
      )}&destination=${encodeURIComponent(
        destination
      )}&mode=${encodeURIComponent(mode)}&key=${key}`;
      const { ok, status, json } = await fetchJsonCompat(gUrl);
      if (ok && json?.routes?.length) {
        return res.status(200).json(json);
      }
      console.warn(
        "⚠️ Directions Google non OK ou sans route:",
        status,
        json?.status,
        json?.error_message || json?.error || ""
      );
      // sinon, fallback OSRM
    }

    // Fallback OSRM (OpenStreetMap) — normalisation vers format Google minimal
    const [oLatStr, oLngStr] = String(origin).split(",");
    const [dLatStr, dLngStr] = String(destination).split(",");
    const oLat = Number(oLatStr),
      oLng = Number(oLngStr);
    const dLat = Number(dLatStr),
      dLng = Number(dLngStr);
    if (
      !Number.isFinite(oLat) ||
      !Number.isFinite(oLng) ||
      !Number.isFinite(dLat) ||
      !Number.isFinite(dLng)
    ) {
      return res
        .status(400)
        .json({ error: "Coordonnées invalides pour origin/destination" });
    }

    // OSRM attend lng,lat et renvoie geometry en polyline
    const osrmProfile =
      mode === "walking"
        ? "foot"
        : mode === "bicycling"
        ? "bike"
        : "driving";
    const osrmUrl = `https://router.project-osrm.org/route/v1/${osrmProfile}/${oLng},${oLat};${dLng},${dLat}?overview=full&geometries=polyline`;
    const {
      ok: okOsrm,
      status: statusOsrm,
      json: osrm,
    } = await fetchJsonCompat(osrmUrl);
    if (!okOsrm || osrm?.code !== "Ok" || !osrm?.routes?.length) {
      const msg = `OSRM échec: ${statusOsrm} ${osrm?.code || ""}`.trim();
      console.warn("⚠️ Fallback OSRM sans route:", msg);
      return res.status(502).json({
        error: googleTried ? "Aucune route Google et OSRM" : "Aucune route OSRM",
        detail: msg,
      });
    }

    const r0 = osrm.routes[0];
    const geometry = r0.geometry; // polyline
    const distance = Math.round(r0.distance || 0);
    const duration = Math.round(r0.duration || 0);

    const normalized = {
      status: "OK",
      routes: [
        {
          overview_polyline: { points: geometry },
          legs: [
            {
              distance: { value: distance },
              duration: { value: duration },
            },
          ],
        },
      ],
    };
    return res.status(200).json(normalized);
  } catch (err) {
    console.error("❌ Proxy Directions erreur:", err);
    res.status(500).json({ error: "Erreur proxy Directions" });
  }
});

// ---------------- CRON ----------------
cron.schedule("0 0 * * *", async () => {
  try {
    const [result] = await db.query(
      "UPDATE users SET reset_code = NULL, reset_expires = NULL WHERE reset_expires < NOW()"
    );
    console.log(`🧹 Nettoyage tokens expirés : ${result.affectedRows} ligne(s)`);
  } catch (err) {
    console.error("❌ Erreur cron nettoyage:", err);
  }
});

// ---------------- STATICS ----------------
app.use("/uploads", express.static("uploads"));

// ---------------- TEST SOCKET ----------------
app.post("/api/test/socket", async (req, res) => {
  const { message } = req.body;
  const payload = {
    message: message || "Test Socket.IO 🔥",
    timestamp: new Date().toISOString(),
  };

  console.log("📢 Envoi test socket :", payload);
  // ⚠️ Ici on ne fait PLUS que du Socket.IO, aucun push Expo
  notifyOperators("test_notification", payload);

  res.json({ success: true, sent: payload });
});

// ---------------- 404 (après toutes les routes) ----------------
app.use((req, res, next) => {
  if (res.headersSent) return next();
  res.status(404).json({ error: "NOT_FOUND", path: req.originalUrl });
});

// ---------------- ERREUR GLOBALE (tout à la fin) ----------------
app.use((err, req, res, next) => {
  console.error("❌ Erreur middleware globale:", err);
  res.status(500).json({ error: "Erreur interne serveur" });
});

// ---------------- DÉMARRAGE ----------------
const PORT = process.env.PORT || 5000;
// ✅ Export du socket et du suivi des utilisateurs
export { io, onlineUsers };

httpServer.listen(PORT, "0.0.0.0", () => {
  const ip = LAN_IP;
  console.log(
    `🚀 API + WebSocket opérationnels :\n   - Local :   http://localhost:${PORT}\n   - Réseau :  http://${ip}:${PORT}`
  );
});
