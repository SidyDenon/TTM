// routes/admin/dashboard.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { calculatePrice } from "../../utils/distance.js";
import authMiddleware from "../../middleware/auth.js";
import { loadAdminPermissions, checkPermission } from "../../middleware/checkPermission.js";
import { buildPublicUrl } from "../../config/links.js";

const router = express.Router();

// 🧠 Cache global pour le tableau de bord
let dashboardCache = { data: null, lastFetch: 0 };
let adminAvatarColumn = null;
let adminAvatarChecked = false;

const resolveAdminAvatarColumn = async (db) => {
  if (adminAvatarChecked) return adminAvatarColumn;
  const [[{ cnt }]] = await db.query(
    "SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admin_users' AND COLUMN_NAME = 'avatar_url'"
  );
  adminAvatarChecked = true;
  adminAvatarColumn = Number(cnt) > 0 ? "avatar_url" : null;
  return adminAvatarColumn;
};

const emitToAdmins = (req, event, payload) => {
  try {
    const io = req.io || req.app?.get?.("io");
    if (!io) {
      console.warn("⚠️ io non injecté sur req (req.io / req.app) pour l'événement", event);
      return;
    }
    io.to("admins").emit(event, payload);
  } catch (err) {
    console.warn("⚠️ Impossible d'émettre l'événement admin:", event, err?.message || err);
  }
};

