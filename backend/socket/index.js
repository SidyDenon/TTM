import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { getSchemaColumns } from "../utils/schema.js";

let io = null;
let dbRef = null;

const onlineUsers = {
  clients: new Map(),
  operators: new Map(),
  admins: new Map(),
};
const operatorMeta = new Map(); // id -> { is_internal: boolean }

function emitAdminsOnline(target) {
  const payload = {
    ids: Array.from(onlineUsers.admins.keys()).map((id) => Number(id)),
  };
  if (target && typeof target.emit === "function") {
    target.emit("admins_online", payload);
    return;
  }
  io.to("admins").emit("admins_online", payload);
}

async function emitOperatorsOnline(target) {
  const ids = Array.from(onlineUsers.operators.keys()).map((id) => Number(id));
  let operators = ids.map((id) => ({ id, has_active_mission: false }));
  if (ids.length && dbRef) {
    try {
      const placeholders = ids.map(() => "?").join(",");
      const [rows] = await dbRef.query(
        `SELECT operator_id, COUNT(*) AS active_count
         FROM requests
         WHERE operator_id IN (${placeholders})
           AND status IN ('acceptee','en_route','sur_place')
         GROUP BY operator_id`,
        ids
      );
      const activeSet = new Set(rows.map((r) => Number(r.operator_id)));
      operators = ids.map((id) => ({ id, has_active_mission: activeSet.has(Number(id)) }));
    } catch (err) {
      console.warn("⚠️ operators_online active missions:", err?.message || err);
    }
  }
  const payload = { ids, operators };
  if (target && typeof target.emit === "function") {
    await target.emit("operators_online", payload);
    return;
  }
  io.to("admins").emit("operators_online", payload);
}

function joinRoleRooms(user, socket, meta = {}) {
  if (!user || !socket) return;
  const id = Number(user.id);
  const role = String(user.role || "").toLowerCase();
  const rooms = new Set();

  if (role === "admin") {
    rooms.add("admins");
    rooms.add(`admin:${id}`);
  }
  if (["operator", "operateur", "opérateur"].includes(role)) {
    const isInternal = !!meta.is_internal;
    rooms.add("operators");
    rooms.add(isInternal ? "operators_internal" : "operators_external");
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

async function canJoinMissionRoom(user, requestId) {
  const rid = Number(requestId);
  if (!Number.isInteger(rid) || rid <= 0) return false;

  const role = String(user?.role || "").toLowerCase();
  const uid = Number(user?.id);
  if (!Number.isInteger(uid) || uid <= 0) return false;

  if (role === "admin") return true;
  if (!dbRef) return false;

  if (role === "client") {
    const [rows] = await dbRef.query(
      "SELECT id FROM requests WHERE id = ? AND user_id = ? LIMIT 1",
      [rid, uid]
    );
    return rows.length > 0;
  }

  if (["operator", "operateur", "opérateur"].includes(role)) {
    const [rows] = await dbRef.query(
      "SELECT id FROM requests WHERE id = ? AND operator_id = ? LIMIT 1",
      [rid, uid]
    );
    return rows.length > 0;
  }

  return false;
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
  if (operators) targets.add("operators_external");
  if (clients) targets.add("clients");
  if (operatorId) targets.add(`operator:${Number(operatorId)}`);
  if (clientId) targets.add(`client:${Number(clientId)}`);
  if (mission?.id) targets.add(`mission_${mission.id}`);

  for (const room of targets) {
    try {
      io.to(room).emit(event, payload);
    } catch (err) {
      console.warn(`⚠️ Emission ${event} vers ${room} échouée:`, err?.message || err);
    }
  }
}

async function registerSocket(user, socket) {
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

  let meta = {};
  if (role === "operator" && dbRef) {
    try {
      const { operatorDispo, operatorInternal } = await getSchemaColumns(dbRef);
      const fields = [];
      if (operatorInternal) fields.push(`${operatorInternal} AS is_internal`);
      if (operatorDispo) fields.push(`${operatorDispo} AS dispo`);
      const sel = fields.length ? fields.join(", ") : "is_internal";
      const [[op]] = await dbRef
        .query(`SELECT ${sel} FROM operators WHERE user_id = ? LIMIT 1`, [id])
        .catch(() => [[]]);

      const isBlocked = operatorDispo && op && Number(op.dispo) === 0;
      if (isBlocked) {
        socket.emit("operator_blocked", { reason: "dispo_zero" });
        console.log(`🚫 Operator ${id} bloqué (dispo=0), rooms non rejointes`);
        return;
      }

      if (op && ((operatorInternal && "is_internal" in op) || "is_internal" in op)) {
        meta.is_internal = !!op.is_internal;
      }
      operatorMeta.set(id, meta);
    } catch (err) {
      console.warn("⚠️ Impossible de récupérer is_internal:", err?.message || err);
    }
  }

  map.set(id, socket.id);
  joinRoleRooms(user, socket, meta);
  console.log("Utilisateurs connectés:", {
    clients: onlineUsers.clients.size,
    operators: onlineUsers.operators.size,
    admins: onlineUsers.admins.size,
  });

  console.log(`✅ ${role} ${id} enregistré sur socket ${socket.id}`);
  socket.emit("register_success", { userId: id });

  if (role === "admin") {
    emitAdminsOnline(socket);
    emitOperatorsOnline(socket);
  }
  if (role === "operator") {
    emitOperatorsOnline();
  }
}

function cleanupSocket(socketId) {
  let found = false;
  let adminsChanged = false;
  let operatorsChanged = false;
  for (const [roleName, map] of Object.entries(onlineUsers)) {
    for (const [uid, sid] of map.entries()) {
      if (sid === socketId) {
        map.delete(uid);
        if (roleName === "operators") {
          operatorMeta.delete(Number(uid));
          operatorsChanged = true;
        }
        if (roleName === "admins") {
          adminsChanged = true;
        }
        console.log(`🧹 Nettoyage ${roleName} ${uid}`);
        found = true;
      }
    }
  }
  if (!found) {
    console.log(`⚠️ Socket ${socketId} non trouvé dans onlineUsers`);
  }
  if (adminsChanged) {
    emitAdminsOnline();
  }
  if (operatorsChanged) {
    emitOperatorsOnline();
  }
}

// ✅ notifyOperators : Socket.IO **uniquement**
export async function notifyOperators(event, payload, options = {}) {
  const { targetInternal = null } = options; // null = tous, true = internes, false = externes
  let count = 0;
  for (const [opId, socketId] of onlineUsers.operators.entries()) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      const meta = operatorMeta.get(Number(opId)) || {};
      if (targetInternal === true && !meta.is_internal) continue;
      if (targetInternal === false && meta.is_internal) continue;
      socket.emit(event, payload);
      count++;
    } else {
      console.log(`⚠️ Socket ${socketId} n'existe plus pour opérateur ${opId}`);
      onlineUsers.operators.delete(opId);
      operatorMeta.delete(Number(opId));
    }
  }
  console.log(`Notification Socket.IO "${event}" envoyée à ${count} opérateur(s)`);
}

