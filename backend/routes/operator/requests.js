//routes/operator/requests.js
import express from "express";
import authMiddleware from "../../middleware/auth.js";
import { io, emitMissionEvent } from "../../socket/index.js";
import { sendPushNotification } from "../../utils/sendPush.js";
import { buildPublicUrl } from "../../config/links.js";
import { getSchemaColumns } from "../../utils/schema.js";
import { getCommissionPercent } from "../../utils/commission.js";

const router = express.Router();

const OPERATOR_ROLES = ["operator", "operateur", "opérateur"];
const isOperatorRole = (role = "") =>
  OPERATOR_ROLES.includes(String(role || "").toLowerCase());

const TOWING_PRICE_PER_KM = 500;
const TOWING_RADIUS_KM = Number(process.env.TOWING_RADIUS_KM || 100);

let alertsColumnCache = null;
async function ensureOperatorAlertsColumn(db) {
  if (alertsColumnCache !== null) return alertsColumnCache;
  const { operatorAlerts } = await getSchemaColumns(db);
  if (operatorAlerts) {
    alertsColumnCache = operatorAlerts;
    return alertsColumnCache;
  }
  try {
    const [[row]] = await db.query(
      "SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'operators' AND COLUMN_NAME = 'pending_alerts_enabled'"
    );
    if (Number(row?.cnt || 0) > 0) {
      alertsColumnCache = "pending_alerts_enabled";
      return alertsColumnCache;
    }
    await db.query(
      "ALTER TABLE operators ADD COLUMN pending_alerts_enabled TINYINT(1) NOT NULL DEFAULT 1"
    );
    alertsColumnCache = "pending_alerts_enabled";
    return alertsColumnCache;
  } catch (err) {
    console.warn(" pending_alerts_enabled column missing and cannot be created:", err?.message || err);
    alertsColumnCache = null;
    return null;
  }
}