export default (db, io, emitMissionEvent) => {
  // Injecte la DB (et io) dans req
  router.use((req, _res, next) => {
    req.db = db;
    req.io = io || req.io;
    req.emitMissionEvent = emitMissionEvent;
    next();
  });

  // Auth + RBAC pour TOUTES les routes
  router.use(authMiddleware, loadAdminPermissions);

  // =========================
  // 👤 Profil admin (mise à jour)
  // =========================
  const avatarDir = "uploads/avatars";
  if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, avatarDir),
    filename: (_req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
  });
  const upload = multer({ storage });

  router.put("/utilisateurs/:id", upload.single("avatar"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ error: "Accès admin requis" });
      }
      if (!req.isSuperAdmin && Number(req.user.id) !== id) {
        return res.status(403).json({ error: "Action non autorisée" });
      }

      const avatarCol = await resolveAdminAvatarColumn(req.db);
      const selectCols = ["id", "name", "email", "phone"];
      if (avatarCol) selectCols.push(avatarCol);
      const [[admin]] = await req.db.query(
        `SELECT ${selectCols.join(", ")} FROM admin_users WHERE id = ?`,
        [id]
      );
      if (!admin) return res.status(404).json({ error: "Admin introuvable" });

      const name = (req.body?.name ?? admin.name) || admin.name;
      const email = (req.body?.email ?? admin.email) || admin.email;
      const phone = (req.body?.phone ?? admin.phone) || admin.phone || null;
      const fields = ["name = ?", "email = ?", "phone = ?"];
      const params = [name, email, phone];
      let avatar_url = avatarCol ? admin[avatarCol] || null : null;
      if (req.file) {
        if (!avatarCol) {
          fs.unlink(req.file.path, () => {});
        } else {
          avatar_url = `/uploads/avatars/${req.file.filename}`;
          fields.push("avatar_url = ?");
          params.push(avatar_url);
        }
      }
      const sql = `UPDATE admin_users SET ${fields.join(", ")}, updated_at = NOW() WHERE id = ?`;
      await req.db.query(sql, [...params, id]);

      return res.json({
        message: "Profil mis à jour ✅",
        user: { id, name, email, phone, ...(avatarCol ? { avatar_url } : {}) },
      });
    } catch (err) {
      console.error("❌ PUT /admin/utilisateurs/:id:", err);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // =========================
  // 👥 Utilisateurs (liste simple)
  // =========================
  router.get("/utilisateurs", checkPermission("users_view"), async (req, res) => {
    try {
      const [rows] = await req.db.query("SELECT id, name, phone, role FROM users");
      res.json({ message: "Liste des utilisateurs récupérée ✅", data: rows });
    } catch (err) {
      console.error("❌ Erreur GET /utilisateurs:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // =========================
  // 💵 Calcul prix estimé avant publication
  // =========================
  router.post("/demandes/:id/prix", checkPermission("requests_manage"), async (req, res) => {
    try {
      const { operateurLat, operateurLng } = req.body;
      const { id } = req.params;

      const [rows] = await req.db.query("SELECT * FROM requests WHERE id = ?", [id]);
      if (rows.length === 0) return res.status(404).json({ error: "Demande introuvable" });

      const demande = rows[0];
      const { distance, price } = calculatePrice(
        demande.service,
        demande.lat,
        demande.lng,
        operateurLat,
        operateurLng
      );

      await req.db.query("UPDATE requests SET estimated_price = ? WHERE id = ?", [price, id]);

      res.json({
        message: "Prix estimé calculé ✅",
        data: { demandeId: id, prixEstime: price, distance },
      });
    } catch (err) {
      console.error("❌ Erreur POST /demandes/:id/prix:", err);
      res.status(500).json({ error: "Erreur lors du calcul du prix" });
    }
  });

  // =========================
  // 📣 Publier une mission
  // =========================
  router.post(
    "/requests/:id/publier",
    checkPermission("requests_manage"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const { price, distance } = req.body;
        if (price == null || distance == null) {
          return res.status(400).json({ error: "Prix et distance requis" });
        }

        const [rows] = await req.db.query("SELECT * FROM requests WHERE id = ?", [id]);
        if (rows.length === 0)
          return res.status(404).json({ error: "Demande introuvable" });

        await req.db.query(
          "UPDATE requests SET status = 'publiee', estimated_price = ?, published_at = NOW() WHERE id = ?",
          [price, id]
        );
        await req.db.query(
          "INSERT INTO request_events (request_id, type, meta, created_at) VALUES (?, 'publiee', ?, NOW())",
          [id, JSON.stringify({ admin_id: req.user.id, distance, price })]
        );

        const [[updated]] = await req.db.query(
          `SELECT r.*,
                  u.name  AS client_name,
                  u.phone AS client_phone
           FROM requests r
           JOIN users u ON u.id = r.user_id
           WHERE r.id = ?
           LIMIT 1`,
          [id]
        );
        const [photoRows] = await req.db
          .query(
            "SELECT url FROM request_photos WHERE request_id = ? ORDER BY id ASC",
            [id]
          )
          .catch(() => [[]]);
        const payload = {
          id: Number(updated.id),
          status: "publiee",
          service: updated.service,
          address: updated.address,
          zone: updated.zone,
          lat: updated.lat,
          lng: updated.lng,
          estimated_price: Number(price),
          user_id: updated.user_id,
          operator_id: updated.operator_id,
          client_name: updated.client_name || null,
          client_phone: updated.client_phone || null,
          published_at: updated.published_at,
          created_at: updated.created_at,
          distance: Number(distance),
          photos: (photoRows || []).map((p) => buildPublicUrl(p.url)),
        };

        const missionEmitter = req.emitMissionEvent || emitMissionEvent;
        if (missionEmitter) {
          missionEmitter(
            "mission:status_changed",
            { id: payload.id, status: payload.status },
            { operatorId: payload.operator_id, clientId: payload.user_id }
          );
          missionEmitter("mission:updated", payload, {
            operatorId: payload.operator_id,
            clientId: payload.user_id,
          });
        }
        emitToAdmins(req, "dashboard_update", {
          type: "request",
          action: "published",
          id: Number(id),
        });
        dashboardCache = { data: null, lastFetch: 0 }; // invalidate cache
        res.json({ message: "Mission publiee ✅", data: payload });
      } catch (err) {
        console.error("❌ Erreur POST /requests/:id/publier:", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  );

  // =========================
  // 🛑 Annuler une mission
  // =========================
  router.patch(
    "/requests/:id/annuler",
    checkPermission("requests_manage"),
    async (req, res) => {
      try {
        const { id } = req.params;

        const [rows] = await req.db.query("SELECT * FROM requests WHERE id = ?", [id]);
        if (rows.length === 0)
          return res.status(404).json({ error: "Mission introuvable" });

        await req.db.query("UPDATE requests SET status = 'annulee_admin' WHERE id = ?", [
          id,
        ]);
        console.log("🛑 annulee_admin ->", id);
        await req.db.query(
          "INSERT INTO request_events (request_id, type, meta, created_at) VALUES (?, 'annulee_admin', ?, NOW())",
          [id, JSON.stringify({ admin_id: req.user.id })]
        );

        const payload = {
          id: Number(id),
          status: "annulee_admin",
          message: `Mission #${id} annulee par un administrateur`,
        };
        const missionEmitter = req.emitMissionEvent || emitMissionEvent;
        if (missionEmitter) {
          const missionPayload = {
            ...rows[0],
            status: "annulee_admin",
          };
          missionEmitter(
            "mission:status_changed",
            { id: payload.id, status: payload.status },
            { operatorId: missionPayload.operator_id, clientId: missionPayload.user_id }
          );
          missionEmitter("mission:updated", missionPayload, {
            operatorId: missionPayload.operator_id,
            clientId: missionPayload.user_id,
          });
        }
        emitToAdmins(req, "dashboard_update", {
          type: "request",
          action: "cancelled",
          id: Number(id),
        });
        dashboardCache = { data: null, lastFetch: 0 };
        res.json({ message: "Mission annulee par l’admin ✅", data: payload });
      } catch (err) {
        console.error("❌ Erreur PATCH /requests/:id/annuler:", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  );

  // =========================================================
  // ✅ ROUTE PRINCIPALE ATTENDUE PAR LE FRONT
  // GET /api/admin/dashboard
  // =========================================================
  router.get("/", checkPermission("dashboard_view"), async (req, res) => {
    const now = Date.now();
    // cache 30s
    if (dashboardCache.data && now - dashboardCache.lastFetch < 30000) {
      return res.json({
        message: "Statistiques dashboard (cache) ✅",
        data: dashboardCache.data,
        cached: true,
      });
    }

    try {
      const [[missions]] = await req.db.query("SELECT COUNT(*) AS total FROM requests");
      const [[missionsEnCours]] = await req.db.query(
        `SELECT COUNT(*) AS total
         FROM requests
         WHERE LOWER(REPLACE(status,' ','_')) IN ('assignee','acceptee','en_route','sur_place','remorquage')`
      );
      const [[missionsTerminees]] = await req.db.query(
        `SELECT COUNT(*) AS total
         FROM requests
         WHERE LOWER(REPLACE(status,' ','_')) IN ('terminee', 'terminee', 'termine', 'termine')
            OR finished_at IS NOT NULL`
      );
      const [[clients]] = await req.db.query(
        "SELECT COUNT(*) AS total FROM users WHERE role = 'client'"
      );
      const [[operateurs]] = await req.db.query(
        "SELECT COUNT(*) AS total FROM users WHERE role IN ('operator','operateur','opérateur')"
      );

      const data = {
        // Champs que ton Dashboard.jsx lit
        avg_time: 0,
        clients_total: Number(clients.total || 0),
        operateurs_total: Number(operateurs.total || 0),

        // Totaux utiles
        totals: {
          total_requests: Number(missions.total || 0),
          total_publiees: 0, // optionnel: calcule si tu veux
          total_terminees: Number(missionsTerminees.total || 0),
          total_annulees: 0, // optionnel
          total_en_cours: Number(missionsEnCours.total || 0),
        },
      };

      dashboardCache = { data, lastFetch: now };
      res.json({
        message: "Statistiques dashboard (live) ✅",
        data,
        cached: false,
      });
    } catch (err) {
      console.error("❌ Erreur GET /api/admin/dashboard:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // =========================================================
  // GET /api/admin/dashboard/revenus
  // =========================================================
  router.get("/revenus", checkPermission("dashboard_view"), async (req, res) => {
    try {
      const [rows] = await req.db.query(`
        SELECT 
          DATE(finished_at) AS date,
          SUM(COALESCE(final_price, estimated_price, 0)) AS total_revenue,
          COUNT(*) AS missions
        FROM requests
        WHERE status = 'terminee' 
          AND finished_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY DATE(finished_at)
        ORDER BY DATE(finished_at)
      `);

      const labels = rows.map((r) => r.date);
      const revenues = rows.map((r) => Number(r.total_revenue || 0));
      const missions = rows.map((r) => Number(r.missions || 0));

      res.json({
        message: "Revenus sur 7 jours ✅",
        data: { labels, revenues, missions },
      });
    } catch (err) {
      console.error("❌ Erreur GET /revenus:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // =========================================================
  // GET /api/admin/dashboard/top-services
  // =========================================================
  router.get(
    "/top-services",
    checkPermission("dashboard_view"),
    async (req, res) => {
      try {
        const [rows] = await req.db.query(`
        SELECT 
          service,
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'terminee' THEN 1 ELSE 0 END) AS terminees
        FROM requests
        GROUP BY service
        ORDER BY total DESC
        LIMIT 5
      `);

        res.json({ message: "Top 5 services ✅", data: rows });
      } catch (err) {
        console.error("❌ Erreur GET /top-services:", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  );

  return router;
};
