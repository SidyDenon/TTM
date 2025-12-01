import express from "express";
import authMiddleware from "../../middleware/auth.js";
import { upload } from "../../middleware/upload.js";
import { buildPublicUrl } from "../../config/links.js";
import { getCommissionPercent } from "../../utils/commission.js";

const router = express.Router();

/** 🔹 Normalisation des photos JSON → tableau propre + URL complètes */
function buildPhotoURL(url) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const path = url.startsWith("/") ? url : `/${url}`;
  return buildPublicUrl(path);
}

function normalizePhotos(photos) {
  try {
    let arr = photos;
    if (typeof arr === "string") {
      try {
        arr = JSON.parse(arr);
      } catch {
        arr = [arr];
      }
    }
    return Array.isArray(arr)
      ? arr.filter(Boolean).map((p) => buildPhotoURL(p))
      : [];
  } catch {
    return [];
  }
}

const getIo = (req) => {
  try {
    return req.app?.get?.("io") || null;
  } catch {
    return null;
  }
};

const normalizeMissionPayload = (mission = {}, photos = []) => {
  const toNumber = (value) =>
    value === null || value === undefined || value === "" ? null : Number(value);
  return {
    id: mission.id,
    user_id: mission.user_id ?? null,
    operator_id: mission.operator_id ?? null,
    service: mission.service ?? null,
    status: mission.status ?? null,
    description: mission.description ?? null,
    address: mission.address ?? null,
    zone: mission.zone ?? mission.ville ?? null,
    lat: toNumber(mission.lat),
    lng: toNumber(mission.lng),
    destination: mission.destination ?? null,
    dest_lat: toNumber(mission.dest_lat),
    dest_lng: toNumber(mission.dest_lng),
    estimated_price:
      mission.estimated_price !== undefined && mission.estimated_price !== null
        ? Number(mission.estimated_price)
        : null,
    currency: mission.currency ?? null,
    created_at: mission.created_at ?? null,
    published_at: mission.published_at ?? null,
    updated_at: mission.updated_at ?? null,
    client_name: mission.client_name ?? mission.user_name ?? null,
    client_phone: mission.client_phone ?? mission.user_phone ?? null,
    operator_name: mission.operator_name ?? null,
    operator_phone: mission.operator_phone ?? null,
    photos: normalizePhotos(photos),
  };
};

const fetchMissionWithRelations = async (db, id) => {
  const [[mission]] = await db.query(
    `SELECT r.*,
            u.name  AS client_name,
            u.phone AS client_phone,
            ou.name AS operator_name,
            ou.phone AS operator_phone
     FROM requests r
     LEFT JOIN users u  ON u.id  = r.user_id
     LEFT JOIN users ou ON ou.id = r.operator_id
     WHERE r.id = ?
     LIMIT 1`,
    [id]
  );
  return mission || null;
};