export function notifyUser(userId, event, data) {
  try {
    const uid = Number(userId);
    const socketId = onlineUsers.clients.get(uid);

    if (socketId) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        console.log(` [notifyUser] → user:${uid} event:${event} payload:`, data);
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

export function notifyRoom(requestId, event, data) {
  const room = `mission_${requestId}`;
  io.to(room).emit(event, data);
  console.log(`Notification envoyée à la room ${room} : ${event}`);
}

export function initSocket(httpServer, { allowedOrigins, db }) {
  dbRef = db;
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST", "PATCH"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Token manquant — connexion refusée"));
    }
    try {
      const user = jwt.verify(token, process.env.JWT_SECRET);
      const r = String(user.role || "").toLowerCase();
      if (r === "operateur" || r === "opérateur") user.role = "operator";
      if (r === "administrateur") user.role = "admin";
      socket.user = user;
      console.log(` Authentifié: ${user.role} ${user.id}`);
      next();
    } catch (err) {
      console.log("❌ Token invalide:", err.message);
      next(new Error("Token invalide"));
    }
  });

  io.on("connection", async (socket) => {
    console.log("⚡ Nouveau client connecté:", socket.id);
    const user = socket.user;

    if (!user) {
      // Toujours authentifié grâce au middleware io.use — ce bloc ne devrait plus être atteint
      socket.disconnect();
    } else {
      await registerSocket(user, socket);
    }

    socket.on("join_request", async ({ requestId }) => {
      if (!socket.user) {
        console.log("⚠️ join_request refusé: utilisateur non authentifié");
        return;
      }
      if (!requestId) return;
      try {
        const allowed = await canJoinMissionRoom(socket.user, requestId);
        if (!allowed) {
          console.log(`⚠️ join_request refusé: accès non autorisé à mission_${requestId}`);
          socket.emit("join_request_denied", { requestId });
          return;
        }
        const room = `mission_${Number(requestId)}`;
        socket.join(room);
        console.log(`✅ ${socket.id} rejoint la room ${room}`);
      } catch (err) {
        console.error("❌ join_request erreur:", err?.message || err);
        socket.emit("join_request_denied", { requestId });
      }
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
      io.to("admins").emit("operator_position_update", payload);
    });

    socket.on("leave_request", ({ requestId }) => {
      if (!socket.user || !requestId) return;
      socket.leave(`mission_${requestId}`);
      console.log(`👋 ${socket.user?.role} ${socket.user?.id} quitte ${requestId}`);
    });

    socket.on("admins_online_request", () => {
      const role = String(socket.user?.role || "").toLowerCase();
      if (role !== "admin") return;
      emitAdminsOnline(socket);
    });

    socket.on("operators_online_request", () => {
      const role = String(socket.user?.role || "").toLowerCase();
      if (role !== "admin") return;
      emitOperatorsOnline(socket);
    });

    socket.on("disconnect", (reason) => {
      console.log(`❌ Déconnexion socket ${socket.id} (${reason})`);
      cleanupSocket(socket.id);
    });

    socket.on("error", (error) => {
      console.error("❌ Erreur socket:", error);
    });
  });

  return io;
}

export { io, onlineUsers };
