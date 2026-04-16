import express from "express";
import { requireAny, loadAdminPermissions } from "../../middleware/checkPermission.js";
import authMiddleware from "../../middleware/auth.js";
import { getSchemaColumns } from "../../utils/schema.js";

const router = express.Router();

const hasColumn = async (db, table, column) => {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(rows?.[0]?.cnt || 0) > 0;
};

const ensureOilModelColumns = async (db) => {
  const unitPriceExists = await hasColumn(db, "oil_models", "unit_price");
  if (!unitPriceExists) {
    await db.query(
      "ALTER TABLE oil_models ADD COLUMN unit_price DECIMAL(10,2) NULL DEFAULT NULL"
    );
    console.log("🛢️ Migration runtime: oil_models.unit_price ajouté");
  }

  const pricingCols = ["price_1l", "price_4l", "price_5l", "price_20l"];
  for (const col of pricingCols) {
    const exists = await hasColumn(db, "oil_models", col);
    if (!exists) {
      await db.query(
        `ALTER TABLE oil_models ADD COLUMN ${col} DECIMAL(10,2) NULL DEFAULT NULL`
      );
      console.log(`🛢️ Migration runtime: oil_models.${col} ajouté`);
    }
  }
};

const parsePrice = (value) => {
  if (value === "" || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return n;
};

export default (db) => {
  router.use((req, _res, next) => {
    req.db = db;
    next();
  });

  // Auth + chargement des permissions
  router.use(authMiddleware, loadAdminPermissions);

// ========================= OIL MODELS CRUD =========================

/**
 * 🛢️ GET /api/admin/oil-models
 * Liste tous les modèles d'huile
 */
router.get("/oil-models", requireAny(["services_view", "site_view", "site_manage"]), async (req, res) => {
  try {
    await ensureOilModelColumns(req.db);
    const [rows] = await req.db.query(
      "SELECT id, name, description, unit_price, price_1l, price_4l, price_5l, price_20l, is_active, created_at, updated_at FROM oil_models ORDER BY name ASC"
    );

    return res.json({
      message: "✅ Modèles d'huile récupérés",
      data: rows || [],
    });
  } catch (err) {
    console.error("❌ GET /admin/oil-models:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * 🛢️ POST /api/admin/oil-models
 * Créer un modèle d'huile
 */
router.post("/oil-models", requireAny(["services_manage", "site_manage"]), async (req, res) => {
  try {
    await ensureOilModelColumns(req.db);
    const { name, description, is_active, unit_price, price_1l, price_4l, price_5l, price_20l } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Nom du modèle requis" });
    }

    const unitPrice = parsePrice(unit_price);
    const price1L = parsePrice(price_1l);
    const price4L = parsePrice(price_4l);
    const price5L = parsePrice(price_5l);
    const price20L = parsePrice(price_20l);
    if ([unitPrice, price1L, price4L, price5L, price20L].some((v) => Number.isNaN(v))) {
      return res.status(400).json({ error: "Prix/litre invalide" });
    }

    const [result] = await req.db.query(
      "INSERT INTO oil_models (name, description, unit_price, price_1l, price_4l, price_5l, price_20l, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        name.trim(),
        description?.trim() || null,
        unitPrice,
        price1L,
        price4L,
        price5L,
        price20L,
        is_active ? 1 : 0,
      ]
    );

    return res.status(201).json({
      message: "✅ Modèle d'huile créé",
      data: {
        id: result.insertId,
        name,
        description,
        unit_price: unitPrice,
        price_1l: price1L,
        price_4l: price4L,
        price_5l: price5L,
        price_20l: price20L,
        is_active,
      },
    });
  } catch (err) {
    if (err?.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "Ce modèle d'huile existe déjà" });
    }
    console.error("❌ POST /admin/oil-models:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * 🛢️ PUT /api/admin/oil-models/:id
 * Modifier un modèle d'huile
 */
router.put("/oil-models/:id", requireAny(["services_manage", "site_manage"]), async (req, res) => {
  try {
    await ensureOilModelColumns(req.db);
    const { id } = req.params;
    const { name, description, is_active, unit_price, price_1l, price_4l, price_5l, price_20l } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Nom du modèle requis" });
    }

    const unitPrice = parsePrice(unit_price);
    const price1L = parsePrice(price_1l);
    const price4L = parsePrice(price_4l);
    const price5L = parsePrice(price_5l);
    const price20L = parsePrice(price_20l);
    if ([unitPrice, price1L, price4L, price5L, price20L].some((v) => Number.isNaN(v))) {
      return res.status(400).json({ error: "Prix/litre invalide" });
    }

    const [result] = await req.db.query(
      "UPDATE oil_models SET name = ?, description = ?, unit_price = ?, price_1l = ?, price_4l = ?, price_5l = ?, price_20l = ?, is_active = ?, updated_at = NOW() WHERE id = ?",
      [
        name.trim(),
        description?.trim() || null,
        unitPrice,
        price1L,
        price4L,
        price5L,
        price20L,
        is_active ? 1 : 0,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Modèle d'huile introuvable" });
    }

    return res.json({
      message: "✅ Modèle d'huile mis à jour",
      data: {
        id: Number(id),
        name,
        description,
        unit_price: unitPrice,
        price_1l: price1L,
        price_4l: price4L,
        price_5l: price5L,
        price_20l: price20L,
        is_active,
      },
    });
  } catch (err) {
    console.error("❌ PUT /admin/oil-models/:id:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * 🛢️ DELETE /api/admin/oil-models/:id
 * Supprimer un modèle d'huile
 */
router.delete("/oil-models/:id", requireAny(["services_manage", "site_manage"]), async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await req.db.query(
      "DELETE FROM oil_models WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Modèle d'huile introuvable" });
    }

    return res.json({
      message: "✅ Modèle d'huile supprimé",
    });
  } catch (err) {
    console.error("❌ DELETE /admin/oil-models/:id:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// ========================= OIL SERVICE MISSIONS =========================

/**
 * 🛢️ GET /api/admin/oil-service-requests
 * Liste toutes les missions Service à Domicile
 */
router.get("/oil-service-requests", requireAny(["requests_view", "requests_manage", "site_view", "site_manage"]), async (req, res) => {
  try {
    const [rows] = await req.db.query(
      `SELECT 
         r.id, r.user_id, r.vehicle_type, r.oil_liters, r.oil_model_id,
         r.description, r.lat, r.lng, r.address, r.zone, r.status,
         u.name AS user_name, u.phone AS user_phone, u.email AS user_email,
         om.name AS oil_model_name,
         r.created_at
       FROM requests r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN oil_models om ON r.oil_model_id = om.id
       WHERE r.service_type = 'oil_service' OR r.service = 'oil_service'
       ORDER BY r.created_at DESC`
    );

    return res.json({
      message: "✅ Missions Service à Domicile récupérées",
      data: rows || [],
    });
  } catch (err) {
    console.error("❌ GET /admin/oil-service-requests:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * 🛢️ POST /api/admin/oil-service-requests/:requestId/assign
 * Assigner une mission domicile à un opérateur interne uniquement
 * Body: { operator_id }
 */
router.post("/oil-service-requests/:requestId/assign", requireAny(["requests_manage", "site_manage"]), async (req, res) => {
  try {
    const { requestId } = req.params;
    const { operator_id } = req.body;

    if (!operator_id) {
      return res.status(400).json({ error: "operator_id requis" });
    }

    // ✅ Vérifier que la mission existe et est bien domicile
    const [[mission]] = await req.db.query(
      "SELECT id, service_type, service, status, operator_id FROM requests WHERE id = ?",
      [requestId]
    );

    if (!mission) {
      return res.status(404).json({ error: "Mission introuvable" });
    }

    if (mission.service_type !== "oil_service" && mission.service !== "oil_service") {
      return res.status(400).json({ error: "Cette mission n'est pas une mission Service à Domicile" });
    }

    if (mission.status !== "publiee") {
      return res.status(400).json({
        error: "Seules les missions domicile au statut publiée peuvent être assignées",
      });
    }

    if (mission.operator_id) {
      return res.status(400).json({ error: "Cette mission est déjà assignée" });
    }

    // ✅ Vérifier que l'opérateur est INTERNE uniquement
    const { operatorInternal } = await getSchemaColumns(req.db);
    const internalCol = operatorInternal || "is_internal";

    const [[operator]] = await req.db.query(
      `SELECT user_id, ${internalCol} AS is_internal FROM operators WHERE user_id = ?`,
      [operator_id]
    );

    if (!operator) {
      return res.status(404).json({ error: "Opérateur introuvable" });
    }

    if (!operator.is_internal || Number(operator.is_internal) !== 1) {
      console.log(`⚠️ Tentative d'assigner mission domicile à opérateur EXTERNE (ID: ${operator_id})`);
      return res.status(403).json({
        error: "🔒 Seuls les opérateurs internes TTM peuvent assigner des missions domicile",
      });
    }

    // ✅ Mettre à jour la mission
    const [result] = await req.db.query(
      "UPDATE requests SET operator_id = ?, status = 'assignee' WHERE id = ?",
      [operator_id, requestId]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ error: "Impossible de mettre à jour la mission" });
    }

    // ✅ Enregistrer événement
    await req.db.query(
      `INSERT INTO request_events (request_id, type, meta, created_at)
       VALUES (?, ?, ?, NOW())`,
      [
        requestId,
        "assignee",
        JSON.stringify({
          operator_id: Number(operator_id),
          note: `Assignee a operateur interne #${operator_id}`,
        }),
      ]
    );

    // ✅ Notifier via socket
    const io = req.app?.get?.("io");
    if (io) {
      io.to(`operator:${Number(operator_id)}`).emit("oil_service_assigned", {
        requestId,
        operatorId: operator_id,
      });
      io.to("admins").emit("oil_service_assigned", {
        requestId,
        operatorId: operator_id,
      });
    }

    return res.json({
      message: "✅ Mission Service à Domicile assignée à l'opérateur interne",
      data: { requestId, operatorId: operator_id, status: "assignee" },
    });
  } catch (err) {
    console.error("❌ POST /admin/oil-service-requests/:requestId/assign:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * 🛢️ GET /api/admin/oil-service-requests/:requestId
 * Récupérer détails d'une mission domicile
 */
router.get("/oil-service-requests/:requestId", requireAny(["requests_view", "requests_manage", "site_view", "site_manage"]), async (req, res) => {
  try {
    const { requestId } = req.params;

    const [[mission]] = await req.db.query(
      `SELECT 
         r.id, r.user_id, r.vehicle_type, r.oil_liters, r.oil_model_id,
         r.description, r.lat, r.lng, r.address, r.zone, r.status,
         u.name AS user_name, u.phone AS user_phone, u.email AS user_email,
         om.name AS oil_model_name,
         r.created_at
       FROM requests r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN oil_models om ON r.oil_model_id = om.id
       WHERE r.id = ? AND (r.service_type = 'oil_service' OR r.service = 'oil_service')`,
      [requestId]
    );

    if (!mission) {
      return res.status(404).json({ error: "Mission Service à Domicile introuvable" });
    }

    return res.json({
      message: "✅ Détails mission récupérés",
      data: mission,
    });
  } catch (err) {
    console.error("❌ GET /admin/oil-service-requests/:requestId:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
  });

  return router;
};
