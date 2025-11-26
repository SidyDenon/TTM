import express from "express";
import { upload } from "../../middleware/upload.js";
import authMiddleware from "../../middleware/auth.js";
import { loadAdminPermissions, checkPermission } from "../../middleware/checkPermission.js";
import { sendPushNotification } from "../../utils/sendPush.js";
import { buildPublicUrl } from "../../config/links.js";

const router = express.Router();

const formatMissionForSocket = (row = {}) => {
  const toNumber = (value) =>
    value === null || value === undefined || value === "" ? null : Number(value);
  return {
    id: row.id,
    status: row.status,
    service: row.service ?? row.type ?? null,
    description: row.description ?? null,
    address: row.address ?? null,
    zone: row.zone ?? row.ville ?? null,
    lat: toNumber(row.lat),
    lng: toNumber(row.lng),
    destination: row.destination ?? null,
    dest_lat: toNumber(row.dest_lat),
    dest_lng: toNumber(row.dest_lng),
    estimated_price:
      row.estimated_price !== undefined && row.estimated_price !== null
        ? Number(row.estimated_price)
        : null,
    currency: row.currency ?? null,
    created_at: row.created_at ?? null,
    published_at: row.published_at ?? null,
    updated_at: row.updated_at ?? null,
    user_id: row.user_id ?? null,
    client_name: row.client_name ?? row.user_name ?? null,
    client_phone: row.client_phone ?? row.user_phone ?? null,
    operator_id: row.operator_id ?? null,
    operator_name: row.operator_name ?? null,
    operator_phone: row.operator_phone ?? null,
    photos: row.photos ?? [],
  };
};

