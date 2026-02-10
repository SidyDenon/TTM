import express from "express";
import cors from "cors";
import { createServer } from "http";

import db from "./config/db.js";
import { corsOptions, allowedOrigins, LAN_IP } from "./config/cors.js";
import { validateEnv } from "./config/env.js";
import {
  initSocket,
  emitMissionEvent,
  notifyOperators,
  onlineUsers,
} from "./socket/index.js";
import { startOperatorAlerts } from "./services/operatorAlerts.js";
import { startCron } from "./services/cron.js";

import clientsRoutes from "./routes/admin/clients.js";
import operatorsRoutes from "./routes/admin/operators.js";
import requestsRoutes from "./routes/admin/requests.js";
import requestsDebugRoutes from "./routes/admin/requests.debug.js";
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
import meRoutes from "./routes/me.js";
import publicConfigRoutes from "./routes/public/config.public.js";
import directionsRoutes from "./routes/directions.js";
import adminDebugRoutes from "./routes/admin/debug.js";
import debugRoutes from "./routes/debug.js";
import { loadAdminPermissions } from "./middleware/checkPermission.js";

const app = express();
app.use(express.json());

app.get("/api/ping", (req, res) => {
  res.json({ ok: true });
});

app.use(cors(corsOptions));
// Express 5 + path-to-regexp v6: avoid '*' string path
app.options(/.*/, cors(corsOptions));

// Forcer JSON uniquement pour l’API (pas pour /uploads)
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) res.type("application/json");
  next();
});

await validateEnv(db);

const httpServer = createServer(app);
const io = initSocket(httpServer, { allowedOrigins, db });
app.set("io", io);
app.set("onlineUsers", onlineUsers);

startOperatorAlerts(db);
startCron({ db, emitMissionEvent });

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
app.use("/api/admin/requests", requestsDebugRoutes(db));
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
app.use("/api/admin/rbac/roles", rbacRolesRoutes(db));
app.use("/api/admin/rbac/users", rbacUsersRoutes(db));
app.use("/api/admin/_debug", adminDebugRoutes());
app.use("/api/services/public", servicesPublicRoutes(db));
app.use("/api/config/public", publicConfigRoutes(db));
app.use("/api/operator", operatorRoutes(db));
app.use("/api/directions", directionsRoutes());
app.use("/api", meRoutes(db));
// ✅ Toutes les routes /api/admin sont protégées automatiquement
app.use("/api", authRoutes(db));

app.use("/api/test", debugRoutes());

// ---------------- STATICS ----------------
app.use("/uploads", express.static("uploads"));
app.use("/service-icons", express.static("public/service-icons"));
app.use("/icons", express.static("public/service-icons"));

// ---------------- 404 ----------------
app.use((req, res, next) => {
  if (res.headersSent) return next();
  res.status(404).json({ error: "NOT_FOUND", path: req.originalUrl });
});

// ---------------- ERREUR GLOBALE ----------------
app.use((err, req, res, next) => {
  console.error("❌ Erreur middleware globale:", err);
  res.status(500).json({ error: "Erreur interne serveur" });
});

// ---------------- DÉMARRAGE ----------------
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, "0.0.0.0", () => {
  const ip = LAN_IP;
  console.log(
    `API + WebSocket opérationnels :\n   - Local :   http://localhost:${PORT}\n   - Réseau :  http://${ip}:${PORT}`
  );
});