export default (db, notifyOperators, emitMissionEvent) => {
  router.use((req, res, next) => {
    req.db = db;
    req.emitMissionEvent = emitMissionEvent;
    next();
  });

  // 📌 Lister MES demandes (compat sans JSON_ARRAYAGG)
  router.get("/", authMiddleware, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const rawLimit = parseInt(req.query.limit, 10);
      const limit = Math.min(50, Math.max(1, rawLimit || 10));
      const offset = (page - 1) * limit;

      const [rows] = await req.db.query(
        `SELECT r.*
         FROM requests r
         WHERE r.user_id = ?
         ORDER BY r.created_at DESC
         LIMIT ? OFFSET ?`,
        [req.user.id, limit, offset]
      );

      const [[{ total }]] = await req.db.query(
        "SELECT COUNT(*) AS total FROM requests WHERE user_id = ?",
        [req.user.id]
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

      const ids = rows.map((r) => r.id);
      const placeholders = ids.map(() => "?").join(",");
      const [photoRows] = await req.db.query(
        `SELECT request_id, url FROM request_photos WHERE request_id IN (${placeholders}) ORDER BY id ASC`,
        ids
      );
      const photosByReq = new Map();
      for (const pr of photoRows) {
        if (!photosByReq.has(pr.request_id)) photosByReq.set(pr.request_id, []);
        photosByReq.get(pr.request_id).push(pr.url);
      }

      const data = rows.map((r) => ({
        ...r,
        photos: normalizePhotos(photosByReq.get(r.id) || []),
      }));

      res.json({
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        data,
      });
    } catch (err) {
      console.error("❌ Erreur GET /requests:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ⚡📌 Récupérer la mission active du client (compat sans JSON_ARRAYAGG)
  router.get("/active", authMiddleware, async (req, res) => {
    try {
      const [rows] = await req.db.query(
        `SELECT r.*,
                ou.name  AS operator_name,
                ou.phone AS operator_phone
         FROM requests r
         LEFT JOIN users ou ON ou.id = r.operator_id
         WHERE r.user_id = ?
           AND r.status NOT IN ('terminee', 'annulee', 'annulee_client', 'annulee_admin')
         ORDER BY r.created_at DESC
         LIMIT 1`,
        [req.user.id]
      );

      if (!rows.length) {
        return res.json({ data: null });
      }

      const reqId = rows[0].id;
      const [photosRows] = await req.db.query(
        `SELECT url FROM request_photos WHERE request_id = ? ORDER BY id ASC`,
        [reqId]
      );
      const photos = normalizePhotos(photosRows.map((p) => p.url));

      res.json({ data: { ...rows[0], photos } });
    } catch (err) {
      console.error("❌ Erreur /requests/active:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // 📌 Voir une demande précise (compat sans JSON_ARRAYAGG)
  router.get("/:id", authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await req.db.query(
        `SELECT r.*,
                ou.name  AS operator_name,
                ou.phone AS operator_phone
         FROM requests r
         LEFT JOIN users ou ON ou.id = r.operator_id
         WHERE r.id = ? AND r.user_id = ?
         LIMIT 1`,
        [id, req.user.id]
      );

      if (!rows.length) {
        return res.status(404).json({ error: "Demande introuvable" });
      }

      const [photosRows] = await req.db.query(
        `SELECT url FROM request_photos WHERE request_id = ? ORDER BY id ASC`,
        [id]
      );
      const photos = normalizePhotos(photosRows.map((p) => p.url));

      res.json({ message: "Demande récupérée ✅", data: { ...rows[0], photos } });
    } catch (err) {
      console.error("❌ Erreur GET /requests/:id:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // 📌 Historique d’une demande
  router.get("/:id/events", authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      const [[exists]] = await req.db.query(
        "SELECT id FROM requests WHERE id = ? AND user_id = ?",
        [id, req.user.id]
      );
      if (!exists) {
        return res.status(404).json({ error: "Demande introuvable" });
      }

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
      console.error("❌ Erreur GET /requests/:id/events:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  const cancelRequest = async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await req.db.query(
        "SELECT * FROM requests WHERE id = ? AND user_id = ?",
        [id, req.user.id]
      );

      if (!rows.length) {
        return res
          .status(404)
          .json({ error: "Demande introuvable ou non autorisée" });
      }

      const request = rows[0];
      if (
        !["en_attente", "publiee", "assignee", "acceptee"].includes(
          request.status
        )
      ) {
        return res.status(400).json({
          error: "Impossible d’annuler une demande déjà en cours ou terminée",
        });
      }

      await req.db.query("UPDATE requests SET status = 'annulee_client' WHERE id = ?", [
        id,
      ]);

      await req.db.query(
        "INSERT INTO request_events (request_id, type, meta, created_at) VALUES (?, 'annulee_client', ?, NOW())",
        [id, JSON.stringify({ user_id: req.user.id })]
      );

      notifyOperators("demande_annulee", {
        id,
        client_id: req.user.id,
        reason: "annulee par le client",
      });

      const payload = { id: Number(id), status: "annulee_client" };
      const missionEmitter = req.emitMissionEvent || emitMissionEvent;
      if (missionEmitter) {
        const missionRow = await fetchMissionWithRelations(req.db, id);
        const missionPayload = missionRow
          ? normalizeMissionPayload({ ...missionRow, status: "annulee_client" })
          : { ...payload };
        missionEmitter(
          "mission:status_changed",
          { id: payload.id, status: payload.status },
          { operatorId: missionPayload.operator_id, clientId: req.user.id }
        );
        missionEmitter("mission:updated", missionPayload, {
          operatorId: missionPayload.operator_id,
          clientId: req.user.id,
        });
      }

      res.json({ message: "Demande annulée ✅", data: payload });
    } catch (err) {
      console.error("❌ Erreur /requests/:id/cancel:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  };

  // 📌 Annuler une demande (compat PATCH + POST)
  router.patch("/:id/cancel", authMiddleware, cancelRequest);
  router.post("/:id/cancel", authMiddleware, cancelRequest);

  // 📌 Créer une demande
  // 📌 Créer une demande (avec calcul automatique remorquage)
router.post("/", authMiddleware, upload.array("photos", 5), async (req, res) => {
  try {
    const {
      service,
      description,
      lat,
      lng,
      address,
      zone,
      destination,
      dest_lat,
      dest_lng,
    } = req.body;

    if (!service || lat == null || lng == null) {
      return res.status(400).json({ error: "Champs obligatoires manquants" });
    }

    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      return res.status(400).json({ error: "Coordonnées invalides" });
    }

    // 🔍 Service choisi
    const [[srv]] = await req.db.query(
      "SELECT * FROM services WHERE id = ? OR name = ?",
      [service, service]
    );
    if (!srv) {
      return res.status(400).json({ error: "Service invalide ou non reconnu." });
    }

    const isRemorquage = srv.name.toLowerCase().includes("remorqu");

    // 🔹 Destination (uniquement remorquage)
    let destLatNum = null, destLngNum = null;

    if (isRemorquage) {
      if (!dest_lat || !dest_lng) {
        return res.status(400).json({
          error: "Destination obligatoire pour le remorquage.",
        });
      }

      destLatNum = Number(dest_lat);
      destLngNum = Number(dest_lng);

      if (!Number.isFinite(destLatNum) || !Number.isFinite(destLngNum)) {
        return res.status(400).json({ error: "Coordonnées destination invalides." });
      }
    }

    // 🔒 Vérifier mission en cours
    const [active] = await req.db.query(
      "SELECT id FROM requests WHERE user_id = ? AND status IN ('publiee','assignee','acceptee','en_route','sur_place')",
      [req.user.id]
    );
    if (active.length > 0) {
      return res.status(400).json({ error: "Vous avez déjà une mission en cours." });
    }

    // ==============================
    // 🎯 CALCUL AUTOMATIQUE DU PRIX
    // ==============================

    let finalPrice = Number(srv.price); // prix normal par défaut

    if (isRemorquage) {
      // 📌 Charger tarifs depuis settings
      const [settingsRows] = await req.db.query(
        `SELECT key_name, value FROM settings 
         WHERE key_name IN ('tow_base_price','tow_price_per_km')`
      );

      let basePrice = 10000; // fallback
      let pricePerKm = 500;

      settingsRows.forEach(row => {
        if (row.key_name === "tow_base_price") basePrice = Number(row.value);
        if (row.key_name === "tow_price_per_km") pricePerKm = Number(row.value);
      });

      // 📏 Distance (Haversine)
      function haversine(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(lat1 * Math.PI / 180) *
            Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }

      const distanceKm = haversine(latNum, lngNum, destLatNum, destLngNum);

      // 💰 Prix = base + distance * prix/km
      finalPrice = Math.round(basePrice + distanceKm * pricePerKm);
    }

    // ==============================
    // ➕ INSERTION BDD
    // ==============================
    const currency = "FCFA";

    const [result] = await req.db.query(
      `INSERT INTO requests 
       (user_id, service, description, lat, lng, address, zone,
        destination, dest_lat, dest_lng, estimated_price,
        currency, status, published_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'publiee', NOW(), NOW())`,
      [
        req.user.id,
        srv.name,
        description || "",
        latNum,
        lngNum,
        address || "",
        zone || "",
        destination || "",
        destLatNum,
        destLngNum,
        finalPrice,
        currency,
      ]
    );

    const requestId = result.insertId;

    // 📸 Photos
    if (req.files?.length > 0) {
      for (const file of req.files) {
        await req.db.query(
          "INSERT INTO request_photos (request_id, url) VALUES (?, ?)",
          [requestId, `/uploads/requests/${file.filename}`]
        );
      }
    }

    // 🧾 Historique
    await req.db.query(
      "INSERT INTO request_events (request_id, type, meta, created_at) VALUES (?, 'publiee', ?, NOW())",
      [requestId, JSON.stringify({ user_id: req.user.id })]
    );

    // 📤 Retour mission
    const [[reqRow]] = await req.db.query("SELECT * FROM requests WHERE id = ?", [
      requestId,
    ]);

    const newRequest = {
      ...reqRow,
      lat: Number(reqRow.lat),
      lng: Number(reqRow.lng),
      dest_lat: reqRow.dest_lat ? Number(reqRow.dest_lat) : null,
      dest_lng: reqRow.dest_lng ? Number(reqRow.dest_lng) : null,
      estimated_price: Number(reqRow.estimated_price),
    };

    res.status(201).json({
      message: "Demande créée avec succès ✅",
      data: newRequest,
    });

    // Notify opérateurs externes uniquement
    notifyOperators("nouvelle_demande", newRequest, { targetInternal: false });

    const missionEmitter = req.emitMissionEvent || emitMissionEvent;
    if (missionEmitter) {
      missionEmitter("mission:created", newRequest, { clientId: req.user.id });
      missionEmitter(
        "mission:status_changed",
        { id: newRequest.id, status: newRequest.status },
        { clientId: req.user.id }
      );
      missionEmitter("mission:updated", newRequest, { clientId: req.user.id });
    }
  } catch (err) {
    console.error("❌ Erreur POST /requests:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});


  router.post("/:id/confirm-payment", authMiddleware, async (req, res) => {
    try {
      // Ensure commission_percent column exists
      try {
        await req.db.query(
          "SELECT commission_percent FROM transactions LIMIT 1"
        );
      } catch (e) {
        if (e?.code === "ER_BAD_FIELD_ERROR") {
          await req.db.query(
            "ALTER TABLE transactions ADD COLUMN commission_percent DECIMAL(5,2) DEFAULT NULL"
          );
        }
      }
      const { id } = req.params;
      const [[mission]] = await req.db.query(
        "SELECT * FROM requests WHERE id = ? AND user_id = ? LIMIT 1",
        [id, req.user.id]
      );

      if (!mission) {
        return res.status(404).json({ error: "Mission introuvable" });
      }
      if (mission.status !== "terminee") {
        return res.status(400).json({ error: "Mission non terminée ou annulée." });
      }

      let [[tx]] = await req.db.query(
        "SELECT * FROM transactions WHERE request_id = ? LIMIT 1",
        [id]
      );
      if (!tx) {
        const gross = Number.isFinite(Number(mission.estimated_price))
          ? Number(mission.estimated_price)
          : 0;
        const currency = mission.currency || "FCFA";
        const commissionPercent = await getCommissionPercent(req.db);
        const [result] = await req.db.query(
          `INSERT INTO transactions (operator_id, request_id, amount, currency, status, commission_percent, created_at)
           VALUES (?, ?, ?, ?, 'en_attente', ?, NOW())`,
          [mission.operator_id, id, gross, currency, commissionPercent]
        );
        tx = {
          id: result.insertId,
          operator_id: mission.operator_id,
          request_id: Number(id),
          amount: gross,
          currency,
          status: "en_attente",
        };
        const ioTmp = getIo(req);
        if (ioTmp) {
          ioTmp.to("admins").emit("transaction_created", {
            id: tx.id,
            operator_id: tx.operator_id,
            request_id: Number(id),
            amount: gross,
            currency,
            status: "en_attente",
            created_at: new Date().toISOString(),
            message: `Mission #${id} confirmée par le client.`,
          });
        }
      }
      if (tx.status === "confirmée") {
        return res.status(400).json({ error: "Cette mission est déjà confirmée." });
      }

      if (tx.status !== "en_attente") {
        await req.db.query("UPDATE transactions SET status = 'en_attente' WHERE id = ?", [tx.id]);
      }

      const io = getIo(req);
      if (io) {
        io.to("admins").emit("transaction_updated", { id: tx.id, status: "en_attente" });
        io.to("admins").emit("dashboard_update", {
          type: "transaction",
          action: "updated",
          id: tx.id,
          status: "en_attente",
          message: `Paiement client mission #${id} prêt à être validé.`,
        });
      }

      // 🔔 Notifier l'opérateur que le client a validé le paiement
      if (mission.operator_id) {
        try {
          const [[opUser]] = await req.db.query(
            "SELECT notification_token, name FROM users WHERE id = ? LIMIT 1",
            [mission.operator_id]
          );
          if (opUser?.notification_token) {
            const title = "Paiement client validé";
            const body = `Le client a validé la mission #${id}.`;
            req.app?.get?.("io")?.to(`user_${mission.operator_id}`).emit("payment_confirmed", {
              request_id: Number(id),
              transaction_id: tx.id,
              status: "en_attente",
            });
            // push
            const { sendPushNotification } = await import("../../utils/sendPush.js");
            await sendPushNotification(opUser.notification_token, title, body);
          }
        } catch (notifyErr) {
          console.warn("⚠️ Notification opérateur paiement échouée:", notifyErr?.message || notifyErr);
        }
      }

      res.json({
        message: "Paiement transmis, en attente de validation ✅",
        data: { transaction_id: tx.id, status: "en_attente" },
      });
    } catch (err) {
      console.error("❌ Erreur POST /requests/:id/confirm-payment:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  return router;
};