export default (db, io, emitMissionEvent) => {
  // 🔗 Injection de db + io
  router.use((req, _res, next) => {
    req.db = db;
    req.io = io;
    req.emitMissionEvent = emitMissionEvent;
    next();
  });

  // 🔐 Auth + permissions pour tout le module
  router.use(authMiddleware, loadAdminPermissions);

  // ===============================
  //  GET /api/admin/requests
  //  Liste des missions (pagination)
  //  - mode normal (avec joins + photos)
  //  - mode compact (?compact=1) ultra-sûr, sans JOIN ni JSON
  // ===============================
  router.get("/", checkPermission("requests_view"), async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const compact = String(req.query.compact || "") === "1";
    const statusFilter = String(req.query.status || "").toLowerCase().trim();
    const idFilterRaw = req.query.id ?? req.query.q;
    const idFilter = Number(idFilterRaw);

    const runCompact = async () => {
      // 1) Essaye version enrichie (colonnes directes sans JOIN)
      try {
        const whereParts = [];
        const filterParams = [];

        if (statusFilter) {
          whereParts.push("status = ?");
          filterParams.push(statusFilter);
        }
        if (idFilterRaw && Number.isFinite(idFilter)) {
          whereParts.push("id = ?");
          filterParams.push(idFilter);
        }

        const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

        const listParams = [...filterParams, limit, offset];

        const [rows] = await req.db.query(
          `SELECT id, status, created_at,
                  service, address, zone, lat, lng, estimated_price,
                  user_id, operator_id
           FROM requests
           ${whereSql}
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`,
          listParams
        );

        const [[{ total }]] = await req.db.query(
          `SELECT COUNT(*) AS total FROM requests ${whereSql}`,
          filterParams
        );

        if (rows.length === 0) {
          return res.json({
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            data: [],
          });
        }

        // Noms clients/opérateurs via 2 requêtes
        const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
        const operatorIds = [...new Set(rows.map((r) => r.operator_id).filter(Boolean))];
        const usersById = new Map();
        const opsById = new Map();

        if (userIds.length) {
          const ph = userIds.map(() => "?").join(",");
          const [urows] = await req.db.query(
            `SELECT id, name, phone FROM users WHERE id IN (${ph})`,
            userIds
          );
          urows.forEach((u) => usersById.set(u.id, u));
        }

        if (operatorIds.length) {
          const ph = operatorIds.map(() => "?").join(",");
          const [orows] = await req.db.query(
            `SELECT id, name FROM users WHERE id IN (${ph})`,
            operatorIds
          );
          orows.forEach((o) => opsById.set(o.id, o));
        }

        // Photos optionnelles
        const ids = rows.map((r) => r.id);
        const placeholders = ids.map(() => "?").join(",");
        let photoRows = [];
        try {
          [photoRows] = await req.db.query(
            `SELECT request_id, url FROM request_photos WHERE request_id IN (${placeholders}) ORDER BY id ASC`,
            ids
          );
        } catch {
          photoRows = [];
        }

        const photosByReq = new Map();
        for (const pr of photoRows) {
          if (!photosByReq.has(pr.request_id)) photosByReq.set(pr.request_id, []);
          photosByReq.get(pr.request_id).push(pr.url);
        }

        const data = rows.map((r) => {
          const u = r.user_id ? usersById.get(r.user_id) : null;
          const o = r.operator_id ? opsById.get(r.operator_id) : null;
          const urls = photosByReq.get(r.id) || [];
          const photos = urls.map((url) =>
            url?.startsWith("http") ? url : buildPublicUrl(url || "")
          );
          return {
            id: r.id,
            status: r.status,
            created_at: r.created_at,
            service: r.service ?? null,
            estimated_price: r.estimated_price ?? null,
            zone: r.zone ?? null,
            address: r.address ?? null,
            lat: r.lat ?? null,
            lng: r.lng ?? null,
            user_name: u?.name || null,
            user_phone: u?.phone || null,
            operator_name: o?.name || null,
            photos,
          };
        });

        return res.json({
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          data,
        });
      } catch (e) {
        // 2) Fallback minimal sûr
        const [rows] = await req.db.query(
          `SELECT id, status, created_at
           FROM requests
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`,
          [limit, offset]
        );
        const [[{ total }]] = await req.db.query(
          `SELECT COUNT(*) AS total FROM requests`
        );
        return res.json({
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          data: rows.map((r) => ({
            id: r.id,
            status: r.status,
            created_at: r.created_at,
            service: null,
            estimated_price: null,
            zone: null,
            address: null,
            user_name: null,
            user_phone: null,
            operator_name: null,
            photos: [],
          })),
        });
      }
    };

    try {
      if (compact) return await runCompact();

      // 🔧 MODE NORMAL (sans JSON functions ni GROUP BY, avec 2e requête photos)
      const sqlList = `
        SELECT
          r.id,
          r.service,
          r.status,
          r.created_at,
          r.estimated_price,
          r.zone AS zone,
          r.address AS address,
          u.name  AS user_name,
          u.phone AS user_phone,
          ou.name AS operator_name
        FROM requests r
        LEFT JOIN users u  ON u.id  = r.user_id
        LEFT JOIN users ou ON ou.id = r.operator_id
        WHERE 1
        ${statusFilter ? "AND r.status = ?" : ""}
        ${idFilterRaw && Number.isFinite(idFilter) ? "AND r.id = ?" : ""}
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
      `;

      let rows;
      try {
        const params = [];
        if (statusFilter) params.push(statusFilter);
        if (idFilterRaw && Number.isFinite(idFilter)) params.push(idFilter);
        params.push(limit, offset);
        [rows] = await req.db.query(sqlList, params);
      } catch (e) {
        // Fallback si colonnes inconnues (zone/address ou phone)
        if (e?.code === "ER_BAD_FIELD_ERROR" || e?.code === "ER_NO_SUCH_TABLE") {
          console.warn(
            "⚠️ Fallback compact mode for /admin/requests due to schema mismatch:",
            e.code
          );
          return await runCompact();
        }
        throw e;
      }

      const countSql = `
        SELECT COUNT(*) AS total
        FROM requests r
        WHERE 1
        ${statusFilter ? "AND r.status = ?" : ""}
        ${idFilterRaw && Number.isFinite(idFilter) ? "AND r.id = ?" : ""}
      `;
      const countParams = [];
      if (statusFilter) countParams.push(statusFilter);
      if (idFilterRaw && Number.isFinite(idFilter)) countParams.push(idFilter);
      const [[{ total }]] = await req.db.query(countSql, countParams);

      if (rows.length === 0) {
        return res.json({
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          data: [],
        });
      }

      // Photos en 2e requête
      const ids = rows.map((r) => r.id);
      const placeholders = ids.map(() => "?").join(",");
      let photoRows = [];
      try {
        [photoRows] = await req.db.query(
          `SELECT request_id, url FROM request_photos WHERE request_id IN (${placeholders}) ORDER BY id ASC`,
          ids
        );
      } catch (e2) {
        if (e2?.code === "ER_NO_SUCH_TABLE") {
          photoRows = [];
        } else {
          throw e2;
        }
      }
      const photosByReq = new Map();
      for (const pr of photoRows) {
        if (!photosByReq.has(pr.request_id)) photosByReq.set(pr.request_id, []);
        photosByReq.get(pr.request_id).push(pr.url);
      }
      const data = rows.map((r) => {
        const urls = photosByReq.get(r.id) || [];
        const photos = urls.map((url) =>
          url?.startsWith("http") ? url : buildPublicUrl(url || "")
        );
        return {
          id: r.id,
          service: r.service ?? null,
          status: r.status,
          created_at: r.created_at,
          estimated_price: r.estimated_price ?? null,
          zone: r.zone ?? null,
          address: r.address ?? null,
          user_name: r.user_name ?? null,
          user_phone: r.user_phone ?? null,
          operator_name: r.operator_name ?? null,
          photos,
        };
      });

      return res.json({
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        data,
      });
    } catch (err) {
      console.error(
        "❌ Erreur GET /admin/requests:",
        err.code || "",
        err.sqlState || "",
        err.sqlMessage || err.message
      );
      try {
        if (!compact) {
          // Dernier filet de sécurité: renvoyer le mode compact
          return await runCompact();
        }
      } catch (_) {}
      return res.status(500).json({
        error: "DB_FAIL",
        detail: err.sqlMessage || err.message || "Erreur serveur",
        code: err.code || null,
      });
    }
  });

  // ===================================
  //  POST /api/admin/requests/:id/photos
  // ===================================
  router.post(
    "/:id/photos",
    checkPermission("requests_manage"),
    upload.array("photos", 5),
    async (req, res) => {
      const requestId = req.params.id;
      try {
        if (!req.files || req.files.length === 0) {
          return res.status(400).json({ error: "Aucune photo envoyée" });
        }

        const urls = [];
        for (const file of req.files) {
          if (!file.mimetype || !file.mimetype.startsWith("image/")) {
            return res.status(400).json({ error: "Format non autorisé" });
          }
          const url = `/uploads/requests/${file.filename}`;
          urls.push(url);
          await req.db.query(
            "INSERT INTO request_photos (request_id, url) VALUES (?, ?)",
            [requestId, url]
          );
        }

        res.json({ message: "Photos ajoutées ✅", photos: urls });
      } catch (err) {
        console.error(
          "❌ Erreur POST /admin/requests/:id/photos:",
          err.code || "",
          err.sqlState || "",
          err.sqlMessage || err.message
        );
        res.status(500).json({ error: "Erreur upload photo" });
      }
    }
  );

  // ===================================
  //  PATCH /api/admin/requests/:id/assigner
  // ===================================
  router.patch("/:id/assigner", checkPermission("requests_manage"), async (req, res) => {
    try {
      const { operator_id } = req.body;
      if (!operator_id) return res.status(400).json({ error: "Opérateur requis" });

      await req.db.query(
        "UPDATE requests SET operator_id = ?, status = 'acceptee', accepted_at = NOW() WHERE id = ?",
        [operator_id, req.params.id]
      );

      await req.db.query(
        "INSERT INTO request_events (request_id, type, meta, created_at) VALUES (?, 'acceptee', ?, NOW())",
        [req.params.id, JSON.stringify({ admin_id: req.user.id, operator_id })]
      );

      const [[request]] = await req.db.query(
        `SELECT r.*, u.name AS client_name, u.phone AS client_phone, ou.name AS operator_name, ou.phone AS operator_phone
         FROM requests r
         LEFT JOIN users u ON u.id = r.user_id
         LEFT JOIN users ou ON ou.id = r.operator_id
         WHERE r.id = ?`,
        [req.params.id]
      );

      const missionPayload = formatMissionForSocket(request);
      const missionEmitter = req.emitMissionEvent || emitMissionEvent;
      if (missionEmitter) {
        missionEmitter(
          "mission:status_changed",
          { id: missionPayload.id, status: missionPayload.status, operator_id: missionPayload.operator_id },
          { operatorId: operator_id, clientId: request.user_id }
        );
        missionEmitter("mission:updated", missionPayload, {
          operatorId: operator_id,
          clientId: request.user_id,
        });
      }

      // 🔔 Push Expo à l'opérateur
      try {
        const [[op]] = await req.db.query(
          "SELECT notification_token FROM users WHERE id = ? AND notification_token IS NOT NULL",
          [operator_id]
        );
        if (op) {
          await sendPushNotification(
            op.notification_token,
            "🚨 Nouvelle mission assignée",
            `Mission #${request.id} – ${request.service || "Service"}`,
            { type: "mission", id: request.id }
          );
        }
      } catch {}

      res.json({ message: "Demande assignée ✅", request });
    } catch (err) {
      console.error(
        "❌ Erreur PATCH /admin/requests/:id/assigner:",
        err.code || "",
        err.sqlState || "",
        err.sqlMessage || err.message
      );
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ===================================
  //  PATCH /api/admin/requests/:id/status
  // ===================================
  router.patch("/:id/status", checkPermission("requests_manage"), async (req, res) => {
    try {
      const { status } = req.body;
      const validStatuses = [
        "en_attente",
        "publiee",
        "acceptee",
        "en_route",
        "sur_place",
        "terminee",
        "annulee_admin",
        "annulee_client",
      ];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Statut invalide" });
      }

      await req.db.query("UPDATE requests SET status = ? WHERE id = ?", [
        status,
        req.params.id,
      ]);

      const [[request]] = await req.db.query(
        `SELECT r.*, ou.name AS operator_name, ou.phone AS operator_phone
         FROM requests r
         LEFT JOIN users ou ON ou.id = r.operator_id
         WHERE r.id = ?`,
        [req.params.id]
      );

      const mission = {
        id: request.id,
        status: request.status,
        operator_name: request.operator_name || null,
        operator_phone: request.operator_phone || null,
      };

      const missionPayload = formatMissionForSocket(request);
      const missionEmitter = req.emitMissionEvent || emitMissionEvent;
      if (missionEmitter) {
        missionEmitter(
          "mission:status_changed",
          { id: missionPayload.id, status: missionPayload.status, operator_id: missionPayload.operator_id },
          { operatorId: missionPayload.operator_id, clientId: request.user_id }
        );
        missionEmitter("mission:updated", missionPayload, {
          operatorId: missionPayload.operator_id,
          clientId: request.user_id,
        });
      }

      res.json({ message: "Statut mis à jour ✅", request });
    } catch (err) {
      console.error(
        "❌ Erreur PATCH /admin/requests/:id/status:",
        err.code || "",
        err.sqlState || "",
        err.sqlMessage || err.message
      );
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ===================================
  //  GET /api/admin/requests/:id/events
  // ===================================
  router.get("/:id/events", checkPermission("requests_view"), async (req, res) => {
    try {
      const { id } = req.params;
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
      const offset = (page - 1) * limit;

      const [rows] = await req.db.query(
        "SELECT * FROM request_events WHERE request_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?",
        [id, limit, offset]
      );

      const [[{ total }]] = await req.db.query(
        "SELECT COUNT(*) AS total FROM request_events WHERE request_id = ?",
        [id]
      );

      res.json({
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        data: rows,
      });
    } catch (err) {
      console.error(
        "❌ Erreur GET /admin/requests/:id/events:",
        err.code || "",
        err.sqlState || "",
        err.sqlMessage || err.message
      );
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ===================================
  //  POST /api/admin/requests/:id/publier
  // ===================================
  router.post("/:id/publier", checkPermission("requests_manage"), async (req, res) => {
    try {
      const { id } = req.params;
      const { price, distance } = req.body;

      if (price == null || distance == null) {
        return res.status(400).json({ error: "Prix et distance requis" });
      }

      const [[request]] = await req.db.query("SELECT * FROM requests WHERE id = ?", [id]);
      if (!request) {
        return res.status(404).json({ error: "Demande introuvable" });
      }

      await req.db.query(
        "UPDATE requests SET status = 'publiee', estimated_price = ?, published_at = NOW() WHERE id = ?",
        [price, id]
      );

      await req.db.query(
        "INSERT INTO request_events (request_id, type, meta, created_at) VALUES (?, 'publiee', ?, NOW())",
        [id, JSON.stringify({ admin_id: req.user.id, distance, price })]
      );

      const [[updated]] = await req.db.query("SELECT * FROM requests WHERE id = ?", [id]);

      const missionPayload = formatMissionForSocket(updated);
      const missionEmitter = req.emitMissionEvent || emitMissionEvent;
      if (missionEmitter) {
        missionEmitter(
          "mission:status_changed",
          { id: missionPayload.id, status: missionPayload.status },
          { clientId: updated.user_id }
        );
        missionEmitter("mission:updated", missionPayload, { clientId: updated.user_id });
      }

      // 🔔 Push Expo
      try {
        const [operators] = await req.db.query(
          "SELECT notification_token FROM users WHERE role = 'operator' AND notification_token IS NOT NULL"
        );
        for (const op of operators) {
          await sendPushNotification(
            op.notification_token,
            "🚨 Nouvelle mission disponible",
            `${updated.service || "Service"} - ${updated.address || "Adresse"}`,
            { type: "mission", id: updated.id }
          );
        }
      } catch (e) {
        console.warn(
          "⚠️ Impossible d'envoyer les push opérateurs:",
          e?.message || e
        );
      }

      res.json({ message: "Mission publiée ✅", request: updated });
    } catch (err) {
      console.error(
        "❌ Erreur POST /admin/requests/:id/publier:",
        err.code || "",
        err.sqlState || "",
        err.sqlMessage || err.message
      );
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ===================================
  //  DELETE /api/admin/requests/:id
  // ===================================
  router.delete("/:id", checkPermission("requests_manage"), async (req, res) => {
    try {
      const { id } = req.params;

      const [rows] = await req.db.query("SELECT * FROM requests WHERE id = ?", [id]);
      if (rows.length === 0) {
        return res.status(404).json({ error: "Mission introuvable" });
      }

      await req.db.query("DELETE FROM request_photos WHERE request_id = ?", [id]);
      await req.db.query("DELETE FROM requests WHERE id = ?", [id]);

      await req.db.query(
        "INSERT INTO request_events (request_id, type, meta, created_at) VALUES (?, 'supprimee_admin', ?, NOW())",
        [id, JSON.stringify({ admin_id: req.user.id })]
      );

      const missionEmitter = req.emitMissionEvent || emitMissionEvent;
      missionEmitter?.("mission:deleted", { id: Number(id) });

      res.json({ message: `Mission #${id} supprimée ✅` });
    } catch (err) {
      console.error(
        "❌ Erreur DELETE /admin/requests/:id:",
        err.code || "",
        err.sqlState || "",
        err.sqlMessage || err.message
      );
      res.status(500).json({ error: err.message || "Erreur serveur" });
    }
  });

  return router;
};