let serviceInternalColumnCache;
async function getServiceInternalColumn(db) {
  if (serviceInternalColumnCache !== undefined) return serviceInternalColumnCache;
  try {
    const [[row]] = await db.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'services'
         AND COLUMN_NAME = 'is_internal'
       LIMIT 1`
    );
    serviceInternalColumnCache = row?.COLUMN_NAME || null;
  } catch {
    serviceInternalColumnCache = null;
  }
  return serviceInternalColumnCache;
}

async function isInternalServiceByName(db, serviceName) {
  const serviceInternalCol = await getServiceInternalColumn(db);
  const label = String(serviceName || "").trim();
  if (!serviceInternalCol || !label) return false;
  try {
    const [[row]] = await db.query(
      `SELECT ${serviceInternalCol} AS is_internal
       FROM services
       WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
       LIMIT 1`,
      [label]
    );
    return Number(row?.is_internal) === 1;
  } catch {
    return false;
  }
}

async function getOperatorMissionRadiusKm(db) {
  try {
    const [[row]] = await db.query(
      "SELECT operator_mission_radius_km FROM configurations LIMIT 1"
    );
    const fromDb = Number(row?.operator_mission_radius_km);
    if (Number.isFinite(fromDb) && fromDb > 0) return fromDb;
  } catch {
    // ignore
  }
  const fromEnv = Number(process.env.OPERATOR_MISSION_RADIUS_KM || 5);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 5;
}

async function getOperatorTowingRadiusKm(db) {
  try {
    const [[row]] = await db.query(
      "SELECT operator_towing_radius_km FROM configurations LIMIT 1"
    );
    const fromDb = Number(row?.operator_towing_radius_km);
    if (Number.isFinite(fromDb) && fromDb > 0) return fromDb;
  } catch {
    // ignore
  }
  const fromEnv = Number(process.env.TOWING_RADIUS_KM || 100);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 100;
}

async function loadTowingConfig(db) {
  try {
    let basePrice = null;
    let pricePerKm = null;

    // 1) Source principale: configurations
    try {
      const [[cfg]] = await db.query(
        "SELECT towing_base_price, towing_price_per_km FROM configurations LIMIT 1"
      );
      const baseCfg = Number(cfg?.towing_base_price);
      const kmCfg = Number(cfg?.towing_price_per_km);
      if (Number.isFinite(baseCfg) && baseCfg >= 0) basePrice = baseCfg;
      if (Number.isFinite(kmCfg) && kmCfg >= 0) pricePerKm = kmCfg;
    } catch {
      // ignore and fallback
    }

    // 2) Fallback legacy: settings (anciens noms de clés)
    if (basePrice == null || pricePerKm == null) {
      const [rows] = await db.query(
        `SELECT key_name, value FROM settings
         WHERE key_name IN ('tow_base_price','tow_price_per_km','remorquage_base_price','remorquage_price_per_km')`
      );
      const byKey = new Map((rows || []).map((r) => [String(r.key_name), Number(r.value)]));

      const legacyBase = byKey.get("tow_base_price");
      const legacyBaseFr = byKey.get("remorquage_base_price");
      const legacyKm = byKey.get("tow_price_per_km");
      const legacyKmFr = byKey.get("remorquage_price_per_km");

      if (basePrice == null) {
        const b = Number.isFinite(legacyBase) ? legacyBase : legacyBaseFr;
        if (Number.isFinite(b) && b >= 0) basePrice = b;
      }
      if (pricePerKm == null) {
        const k = Number.isFinite(legacyKm) ? legacyKm : legacyKmFr;
        if (Number.isFinite(k) && k >= 0) pricePerKm = k;
      }
    }

    return {
      base_price: basePrice,
      price_per_km: pricePerKm,
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
    final_price:
      mission.final_price !== undefined && mission.final_price !== null
        ? Number(mission.final_price)
        : mission.estimated_price !== undefined && mission.estimated_price !== null
        ? Number(mission.estimated_price)
        : null,
    total_km:
      mission.total_km !== undefined && mission.total_km !== null
        ? Number(mission.total_km)
        : mission.totalKm !== undefined && mission.totalKm !== null
        ? Number(mission.totalKm)
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

/**  Haversine pour calculer les distances en km */
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

  const distancePrice = totalKm * config.price_per_km;
  const base = config.base_price != null ? Number(config.base_price) : null;
  const finalPrice = Math.round(
    base != null && Number.isFinite(base) ? Math.max(base, distancePrice) : distancePrice
  );
  return { finalPrice, totalKm };
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
  const distancePrice = totalKm * OLD_PRICE_PER_KM;
  const base = Number.isFinite(Number(basePrice)) ? Number(basePrice) : null;

  return {
    finalPrice: Math.round(
      base != null ? Math.max(base, distancePrice) : distancePrice
    ),
    totalKm,
  };
};

const computeOilModelPriceByLiters = (model = {}, liters = 0) => {
  const qty = Number(liters);
  if (!Number.isFinite(qty) || qty <= 0) return null;

  const byLiters =
    qty === 1
      ? model.price_1l
      : qty === 4
      ? model.price_4l
      : qty === 5
      ? model.price_5l
      : qty === 20
      ? model.price_20l
      : null;

  const parsedByLiters = byLiters == null || byLiters === "" ? NaN : Number(byLiters);
  if (Number.isFinite(parsedByLiters)) return parsedByLiters;

  const unitPrice =
    model.unit_price == null || model.unit_price === "" ? NaN : Number(model.unit_price);
  if (Number.isFinite(unitPrice)) return unitPrice * qty;

  return null;
};

const normalizeServiceNameKey = (name = "") =>
  String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();

const isOilServiceName = (name = "") => {
  const key = normalizeServiceNameKey(name);
  return (
    key.includes("domicile") ||
    key.includes("huile") ||
    key.includes("oil") ||
    key.includes("vidange")
  );
};

const getOilServiceBasePrice = async (db) => {
  try {
    const [rows] = await db.query("SELECT name, price FROM services ORDER BY id ASC");
    const oilService = (rows || []).find((row) => isOilServiceName(row?.name));
    const parsed = Number(oilService?.price);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const computeOilPreviewPrice = async (db, mission) => {
  if (!mission) return null;
  const isOilMission =
    String(mission.service_type || "").toLowerCase() === "oil_service" &&
    String(mission.service || "").toLowerCase() === "oil_service";

  if (!isOilMission) return null;

  const estimated = Number(mission.estimated_price);
  if (Number.isFinite(estimated) && estimated > 0) {
    return { finalPrice: estimated, totalKm: null };
  }

  const oilModelId = Number(mission.oil_model_id);
  const liters = Number(mission.oil_liters);
  if (!Number.isFinite(oilModelId) || oilModelId <= 0) return null;
  if (!Number.isFinite(liters) || liters <= 0) return null;

  const [[oilModel]] = await db.query(
    "SELECT unit_price, price_1l, price_4l, price_5l, price_20l FROM oil_models WHERE id = ? LIMIT 1",
    [oilModelId]
  );
  const oilPart = oilModel ? computeOilModelPriceByLiters(oilModel, liters) : null;
  const basePart = await getOilServiceBasePrice(db);

  const hasOilPart = Number.isFinite(Number(oilPart));
  const hasBasePart = Number.isFinite(Number(basePart));
  if (!hasOilPart && !hasBasePart) return null;

  const price = Number(hasOilPart ? oilPart : 0) + Number(hasBasePart ? basePart : 0);

  return { finalPrice: Number(price), totalKm: null };
};

// Calcule un tarif prévisionnel pour affichage (avant acceptation)
const computePreviewPricing = async (db, mission, operatorCoords, preloadedConfig = null) => {
  const oilPreview = await computeOilPreviewPrice(db, mission);
  if (oilPreview) return oilPreview;

  if (!operatorCoords || operatorCoords.lat == null || operatorCoords.lng == null) return null;
  const isTow =
    typeof mission?.service === "string" &&
    mission.service.toLowerCase().includes("remorqu");
  if (!isTow) return null;

  const client = { lat: Number(mission.lat), lng: Number(mission.lng) };
  const destination =
    mission.dest_lat != null && mission.dest_lng != null
      ? { lat: Number(mission.dest_lat), lng: Number(mission.dest_lng) }
      : null;

  if (
    client.lat == null ||
    client.lng == null ||
    destination == null ||
    destination.lat == null ||
    destination.lng == null
  ) {
    return null;
  }

  const cfg = preloadedConfig || (await loadTowingConfig(db));
  let pricing = computeDynamicPrice(
    cfg,
    { lat: Number(operatorCoords.lat), lng: Number(operatorCoords.lng) },
    client,
    destination
  );
  if (!pricing) {
    pricing = computeFallbackPrice(
      mission.estimated_price,
      { lat: Number(operatorCoords.lat), lng: Number(operatorCoords.lng) },
      client,
      destination
    );
  }
  return pricing;
};


export default (db) => {
  // 🔎 Cache local pour savoir si la colonne final_price existe
  let hasFinalPriceColumn = null;
  const ensureFinalPriceColumn = async (conn) => {
    if (hasFinalPriceColumn !== null) return hasFinalPriceColumn;
    try {
      const [[{ cnt }]] = await conn.query(
        "SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'requests' AND COLUMN_NAME = 'final_price'"
      );
      hasFinalPriceColumn = Number(cnt) > 0;
    } catch {
      hasFinalPriceColumn = false;
    }
    return hasFinalPriceColumn;
  };

  router.use((req, _res, next) => {
    req.db = db;
    next();
  });

  router.use(authMiddleware);
  router.use(async (req, res, next) => {
    if (!isOperatorRole(req.user?.role)) return res.status(403).json({ error: "Accès refusé" });
    try {
      const { operatorDispo } = await getSchemaColumns(req.db);
      if (operatorDispo) {
        const [[row]] = await req.db.query(
          `SELECT ${operatorDispo} AS dispo FROM operators WHERE user_id = ? LIMIT 1`,
          [req.user.id]
        );
        if (row && Number(row.dispo) === 0) {
          return res.status(403).json({ error: "Compte opérateur bloqué" });
        }
      }
    } catch (err) {
      console.warn(" Vérification disponibilité opérateur échouée:", err?.message || err);
    }
    next();
  });

  router.get("/profile", async (req, res) => {
    if (!isOperatorRole(req.user.role)) {
      return res.status(403).json({ error: "Accès refusé" });
    }
    try {
      const { operatorAlerts } = await getSchemaColumns(req.db);
      const alertSelect = operatorAlerts
        ? `, ${operatorAlerts} AS pending_alerts_enabled`
        : "";
      const [[profile]] = await req.db.query(
        `SELECT user_id, ville, quartier, lat, lng${alertSelect} FROM operators WHERE user_id = ?`,
        [req.user.id]
      );
      if (!profile) {
        return res.status(404).json({ error: "Profil opérateur introuvable" });
      }
      res.json({
        message: "Profil opérateur récupéré ",
        data: {
          name: req.user.name || null,
          phone: req.user.phone || null,
          pending_alerts_enabled:
            profile.pending_alerts_enabled == null
              ? 1
              : Number(profile.pending_alerts_enabled),
          ...profile,
        },
      });
    } catch (err) {
      console.error(" Erreur GET /operator/profile:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  router.put("/profile/alerts", authMiddleware, async (req, res) => {
    if (!isOperatorRole(req.user.role)) {
      return res.status(403).json({ error: "Accès refusé" });
    }
    try {
      const { pending_alerts_enabled } = req.body || {};
      const enabled =
        pending_alerts_enabled === undefined
          ? null
          : pending_alerts_enabled
          ? 1
          : 0;

      const col = await ensureOperatorAlertsColumn(req.db);
      if (!col) {
        return res.status(500).json({ error: "Colonne pending_alerts_enabled indisponible" });
      }

      await req.db.query(
        `UPDATE operators SET ${col} = ? WHERE user_id = ?`,
        [enabled == null ? 1 : enabled, req.user.id]
      );

      res.json({
        message: "Préférence d’alertes mise à jour ",
        data: { pending_alerts_enabled: enabled == null ? 1 : enabled },
      });
    } catch (err) {
      console.error(" Erreur PUT /operator/profile/alerts:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

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
        message: "Coordonnées opérateur mises à jour ",
        data: { lat: latNum, lng: lngNum, ville: ville || null, quartier: quartier || null },
      });
    } catch (err) {
      console.error(" Erreur PUT /operator/profile/location:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  router.get("/requests", authMiddleware, async (req, res) => {
    if (!isOperatorRole(req.user.role)) {
      return res.status(403).json({ error: "Accès refusé" });
    }

    try {
      const { operatorInternal, operatorAlerts } = await getSchemaColumns(req.db);
      const internalSel = operatorInternal ? operatorInternal : null;
      const serviceInternalCol = await getServiceInternalColumn(req.db);

      const [[profile]] = await req.db.query(
        `SELECT lat, lng${internalSel ? `, ${internalSel} AS is_internal` : ""}${
          operatorAlerts ? `, ${operatorAlerts} AS pending_alerts_enabled` : ""
        } FROM operators WHERE user_id = ?`,
        [req.user.id]
      );

      if (!profile || profile.lat == null || profile.lng == null) {
        return res
          .status(400)
          .json({ error: "Profil opérateur introuvable ou sans coordonnées" });
      }

      const baseRadius = await getOperatorMissionRadiusKm(req.db);
      const radiusKm = Math.max(1, Math.min(30, Number(baseRadius)));
      const towingRadiusKm = await getOperatorTowingRadiusKm(req.db);
      let rows;
      const towingConfig = await loadTowingConfig(req.db);
      const alertsEnabled =
        profile.pending_alerts_enabled == null ? 1 : Number(profile.pending_alerts_enabled);

      if (profile.is_internal) {
        [rows] = await req.db.query(
          `SELECT r.*, u.name AS client_name, u.phone AS client_phone
           FROM requests r
           JOIN users u ON u.id = r.user_id
           WHERE r.operator_id = ? AND r.status IN ('publiee','assignee','acceptee','en_route','sur_place','remorquage')
           ORDER BY r.created_at DESC`,
          [req.user.id]
        );
      } else if (alertsEnabled === 0) {
        [rows] = await req.db.query(
          `SELECT r.*, u.name AS client_name, u.phone AS client_phone
           FROM requests r
           JOIN users u ON u.id = r.user_id
           WHERE r.operator_id = ? AND r.status IN ('assignee','acceptee','en_route','sur_place','remorquage')
           ORDER BY r.created_at DESC`,
          [req.user.id]
        );
      } else {
        const serviceInternalSelect = serviceInternalCol
          ? `, COALESCE(s.${serviceInternalCol}, 0) AS service_is_internal`
          : ", 0 AS service_is_internal";
        const serviceInternalPublishedFilter = serviceInternalCol
          ? `AND COALESCE(s.${serviceInternalCol}, 0) = 0`
          : "";
        [rows] = await req.db.query(
          `SELECT * FROM (
              SELECT r.*,
                     u.name AS client_name,
                     u.phone AS client_phone,
                     ${serviceInternalSelect.slice(2)},
                     (6371 * ACOS(
                       COS(RADIANS(?)) * COS(RADIANS(r.lat)) *
                       COS(RADIANS(r.lng) - RADIANS(?)) +
                       SIN(RADIANS(?)) * SIN(RADIANS(r.lat))
                     )) AS distance
              FROM requests r
              JOIN users u ON u.id = r.user_id
              LEFT JOIN services s ON LOWER(TRIM(s.name)) = LOWER(TRIM(r.service))
              WHERE r.lat IS NOT NULL
                AND r.lng IS NOT NULL
                AND NOT (
                  COALESCE(r.service_type, '') = 'oil_service'
                  AND COALESCE(r.service, '') = 'oil_service'
                )
                AND (
                  (r.status = 'publiee' AND r.operator_id IS NULL ${serviceInternalPublishedFilter})
                  OR (r.operator_id = ? AND r.status IN ('publiee','assignee','acceptee','en_route','sur_place','remorquage'))
                )
          ) AS q
          WHERE
            (
              q.status = 'publiee'
              AND q.operator_id IS NULL
              AND (
                q.distance <= ?
                OR (LOWER(q.service) LIKE '%remorqu%' AND q.distance <= ?)
              )
            )
            OR (q.operator_id = ? AND q.status IN ('publiee','assignee','acceptee','en_route','sur_place','remorquage'))
          ORDER BY q.created_at ASC`,
          [profile.lat, profile.lng, profile.lat, req.user.id, radiusKm, towingRadiusKm, req.user.id]
        );
      }

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

      const operatorCoords = { lat: Number(profile.lat), lng: Number(profile.lng) };

      res.json({
        message: "Missions disponibles ",
        data: await Promise.all(
          rows.map(async (r) => {
            let preview = null;
            try {
              preview = await computePreviewPricing(req.db, r, operatorCoords, towingConfig);
            } catch {
              preview = null;
            }
            return {
              ...r,
              photos: (photosByReq.get(r.id) || []).map((u) => buildPhotoURL(u)),
              preview_final_price: preview?.finalPrice ?? null,
              preview_total_km: preview?.totalKm ?? null,
            };
          })
        ),
      });
    } catch (err) {
      console.error(" Erreur GET /operator/requests:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  router.get("/requests/:id", authMiddleware, async (req, res) => {
    if (!isOperatorRole(req.user.role)) {
      return res.status(403).json({ error: "Accès refusé" });
    }

    try {
      const { id } = req.params;

      const { operatorInternal } = await getSchemaColumns(req.db);
      const internalSel = operatorInternal ? `, ${operatorInternal} AS is_internal` : "";
      const [[profile]] = await req.db.query(
        `SELECT lat, lng${internalSel} FROM operators WHERE user_id = ?`,
        [req.user.id]
      );
      if (!profile || profile.lat == null || profile.lng == null) {
        return res
          .status(400)
          .json({ error: "Profil opérateur introuvable ou sans coordonnées" });
      }

      const baseRadius = await getOperatorMissionRadiusKm(req.db);
      const radiusKm = Math.max(1, Math.min(30, Number(baseRadius)));

      const towingRadiusKm = await getOperatorTowingRadiusKm(req.db);
      const serviceInternalCol = await getServiceInternalColumn(req.db);
      const serviceInternalSelect = serviceInternalCol
        ? `, COALESCE(s.${serviceInternalCol}, 0) AS service_is_internal`
        : ", 0 AS service_is_internal";
      const serviceInternalVisibilityCondition =
        "AND COALESCE(q.service_is_internal, 0) = 0";

      const [rows] = await req.db.query(
        `SELECT * FROM (
           SELECT r.*, 
                  u.name  AS client_name, 
                  u.phone AS client_phone,
                  op.id   AS operator_profile_id,
                  ou.name AS operator_name,
                  ou.phone AS operator_phone,
                  t.status AS payment_status,
                  t.payment_method AS payment_method,
                  EXISTS(
                    SELECT 1
                    FROM request_events re
                    WHERE re.request_id = r.id
                      AND re.type = 'cash_received_operator'
                    LIMIT 1
                  ) AS cash_received_by_operator,
                  ${serviceInternalSelect.slice(2)},
                  (6371 * ACOS(
                    COS(RADIANS(?)) * COS(RADIANS(r.lat)) *
                    COS(RADIANS(r.lng) - RADIANS(?)) +
                    SIN(RADIANS(?)) * SIN(RADIANS(r.lat))
                  )) AS distance
           FROM requests r
           JOIN users u ON u.id = r.user_id
           LEFT JOIN users ou ON ou.id = r.operator_id
           LEFT JOIN operators op ON op.user_id = ou.id
           LEFT JOIN transactions t ON t.request_id = r.id
           LEFT JOIN services s ON LOWER(TRIM(s.name)) = LOWER(TRIM(r.service))
           WHERE r.id = ?
         ) AS q
         WHERE
           q.operator_id = ?
           OR (
             q.status = 'publiee'
             AND q.operator_id IS NULL
             AND NOT (
               COALESCE(q.service_type, '') = 'oil_service'
               AND COALESCE(q.service, '') = 'oil_service'
             )
             ${serviceInternalVisibilityCondition}
             AND (
               q.distance <= ?
               OR (LOWER(q.service) LIKE '%remorqu%' AND q.distance <= ?)
             )
           )
         LIMIT 1`,
        [
          profile.lat,
          profile.lng,
          profile.lat,
          id,
          req.user.id,
          radiusKm,
          towingRadiusKm,
        ]
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

      const operatorCoords = { lat: Number(profile.lat), lng: Number(profile.lng) };
      let preview = null;
      try {
        preview = await computePreviewPricing(req.db, rows[0], operatorCoords);
      } catch {
        preview = null;
      }

      res.json({
        message: "Détail mission récupéré ",
        data: {
          ...rows[0],
          photos: photosRows.map((p) => buildPhotoURL(p.url)),
          preview_final_price: preview?.finalPrice ?? null,
          preview_total_km: preview?.totalKm ?? null,
        },
      });
    } catch (err) {
      console.error(" Erreur GET /operator/requests/:id:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  //Accepter mission + calcul remorquage dynamique
router.post("/requests/:id/accepter", authMiddleware, async (req, res) => {
  if (!isOperatorRole(req.user.role)) {
    return res.status(403).json({ error: "Accès refusé" });
  }

  let connection;
  try {
    const { id } = req.params;

    connection = await req.db.getConnection();
    await connection.beginTransaction();

    const { operatorDispo, operatorInternal } = await getSchemaColumns(connection);

    const opSelect = [];
    if (operatorDispo) opSelect.push(`${operatorDispo} AS dispo`);
    if (operatorInternal) opSelect.push(`${operatorInternal} AS is_internal`);

    let operatorProfile = null;
    if (opSelect.length) {
      const [[opRow]] = await connection.query(
        `SELECT ${opSelect.join(", ")} FROM operators WHERE user_id = ? LIMIT 1`,
        [req.user.id]
      );
      operatorProfile = opRow || null;
    }

    if (operatorDispo) {
      if (operatorProfile && Number(operatorProfile.dispo) === 0) {
        await connection.rollback();
        connection.release();
        return res.status(403).json({ error: "Compte opérateur indisponible" });
      }
    }

    const isInternalOperator = Number(operatorProfile?.is_internal) === 1;

    const [active] = await connection.query(
      "SELECT id FROM requests WHERE operator_id = ? AND status IN ('assignee','acceptee','en_route','sur_place','remorquage') LIMIT 1",
      [req.user.id]
    );
    if (active.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        error: "Vous avez déjà une mission en cours",
        code: "ACTIVE_MISSION",
      });
    }

    // Charger la mission avant acceptation
    const [rowsBefore] = await connection.query(
      `SELECT r.*, u.name AS client_name, u.phone AS client_phone
       FROM requests r
       JOIN users u ON u.id = r.user_id
       WHERE r.id = ?
         AND (
           (r.status = 'publiee' AND r.operator_id IS NULL)
           OR (r.status IN ('publiee','assignee') AND r.operator_id = ?)
         )
       FOR UPDATE`,
      [id, req.user.id]
    );
    const missionBefore = rowsBefore[0];
    if (!missionBefore) {
      await connection.rollback();
      connection.release();
      return res
        .status(409)
        .json({ error: "Mission introuvable ou déjà prise" });
    }

    const isOilService =
      String(missionBefore.service_type || "").toLowerCase() === "oil_service" &&
      String(missionBefore.service || "").toLowerCase() === "oil_service";

    const isInternalService = await isInternalServiceByName(
      connection,
      missionBefore?.service
    );

    if (
      (isOilService || isInternalService) &&
      Number(missionBefore.operator_id) !== Number(req.user.id)
    ) {
      await connection.rollback();
      connection.release();
      return res.status(403).json({
        error: "Mission réservée: seul l'opérateur désigné par l'admin peut l'accepter",
      });
    }

    if (!isInternalOperator) {
      if (isInternalService) {
        await connection.rollback();
        connection.release();
        return res.status(403).json({
          error: "Mission réservée aux opérateurs internes",
        });
      }
    }

    const isTow =
      String(missionBefore.service || "").toLowerCase().includes("remor") ||
      String(missionBefore.service || "").toLowerCase().includes("remorqu");

    let finalPrice = Number(missionBefore.estimated_price || 0);
    let totalKm = null;

    // Calcul remorquage 
    if (isTow) {
      const [[operatorProfile]] = await connection.query(
        "SELECT lat, lng FROM operators WHERE user_id = ? LIMIT 1",
        [req.user.id]
      );

      const operatorLat = operatorProfile?.lat != null ? Number(operatorProfile.lat) : null;
      const operatorLng = operatorProfile?.lng != null ? Number(operatorProfile.lng) : null;
      const clientLat = missionBefore.lat != null ? Number(missionBefore.lat) : null;
      const clientLng = missionBefore.lng != null ? Number(missionBefore.lng) : null;
      const destLat = missionBefore.dest_lat != null ? Number(missionBefore.dest_lat) : null;
      const destLng = missionBefore.dest_lng != null ? Number(missionBefore.dest_lng) : null;

      const coordsValid =
        Number.isFinite(operatorLat) &&
        Number.isFinite(operatorLng) &&
        Number.isFinite(clientLat) &&
        Number.isFinite(clientLng) &&
        Number.isFinite(destLat) &&
        Number.isFinite(destLng);

      if (!coordsValid) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: "Coordonnées incomplètes pour le remorquage" });
      }

      const client = { lat: clientLat, lng: clientLng };
      const destination = { lat: destLat, lng: destLng };

      const config = await loadTowingConfig(connection);
      let pricing = computeDynamicPrice(config, { lat: operatorLat, lng: operatorLng }, client, destination);

      if (!pricing) {
        pricing = computeFallbackPrice(
          missionBefore.estimated_price,
          { lat: operatorLat, lng: operatorLng },
          client,
          destination
        );
      }

      if (!pricing) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: "Impossible de calculer le tarif remorquage" });
      }

      finalPrice = pricing.finalPrice;
      totalKm = pricing.totalKm ?? null;
      const canStoreFinal = await ensureFinalPriceColumn(connection);
      if (canStoreFinal) {
        await connection.query(
          "UPDATE requests SET estimated_price = ?, final_price = ? WHERE id = ?",
          [finalPrice, finalPrice, id]
        );
        missionBefore.final_price = finalPrice;
        if (totalKm != null) missionBefore.total_km = totalKm;
      } else {
        await connection.query(
          "UPDATE requests SET estimated_price = ? WHERE id = ?",
          [finalPrice, id]
        );
      }
    }

    // Assigner la mission à l’opérateur
    const [result] = await connection.query(
      "UPDATE requests SET operator_id = ?, status = 'acceptee', accepted_at = NOW() WHERE id = ? AND status IN ('publiee','assignee') AND (operator_id IS NULL OR operator_id = ?)",
      [req.user.id, id, req.user.id]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      connection.release();
      return res
        .status(409)
        .json({ error: "Mission déjà prise par un autre opérateur" });
    }

    await connection.query(
      "INSERT INTO request_events (request_id, type, meta, created_at) VALUES (?, 'acceptee', ?, NOW())",
      [id, JSON.stringify({ operator_id: req.user.id })]
    );

    const [[mission]] = await connection.query(
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

    const [photosRows] = await connection.query(
      `SELECT url FROM request_photos WHERE request_id = ? ORDER BY id ASC`,
      [id]
    );
    const photos = photosRows.map((p) => buildPhotoURL(p.url));

    await connection.commit();
    connection.release();

    const missionPayload = missionToSocketPayload(
      {
        ...mission,
        estimated_price: finalPrice,
        final_price: finalPrice,
        total_km: totalKm,
      },
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

    const [[userNotif]] = await req.db.query(
      "SELECT notification_token FROM users WHERE id = ? AND notification_token IS NOT NULL",
      [mission.user_id]
    );
    if (userNotif) {
      await sendPushNotification(
        userNotif.notification_token,
        "Mission acceptée",
        `Votre mission #${id} a été acceptée par ${req.user.name} pour ${finalPrice} FCFA`,
        {
          type: "mission_accepted",
          request_id: Number(id),
          status: "acceptee",
        }
      );
    }

    res.json({
      message: "Mission acceptée ",
      mission: {
        ...mission,
        estimated_price: finalPrice,
        photos,
      },
    });
  } catch (err) {
    console.error(" Erreur POST /operator/requests/:id/accepter:", err);
    if (connection) {
      try {
        await connection.rollback();
        connection.release();
      } catch {}
    }
    res.status(500).json({ error: "Erreur serveur" });
  }
});
router.post("/requests/:id/:action", authMiddleware, async (req, res, next) => {
  if (!isOperatorRole(req.user.role))
    return res.status(403).json({ error: "Accès refusé" });

    if (String(req.params?.action || "").toLowerCase() === "confirm-cash-payment") {
      return next();
    }

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

      if (action === "terminee") {
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
        await req.db.query(
          "UPDATE requests SET status = ?, finished_at = NOW() WHERE id = ?",
          [action, id]
        );
        const gross = Number.isFinite(Number(mission.estimated_price))
          ? Number(mission.estimated_price)
          : 0;
        const currency = mission.currency || "FCFA";
        const commissionPercent = await getCommissionPercent(req.db);
        const [existingTx] = await req.db.query(
          "SELECT id FROM transactions WHERE request_id = ? LIMIT 1",
          [id]
        );
        if (!existingTx.length) {
          await req.db.query(
            `INSERT INTO transactions (operator_id, request_id, amount, currency, status, commission_percent, created_at)
             VALUES (?, ?, ?, ?, 'en_attente', ?, NOW())`,
            [req.user.id, id, gross, currency, commissionPercent]
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
        await req.db.query("UPDATE requests SET status = ? WHERE id = ?", [
          action,
          id,
        ]);
      }

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

      const [[operatorNotif]] = await req.db.query(
        "SELECT notification_token FROM users WHERE id = ? AND notification_token IS NOT NULL",
        [req.user.id]
      );
      if (operatorNotif) {
        let title = " Mise à jour de mission";
        let body = `Votre mission #${id} est maintenant ${action}`;
        if (action === "terminee") body = `Votre mission #${id} est terminée `;
        await sendPushNotification(operatorNotif.notification_token, title, body);
      }

      const [[clientNotif]] = await req.db.query(
        "SELECT notification_token FROM users WHERE id = ? AND notification_token IS NOT NULL",
        [updated.user_id]
      );
      if (clientNotif) {
        let body = `Votre mission #${id} mise à jour: ${action}`;
        if (action === "terminee") body = `Votre mission #${id} est terminée `;
        await sendPushNotification(
          clientNotif.notification_token,
          "Mise à jour TowTruck",
          body
        );
      }

      res.json({
        message: `Mission ${
          action === "terminee" ? "terminée" : action.replace("_", " ")
        } `,
        mission: updated,
      });
    } catch (err) {
      console.error(" Erreur POST /operator/requests/:id/:action:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ✅ Confirmation paiement espèces par l'opérateur
  router.post("/requests/:id/confirm-cash-payment", authMiddleware, async (req, res) => {
    if (!isOperatorRole(req.user.role)) {
      return res.status(403).json({ error: "Accès refusé" });
    }

    try {
      const { id } = req.params;
      const operatorId = Number(req.user?.id || 0);
      console.log("[cash-confirm] hit", {
        request_id: Number(id),
        operator_id: operatorId,
        role: String(req.user?.role || ""),
      });

      // Ensure commission_percent exists on transactions (compat anciennes bases)
      try {
        await req.db.query("SELECT commission_percent FROM transactions LIMIT 1");
      } catch (e) {
        if (e?.code === "ER_BAD_FIELD_ERROR") {
          await req.db.query(
            "ALTER TABLE transactions ADD COLUMN commission_percent DECIMAL(5,2) DEFAULT NULL"
          );
        }
      }
      // Ensure payment_method exists on transactions
      try {
        await req.db.query("SELECT payment_method FROM transactions LIMIT 1");
      } catch (e) {
        if (e?.code === "ER_BAD_FIELD_ERROR") {
          await req.db.query(
            "ALTER TABLE transactions ADD COLUMN payment_method VARCHAR(20) DEFAULT NULL"
          );
        }
      }

      const [[mission]] = await req.db.query(
        `SELECT r.*, u.notification_token AS client_notification_token
         FROM requests r
         LEFT JOIN users u ON u.id = r.user_id
         WHERE r.id = ? AND r.operator_id = ?
         LIMIT 1`,
        [id, req.user.id]
      );

      if (!mission) {
        console.warn("[cash-confirm] mission_not_found_or_forbidden", {
          request_id: Number(id),
          operator_id: operatorId,
        });
        return res.status(404).json({ error: "Mission introuvable ou non autorisée" });
      }

      if (String(mission.status || "") !== "terminee") {
        console.warn("[cash-confirm] mission_not_finished", {
          request_id: Number(id),
          operator_id: operatorId,
          status: String(mission.status || ""),
        });
        return res.status(400).json({
          error: "La mission doit être terminée avant confirmation du paiement espèces",
        });
      }

      const grossAmount = Number.isFinite(Number(mission.estimated_price))
        ? Number(mission.estimated_price)
        : 0;
      const currency = mission.currency || "FCFA";
      const commissionPercent = await getCommissionPercent(req.db);

      const [existingRows] = await req.db.query(
        "SELECT * FROM transactions WHERE request_id = ? ORDER BY id DESC LIMIT 1",
        [id]
      );

      let txId;
      if (!existingRows.length) {
        const [insertTx] = await req.db.query(
          `INSERT INTO transactions
             (operator_id, request_id, amount, currency, status, commission_percent, payment_method, created_at)
           VALUES (?, ?, ?, ?, 'en_attente', ?, 'cash', NOW())`,
          [req.user.id, id, grossAmount, currency, commissionPercent]
        );
        txId = insertTx.insertId;
        console.log("[cash-confirm] tx_created", {
          request_id: Number(id),
          operator_id: operatorId,
          tx_id: Number(txId),
          payment_method: "cash",
        });
      } else {
        const tx = existingRows[0];
        txId = tx.id;
        console.log("[cash-confirm] tx_found", {
          request_id: Number(id),
          operator_id: operatorId,
          tx_id: Number(txId),
          tx_status: String(tx.status || ""),
          tx_payment_method: String(tx.payment_method || ""),
        });

        if (String(tx.status || "") === "confirmée") {
          console.warn("[cash-confirm] tx_already_admin_confirmed", {
            request_id: Number(id),
            operator_id: operatorId,
            tx_id: Number(txId),
          });
          return res.status(400).json({
            error: "Transaction déjà validée définitivement par l'administration",
          });
        }

        if (tx.payment_method && String(tx.payment_method).toLowerCase() !== "cash") {
          console.warn("[cash-confirm] tx_method_not_cash", {
            request_id: Number(id),
            operator_id: operatorId,
            tx_id: Number(txId),
            tx_payment_method: String(tx.payment_method || ""),
          });
          return res.status(400).json({
            error: "Le client n'a pas choisi le paiement espèces pour cette mission",
          });
        }

        if (String(tx.status || "") !== "confirmée") {
          await req.db.query(
            `UPDATE transactions
             SET status = 'en_attente',
                 amount = ?,
                 currency = ?,
                 commission_percent = ?,
                 payment_method = 'cash'
             WHERE id = ?`,
            [grossAmount, currency, commissionPercent, txId]
          );
        }
      }

      let alreadyCashReceivedRow = null;
      try {
        const [alreadyRows] = await req.db.query(
          `SELECT id FROM request_events
           WHERE request_id = ? AND type = 'cash_received_operator'
           ORDER BY id DESC
           LIMIT 1`,
          [id]
        );
        alreadyCashReceivedRow = Array.isArray(alreadyRows) && alreadyRows.length > 0
          ? alreadyRows[0]
          : null;
      } catch (eventsReadErr) {
        console.warn("[cash-confirm] request_events_read_warning", {
          request_id: Number(id),
          tx_id: Number(txId),
          message: eventsReadErr?.message || String(eventsReadErr),
          code: eventsReadErr?.code || null,
        });
      }

      if (alreadyCashReceivedRow) {
        console.log("[cash-confirm] already_signaled", {
          request_id: Number(id),
          operator_id: operatorId,
          tx_id: Number(txId),
        });
        return res.json({
          message: "Paiement espèces déjà signalé",
          data: {
            request_id: Number(id),
            transaction_id: Number(txId),
            amount: grossAmount,
            currency,
            status: "en_attente",
            cash_received_by_operator: true,
            already_confirmed: true,
          },
        });
      }

      try {
        await req.db.query(
          "INSERT INTO request_events (request_id, type, meta, created_at) VALUES (?, 'cash_received_operator', ?, NOW())",
          [
            id,
            JSON.stringify({
              operator_id: Number(req.user.id),
              transaction_id: Number(txId),
              payment_method: "cash",
            }),
          ]
        );
      } catch (eventsInsertErr) {
        console.warn("[cash-confirm] request_events_insert_warning", {
          request_id: Number(id),
          tx_id: Number(txId),
          message: eventsInsertErr?.message || String(eventsInsertErr),
          code: eventsInsertErr?.code || null,
        });
      }

      // Temps réel admin + opérateur
      try {
        io.to("admins").emit("transaction_updated", {
          id: Number(txId),
          operator_id: req.user.id,
          request_id: Number(id),
          amount: grossAmount,
          commission_percent: commissionPercent,
          payment_method: "cash",
          status: "en_attente",
          cash_received_by_operator: true,
          message: `Paiement espèces déclaré reçu par l'opérateur pour mission #${id}`,
        });

        io.to("admins").emit("dashboard_update", {
          type: "transaction",
          action: "updated",
          id: Number(txId),
          status: "en_attente",
          payment_method: "cash",
        });

        io.to(`operator:${Number(req.user.id)}`).emit("payment_cash_received", {
          id: Number(txId),
          request_id: Number(id),
          amount: grossAmount,
          currency,
          commission_percent: commissionPercent,
          payment_method: "cash",
          status: "en_attente",
          cash_received_by_operator: true,
          message: `Paiement espèces reçu pour mission #${id}. Validation admin en cours.`,
        });
      } catch (emitErr) {
        console.warn("[cash-confirm] emit_warnings", {
          request_id: Number(id),
          tx_id: Number(txId),
          message: emitErr?.message || String(emitErr),
        });
      }

      // Message user: in-app (socket) si ouvert, push fallback s'il est fermé
      const userMessage = `L'opérateur a confirmé la réception du paiement en espèces pour la mission #${id}. Validation administrative en cours.`;
      try {
        io.to(`client:${Number(mission.user_id)}`).emit("payment_cash_confirmed", {
          request_id: Number(id),
          transaction_id: Number(txId),
          amount: grossAmount,
          currency,
          status: "en_attente",
          payment_method: "cash",
          cash_received_by_operator: true,
          message: userMessage,
        });
      } catch (emitClientErr) {
        console.warn("[cash-confirm] emit_client_warning", {
          request_id: Number(id),
          tx_id: Number(txId),
          message: emitClientErr?.message || String(emitClientErr),
        });
      }

      if (mission.client_notification_token) {
        try {
          await sendPushNotification(
            mission.client_notification_token,
            "Paiement espèces confirmé",
            userMessage,
            {
              type: "payment_cash_confirmed",
              request_id: Number(id),
              transaction_id: Number(txId),
              status: "en_attente",
              payment_method: "cash",
              cash_received_by_operator: true,
            }
          );
        } catch (pushErr) {
          console.warn("[cash-confirm] push_warning", {
            request_id: Number(id),
            tx_id: Number(txId),
            message: pushErr?.message || String(pushErr),
          });
        }
      }

      res.json({
        message: "Paiement espèces reçu par l'opérateur. Validation admin en cours",
        data: {
          request_id: Number(id),
          transaction_id: Number(txId),
          amount: grossAmount,
          currency,
          status: "en_attente",
          payment_method: "cash",
          cash_received_by_operator: true,
        },
      });

      console.log("[cash-confirm] success", {
        request_id: Number(id),
        operator_id: operatorId,
        tx_id: Number(txId),
        payment_method: "cash",
        status: "en_attente",
      });
    } catch (err) {
      console.error(" Erreur POST /operator/requests/:id/confirm-cash-payment:", {
        request_id: Number(req.params?.id),
        operator_id: Number(req.user?.id || 0),
        code: err?.code || null,
        message: err?.message || String(err),
      });
      res.status(500).json({
        error: "Erreur serveur",
        details: err?.message || String(err),
        code: err?.code || null,
      });
    }
  });

  //  Historique des événements d’une mission
  router.get("/requests/:id/events", authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await req.db.query(
        "SELECT * FROM request_events WHERE request_id = ? ORDER BY created_at ASC",
        [id]
      );
      res.json({ message: "Historique récupéré ", data: rows });
    } catch (err) {
      console.error(" Erreur GET /operator/requests/:id/events:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Mission active 
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
      console.error(" Erreur GET /operator/active:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Historique des missions terminees (compat sans JSON_ARRAYAGG)
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
        message: "Historique récupéré ",
        data: rows.map((r) => ({
          ...r,
          photos: (photosByReq.get(r.id) || []).map((u) => buildPhotoURL(u)),
        })),
      });
    } catch (err) {
      console.error(" Erreur GET /operator/history:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  return router;
}
router.post("/requests/:id/refuser", authMiddleware, async (req, res) => {
  if (!isOperatorRole(req.user.role))
    return res.status(403).json({ error: "Accès refusé" });

  try {
    const { id } = req.params;
    const [[mission]] = await req.db.query(
      "SELECT * FROM requests WHERE id = ? AND operator_id = ? AND status = 'publiee'",
      [id, req.user.id]
    );

    if (!mission) {
      return res.status(403).json({ error: "Mission introuvable ou déjà acceptée" });
    }

    await req.db.query(
      "UPDATE requests SET operator_id = NULL, status = 'publiee', accepted_at = NULL WHERE id = ?",
      [id]
    );

    await req.db.query(
      "INSERT INTO request_events (request_id, type, meta, created_at) VALUES (?, 'refusee', ?, NOW())",
      [id, JSON.stringify({ operator_id: req.user.id })]
    );

    res.json({ message: "Mission refusée, remise en publication" });
  } catch (err) {
    console.error(" Erreur POST /operator/requests/:id/refuser:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});
