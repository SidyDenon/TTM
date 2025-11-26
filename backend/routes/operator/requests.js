// ✅ routes/operator/requests.js
import express from "express";
import authMiddleware from "../../middleware/auth.js";
import { io, emitMissionEvent } from "../../server.js";
import { sendPushNotification } from "../../utils/sendPush.js";
import { buildPublicUrl } from "../../config/links.js";

const router = express.Router();

const OPERATOR_ROLES = ["operator", "operateur", "opérateur"];
const isOperatorRole = (role = "") =>
  OPERATOR_ROLES.includes(String(role || "").toLowerCase());

/** 💰 Tarif remorquage */
const TOWING_PRICE_PER_KM = 500; // FCFA / km - à ajuster si besoin

/* =============================================================
   🔧 Charger la configuration tarifaire (depuis table settings)
   ============================================================= */
async function loadTowingConfig(db) {
  try {
    const [[rowBase]] = await db.query(
      "SELECT value FROM settings WHERE key_name = 'remorquage_base_price' LIMIT 1"
    );
    const [[rowKm]] = await db.query(
      "SELECT value FROM settings WHERE key_name = 'remorquage_price_per_km' LIMIT 1"
    );

    return {
      base_price: rowBase ? Number(rowBase.value) : null,
      price_per_km: rowKm ? Number(rowKm.value) : null,
    };
  } catch (e) {
    return { base_price: null, price_per_km: null };
  }
}


/** 🔹 Normalisation des photos JSON → tableau propre + URL complètes */
function buildPhotoURL(url) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return buildPublicUrl(url.startsWith("/") ? url : `/${url}`);
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

const missionToSocketPayload = (mission = {}, photos = []) => {
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

/** 🌍 Haversine pour calculer les distances en km */
const toRad = (v) => (v * Math.PI) / 180;
const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * 🧮 Calcul remorquage :
 * basePrice = prix du service (prise en charge)
 * + TOWING_PRICE_PER_KM * distanceTotale
 */
const computeTowingPricing = (basePrice, operator, client, destination) => {
  if (
    operator.lat == null ||
    operator.lng == null ||
    client.lat == null ||
    client.lng == null ||
    destination.lat == null ||
    destination.lng == null
  ) {
    return null;
  }

  const opToClientKm = haversineKm(
    operator.lat,
    operator.lng,
    client.lat,
    client.lng
  );
  const clientToDestKm = haversineKm(
    client.lat,
    client.lng,
    destination.lat,
    destination.lng
  );
  const totalKm = opToClientKm + clientToDestKm;

  const base = Number.isFinite(Number(basePrice))
    ? Number(basePrice)
    : 0;

  const variable = Math.max(0, totalKm) * TOWING_PRICE_PER_KM;
  const finalPrice = Math.round(base + variable);

  return {
    opToClientKm,
    clientToDestKm,
    totalKm,
    finalPrice,
  };
};

const computeDynamicPrice = (config, operator, client, destination) => {
  if (
    config.base_price == null ||
    config.price_per_km == null ||
    operator.lat == null ||
    operator.lng == null ||
    client.lat == null ||
    client.lng == null ||
    destination.lat == null ||
    destination.lng == null
  ) {
    return null;
  }

  const opToClientKm = haversineKm(
    operator.lat,
    operator.lng,
    client.lat,
    client.lng
  );

  const clientToDestKm = haversineKm(
    client.lat,
    client.lng,
    destination.lat,
    destination.lng
  );

  const totalKm = opToClientKm + clientToDestKm;

  return {
    finalPrice: Math.round(config.base_price + totalKm * config.price_per_km),
  };
};

const OLD_PRICE_PER_KM = 500;
const computeFallbackPrice = (basePrice, operator, client, destination) => {
  if (
    operator.lat == null ||
    operator.lng == null ||
    client.lat == null ||
    client.lng == null ||
    destination.lat == null ||
    destination.lng == null
  ) {
    return null;
  }

  const opToClientKm = haversineKm(
    operator.lat,
    operator.lng,
    client.lat,
    client.lng
  );

  const clientToDestKm = haversineKm(
    client.lat,
    client.lng,
    destination.lat,
    destination.lng
  );

  const totalKm = opToClientKm + clientToDestKm;

  return {
    finalPrice: Math.round(Number(basePrice || 0) + totalKm * OLD_PRICE_PER_KM),
  };
};


export default (db) => {
  router.use((req, _res, next) => {
    req.db = db;
    next();
  });

  // ✅ Lecture profil opérateur
  router.get("/profile", authMiddleware, async (req, res) => {
    if (!isOperatorRole(req.user.role)) {
      return res.status(403).json({ error: "Accès refusé" });
    }
    try {
      const [[profile]] = await req.db.query(
        "SELECT user_id, ville, quartier, lat, lng FROM operators WHERE user_id = ?",
        [req.user.id]
      );
      if (!profile) {
        return res.status(404).json({ error: "Profil opérateur introuvable" });
      }
      res.json({
        message: "Profil opérateur récupéré ✅",
        data: {
          name: req.user.name || null,
          phone: req.user.phone || null,
          ...profile,
        },
      });
    } catch (err) {
      console.error("❌ Erreur GET /operator/profile:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ✅ Mise à jour des coordonnées opérateur
  router.put("/profile/location", authMiddleware, async (req, res) => {
    if (!isOperatorRole(req.user.role)) {
      return res.status(403).json({ error: "Accès refusé" });
    }
    try {
      const { lat, lng, ville, quartier } = req.body || {};
      const latNum = Number(lat);
      const lngNum = Number(lng);
      if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
        return res.status(400).json({ error: "Coordonnées invalides" });
      }
      if (Math.abs(latNum) > 90 || Math.abs(lngNum) > 180) {
        return res.status(400).json({ error: "Coordonnées hors limites" });
      }

      const [existing] = await req.db.query("SELECT id FROM operators WHERE user_id = ?", [
        req.user.id,
      ]);

      const values = [latNum, lngNum];
      const updates = ["lat = ?", "lng = ?"];

      if (ville !== undefined) {
        values.push(ville || "");
        updates.push("ville = ?");
      }
      if (quartier !== undefined) {
        values.push(quartier || "");
        updates.push("quartier = ?");
      }

      if (existing.length === 0) {
        await req.db.query(
          "INSERT INTO operators (user_id, lat, lng, ville, quartier) VALUES (?, ?, ?, ?, ?)",
          [req.user.id, latNum, lngNum, ville || "", quartier || ""]
        );
      } else {
        values.push(req.user.id);
        await req.db.query(`UPDATE operators SET ${updates.join(", ")} WHERE user_id = ?`, values);
      }

      res.json({
        message: "Coordonnées opérateur mises à jour ✅",
        data: { lat: latNum, lng: lngNum, ville: ville || null, quartier: quartier || null },
      });
    } catch (err) {
      console.error("❌ Erreur PUT /operator/profile/location:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ✅ Liste des missions disponibles (compat sans JSON_ARRAYAGG)
  router.get("/requests", authMiddleware, async (req, res) => {
    if (!isOperatorRole(req.user.role)) {
      return res.status(403).json({ error: "Accès refusé" });
    }

    try {
      const [[profile]] = await req.db.query(
        "SELECT lat, lng FROM operators WHERE user_id = ?",
        [req.user.id]
      );

      if (!profile || profile.lat == null || profile.lng == null) {
        return res
          .status(400)
          .json({ error: "Profil opérateur introuvable ou sans coordonnées" });
      }

      const radiusKm = Math.max(1, Math.min(30, Number(req.query.radius) || 5));

      const [rows] = await req.db.query(
        `SELECT * FROM (
            SELECT r.*, 
                   u.name as client_name,
                   u.phone as client_phone,
                   (6371 * ACOS(
                     COS(RADIANS(?)) * COS(RADIANS(r.lat)) *
                     COS(RADIANS(r.lng) - RADIANS(?)) +
                     SIN(RADIANS(?)) * SIN(RADIANS(r.lat))
                   )) AS distance
            FROM requests r
            JOIN users u ON u.id = r.user_id
            WHERE r.lat IS NOT NULL
              AND r.lng IS NOT NULL
              AND (r.status = 'publiee' 
                   OR (r.operator_id = ? AND r.status IN ('assignee','acceptee','en_route','sur_place','remorquage')))
        ) AS q
        WHERE q.distance <= ?
           OR (q.operator_id = ? AND q.status IN ('assignee','acceptee','en_route','sur_place','remorquage'))
        ORDER BY q.created_at ASC`,
        [profile.lat, profile.lng, profile.lat, req.user.id, radiusKm, req.user.id]
      );

      // Photos en 2e requête
      const ids = rows.map((r) => r.id);
      let photosByReq = new Map();
      if (ids.length) {
        const placeholders = ids.map(() => "?").join(",");
        const [photoRows] = await req.db.query(
          `SELECT request_id, url FROM request_photos WHERE request_id IN (${placeholders}) ORDER BY id ASC`,
          ids
        );
        photosByReq = new Map();
        for (const pr of photoRows) {
          if (!photosByReq.has(pr.request_id)) photosByReq.set(pr.request_id, []);
          photosByReq.get(pr.request_id).push(pr.url);
        }
      }

      res.json({
        message: "Missions disponibles ✅",
        data: rows.map((r) => ({
          ...r,
          photos: (photosByReq.get(r.id) || []).map((u) => buildPhotoURL(u)),
        })),
      });
    } catch (err) {
      console.error("❌ Erreur GET /operator/requests:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ✅ Détail mission (compat sans JSON_ARRAYAGG)
  router.get("/requests/:id", authMiddleware, async (req, res) => {
    if (!isOperatorRole(req.user.role)) {
      return res.status(403).json({ error: "Accès refusé" });
    }

    try {
      const { id } = req.params;

      // Position opérateur pour la contrainte "proche de 5 km si mission publiée"
      const [[profile]] = await req.db.query(
        "SELECT lat, lng FROM operators WHERE user_id = ?",
        [req.user.id]
      );
      if (!profile || profile.lat == null || profile.lng == null) {
        return res
          .status(400)
          .json({ error: "Profil opérateur introuvable ou sans coordonnées" });
      }

      const radiusKm = Math.max(1, Math.min(30, Number(req.query.radius) || 5));

      const [rows] = await req.db.query(
        `SELECT r.*, 
                u.name  AS client_name, 
                u.phone AS client_phone,
                op.id   AS operator_profile_id,
                ou.name AS operator_name,
                ou.phone AS operator_phone
         FROM requests r
         JOIN users u ON u.id = r.user_id
         LEFT JOIN users ou ON ou.id = r.operator_id
         LEFT JOIN operators op ON op.user_id = ou.id
         WHERE r.id = ?
           AND (
             r.operator_id = ? OR
             (
               r.status = 'publiee' AND
               r.lat IS NOT NULL AND
               r.lng IS NOT NULL AND
               (6371 * ACOS(
                 COS(RADIANS(?)) * COS(RADIANS(r.lat)) *
                 COS(RADIANS(r.lng) - RADIANS(?)) +
                 SIN(RADIANS(?)) * SIN(RADIANS(r.lat))
               )) <= ?
             )
           )
         LIMIT 1`,
        [id, req.user.id, profile.lat, profile.lng, profile.lat, radiusKm]
      );

      if (rows.length === 0) {
        return res
          .status(404)
          .json({ error: "Mission introuvable ou non accessible" });
      }

      const [photosRows] = await req.db.query(
        `SELECT url FROM request_photos WHERE request_id = ? ORDER BY id ASC`,
        [id]
      );

      res.json({
        message: "Détail mission récupéré ✅",
        data: {
          ...rows[0],
          photos: photosRows.map((p) => buildPhotoURL(p.url)),
        },
      });
    } catch (err) {
      console.error("❌ Erreur GET /operator/requests/:id:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ✅ Accepter mission + calcul remorquage dynamique
router.post("/requests/:id/accepter", authMiddleware, async (req, res) => {
  if (!isOperatorRole(req.user.role)) {
    return res.status(403).json({ error: "Accès refusé" });
  }

  try {
    const { id } = req.params;

    // 🔒 Vérifie si opérateur a déjà une mission en cours
    const [active] = await req.db.query(
      "SELECT id FROM requests WHERE operator_id = ? AND status IN ('assignee','acceptee','en_route','sur_place','remorquage')",
      [req.user.id]
    );
    if (active.length > 0) {
      return res.status(400).json({
        error: "Vous avez déjà une mission en cours",
        code: "ACTIVE_MISSION",
      });
    }

    // 1️⃣ Charger la mission avant acceptation
    const [[missionBefore]] = await req.db.query(
      `SELECT r.*, u.name AS client_name, u.phone AS client_phone
       FROM requests r
       JOIN users u ON u.id = r.user_id
       WHERE r.id = ? AND r.status = 'publiee'
       LIMIT 1`,
      [id]
    );

    if (!missionBefore) {
      return res
        .status(409)
        .json({ error: "Mission introuvable ou déjà prise" });
    }

    const isTow =
      String(missionBefore.service || "").toLowerCase().includes("remor") ||
      String(missionBefore.service || "").toLowerCase().includes("remorqu");

    let finalPrice = Number(missionBefore.estimated_price || 0);

    // 2️⃣ Si remorquage → calcul dynamique avec fallback
    if (isTow) {
      const [[operatorProfile]] = await req.db.query(
        "SELECT lat, lng FROM operators WHERE user_id = ? LIMIT 1",
        [req.user.id]
      );

      if (operatorProfile && operatorProfile.lat != null && operatorProfile.lng != null) {
        const client = {
          lat: Number(missionBefore.lat),
          lng: Number(missionBefore.lng),
        };
        const destination = {
          lat: missionBefore.dest_lat != null ? Number(missionBefore.dest_lat) : null,
          lng: missionBefore.dest_lng != null ? Number(missionBefore.dest_lng) : null,
        };

        // a) Config dynamique depuis settings
        const config = await loadTowingConfig(req.db);
        let pricing = computeDynamicPrice(config, {
          lat: Number(operatorProfile.lat),
          lng: Number(operatorProfile.lng),
        }, client, destination);

        // b) Fallback ancien système si config incomplète
        if (!pricing) {
          pricing = computeFallbackPrice(
            missionBefore.estimated_price,
            { lat: Number(operatorProfile.lat), lng: Number(operatorProfile.lng) },
            client,
            destination
          );
        }

        if (pricing) {
          finalPrice = pricing.finalPrice;
          await req.db.query(
            "UPDATE requests SET estimated_price = ? WHERE id = ?",
            [finalPrice, id]
          );
        }
      }
    }

    // 3️⃣ Assigner la mission à l’opérateur
    const [result] = await req.db.query(
      "UPDATE requests SET operator_id = ?, status = 'acceptee', accepted_at = NOW() WHERE id = ? AND status = 'publiee'",
      [req.user.id, id]
    );

    if (result.affectedRows === 0) {
      return res
        .status(409)
        .json({ error: "Mission déjà prise par un autre opérateur" });
    }

    // 4️⃣ Log event
    await req.db.query(
      "INSERT INTO request_events (request_id, type, meta, created_at) VALUES (?, 'acceptee', ?, NOW())",
      [id, JSON.stringify({ operator_id: req.user.id })]
    );

    // 5️⃣ Recharger mission complète (pour réponse + socket)
    const [[mission]] = await req.db.query(
      `SELECT r.*, 
              u.name AS client_name,
              u.phone AS client_phone,
              ou.name AS operator_name,
              ou.phone AS operator_phone
       FROM requests r
       LEFT JOIN users u ON u.id = r.user_id
       LEFT JOIN users ou ON ou.id = r.operator_id
       WHERE r.id = ?
       LIMIT 1`,
      [id]
    );

    const [photosRows] = await req.db.query(
      `SELECT url FROM request_photos WHERE request_id = ? ORDER BY id ASC`,
      [id]
    );
    const photos = photosRows.map((p) => buildPhotoURL(p.url));

    // 6️⃣ Diffusion temps réel unifiée
    const missionPayload = missionToSocketPayload(
      { ...mission, estimated_price: finalPrice },
      photos
    );
    emitMissionEvent(
      "mission:status_changed",
      { id: missionPayload.id, status: missionPayload.status },
      { operatorId: missionPayload.operator_id, clientId: missionPayload.user_id }
    );
    emitMissionEvent("mission:updated", missionPayload, {
      operatorId: missionPayload.operator_id,
      clientId: missionPayload.user_id,
    });

    // 9️⃣ Notification push Expo au client
    const [[userNotif]] = await req.db.query(
      "SELECT notification_token FROM users WHERE id = ? AND notification_token IS NOT NULL",
      [mission.user_id]
    );
    if (userNotif) {
      await sendPushNotification(
        userNotif.notification_token,
        "🚗 Mission acceptée",
        `Votre mission #${id} a été acceptée par ${req.user.name}`
      );
    }

    // 🔟 Réponse HTTP
    res.json({
      message: "Mission acceptée ✅",
      mission: {
        ...mission,
        estimated_price: finalPrice,
        photos,
      },
    });
  } catch (err) {
    console.error("❌ Erreur POST /operator/requests/:id/accepter:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});
router.post("/requests/:id/:action", authMiddleware, async (req, res) => {
  if (!isOperatorRole(req.user.role))
    return res.status(403).json({ error: "Accès refusé" });

    try {
      const { id, action } = req.params;

      const [[mission]] = await req.db.query(
        "SELECT * FROM requests WHERE id = ? AND operator_id = ?",
        [id, req.user.id]
      );

      if (!mission)
        return res
          .status(403)
          .json({ error: "Non autorisé à modifier cette mission" });

      const serviceLabel = String(mission.service || mission.type || "")
        .toLowerCase()
        .trim();
      const isRemorquage = serviceLabel.includes("remorqu");

      const FLOW = isRemorquage
        ? {
            en_route: new Set(["assignee", "acceptee"]),
            sur_place: new Set(["en_route"]),
            remorquage: new Set(["sur_place"]),
            terminee: new Set(["remorquage"]),
          }
        : {
            en_route: new Set(["assignee", "acceptee"]),
            sur_place: new Set(["en_route"]),
            terminee: new Set(["sur_place"]),
          };
      const validActions = Object.keys(FLOW);
      if (!validActions.includes(action))
        return res.status(400).json({ error: "Action invalide" });

      const previousStatus = String(mission.status || "");
      const allowedTransitions = FLOW[action];
      if (!allowedTransitions || !allowedTransitions.has(previousStatus)) {
        return res.status(400).json({
          error: `Transition ${previousStatus} → ${action} interdite pour cette mission`,
        });
      }

      // 🔹 Cas spécial : mission terminee
      if (action === "terminee") {
        await req.db.query(
          "UPDATE requests SET status = ?, finished_at = NOW() WHERE id = ?",
          [action, id]
        );
        const gross = Number.isFinite(Number(mission.estimated_price))
          ? Number(mission.estimated_price)
          : 0;
        const currency = mission.currency || "FCFA";
        const [existingTx] = await req.db.query(
          "SELECT id FROM transactions WHERE request_id = ? LIMIT 1",
          [id]
        );
        if (!existingTx.length) {
          await req.db.query(
            `INSERT INTO transactions (operator_id, request_id, amount, currency, status, created_at)
             VALUES (?, ?, ?, ?, 'en_attente', NOW())`,
            [req.user.id, id, gross, currency]
          );
          io.to("admins").emit("transaction_created", {
            operator_id: req.user.id,
            request_id: Number(id),
            amount: gross,
            currency,
            status: "en_attente",
            created_at: new Date().toISOString(),
            message: `Mission #${id} terminée, en attente de validation client.`,
          });
        }
        io.to("admins").emit("dashboard_update", {
          type: "request",
          action: "finished",
          id: Number(id),
        });
      } else {
        // 🔸 Statuts classiques
        await req.db.query("UPDATE requests SET status = ? WHERE id = ?", [
          action,
          id,
        ]);
      }

      // 🔍 Mission mise à jour
      const [[updated]] = await req.db.query(
        `SELECT r.*,
                u.name  AS user_name,
                u.phone AS user_phone,
                ou.name AS operator_name,
                ou.phone AS operator_phone
         FROM requests r
         LEFT JOIN users u  ON u.id  = r.user_id
         LEFT JOIN users ou ON ou.id = r.operator_id
         WHERE r.id = ?`,
        [id]
      );

      const [photoRows] = await req.db.query(
        `SELECT url FROM request_photos WHERE request_id = ? ORDER BY id ASC`,
        [id]
      );
      const photos = photoRows.map((p) => buildPhotoURL(p.url));

      const missionPayload = missionToSocketPayload(updated, photos);
      emitMissionEvent(
        "mission:status_changed",
        { id: missionPayload.id, status: missionPayload.status },
        { operatorId: missionPayload.operator_id, clientId: missionPayload.user_id }
      );
      emitMissionEvent("mission:updated", missionPayload, {
        operatorId: missionPayload.operator_id,
        clientId: missionPayload.user_id,
      });

      // 🔔 Notifie aussi l’opérateur (push Expo)
      const [[operatorNotif]] = await req.db.query(
        "SELECT notification_token FROM users WHERE id = ? AND notification_token IS NOT NULL",
        [req.user.id]
      );
      if (operatorNotif) {
        let title = "🔄 Mise à jour de mission";
        let body = `Votre mission #${id} est maintenant ${action}`;
        if (action === "terminee") body = `Votre mission #${id} est terminée ✅`;
        await sendPushNotification(operatorNotif.notification_token, title, body);
      }

      const [[clientNotif]] = await req.db.query(
        "SELECT notification_token FROM users WHERE id = ? AND notification_token IS NOT NULL",
        [updated.user_id]
      );
      if (clientNotif) {
        let body = `Votre mission #${id} mise à jour: ${action}`;
        if (action === "terminee") body = `Votre mission #${id} est terminée ✅`;
        await sendPushNotification(
          clientNotif.notification_token,
          "Mise à jour TowTruck",
          body
        );
      }

      res.json({
        message: `Mission ${
          action === "terminee" ? "terminée" : action.replace("_", " ")
        } ✅`,
        mission: updated,
      });
    } catch (err) {
      console.error("❌ Erreur POST /operator/requests/:id/:action:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ✅ Historique des événements d’une mission
  router.get("/requests/:id/events", authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await req.db.query(
        "SELECT * FROM request_events WHERE request_id = ? ORDER BY created_at ASC",
        [id]
      );
      res.json({ message: "Historique récupéré ✅", data: rows });
    } catch (err) {
      console.error("❌ Erreur GET /operator/requests/:id/events:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ✅ Mission active (compat sans JSON_ARRAYAGG)
  router.get("/active", authMiddleware, async (req, res) => {
    try {
      const [rows] = await req.db.query(
        `SELECT r.*, 
                u.name as client_name, 
                u.phone as client_phone
         FROM requests r
         JOIN users u ON u.id = r.user_id
        WHERE r.operator_id = ? AND r.status IN ('assignee','acceptee','en_route','sur_place','remorquage')
         ORDER BY r.created_at DESC
         LIMIT 1`,
        [req.user.id]
      );

      if (rows.length === 0) return res.json({ activeMission: null });

      const [photosRows] = await req.db.query(
        `SELECT url FROM request_photos WHERE request_id = ? ORDER BY id ASC`,
        [rows[0].id]
      );

      res.json({
        activeMission: {
          ...rows[0],
          photos: photosRows.map((p) => buildPhotoURL(p.url)),
        },
      });
    } catch (err) {
      console.error("❌ Erreur GET /operator/active:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ✅ Historique des missions terminees (compat sans JSON_ARRAYAGG)
  router.get("/history", authMiddleware, async (req, res) => {
    try {
      const [rows] = await req.db.query(
        `SELECT r.id,
                r.service,
                r.zone,
                r.address,
                r.estimated_price,
                r.status,
                r.finished_at,
                r.destination,
                r.dest_lat,
                r.dest_lng
         FROM requests r
         WHERE r.operator_id = ? AND r.status = 'terminee'
         ORDER BY r.finished_at DESC`,
        [req.user.id]
      );

      const ids = rows.map((r) => r.id);
      let photosByReq = new Map();
      if (ids.length) {
        const placeholders = ids.map(() => "?").join(",");
        const [photoRows] = await req.db.query(
          `SELECT request_id, url FROM request_photos WHERE request_id IN (${placeholders}) ORDER BY id ASC`,
          ids
        );
        photosByReq = new Map();
        for (const pr of photoRows) {
          if (!photosByReq.has(pr.request_id)) photosByReq.set(pr.request_id, []);
          photosByReq.get(pr.request_id).push(pr.url);
        }
      }

      res.json({
        message: "Historique récupéré ✅",
        data: rows.map((r) => ({
          ...r,
          photos: (photosByReq.get(r.id) || []).map((u) => buildPhotoURL(u)),
        })),
      });
    } catch (err) {
      console.error("❌ Erreur GET /operator/history:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  return router;
};
