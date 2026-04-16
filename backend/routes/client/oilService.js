import express from "express";
import authMiddleware from "../../middleware/auth.js";
import { upload, validateUploadedFilesSignature } from "../../middleware/upload.js";

export default (db) => {
  const router = express.Router();

  const hasColumn = async (table, column) => {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS cnt
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    return Number(rows?.[0]?.cnt || 0) > 0;
  };

  const ensureOilModelColumns = async () => {
    const unitPriceExists = await hasColumn("oil_models", "unit_price");
    if (!unitPriceExists) {
      await db.query(
        "ALTER TABLE oil_models ADD COLUMN unit_price DECIMAL(10,2) NULL DEFAULT NULL"
      );
      console.log("🛢️ Migration runtime: oil_models.unit_price ajouté");
    }

    const pricingCols = ["price_1l", "price_4l", "price_5l", "price_20l"];
    for (const col of pricingCols) {
      const exists = await hasColumn("oil_models", col);
      if (!exists) {
        await db.query(
          `ALTER TABLE oil_models ADD COLUMN ${col} DECIMAL(10,2) NULL DEFAULT NULL`
        );
        console.log(`🛢️ Migration runtime: oil_models.${col} ajouté`);
      }
    }
  };

  // ✅ Passer db à req
  router.use((req, res, next) => {
    req.db = db;
    next();
  });

  function getIo(req) {
    try {
      return req.app?.get?.("io") || null;
    } catch {
      return null;
    }
  }

  /**
   * 🛢️ GET /api/oil-models/public
   * Récupère les modèles d'huile actifs (publique)
   */
  router.get("/public", async (req, res) => {
    try {
      await ensureOilModelColumns();
      const [rows] = await req.db.query(
        "SELECT id, name, description, unit_price, price_1l, price_4l, price_5l, price_20l FROM oil_models WHERE is_active = 1 ORDER BY name ASC"
      );

      return res.json({
        message: "✅ Modèles d'huile récupérés",
        data: rows || [],
      });
    } catch (err) {
      console.error("❌ Erreur GET /oil-models/public:", err);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

/**
 * 🛢️ POST /api/requests/oil-service
 * Créer une mission Service à Domicile
 * Body: { vehicle_type, oil_liters, oil_model_id, description?, lat, lng, address, zone }
 */
  router.post(
    "/oil-service",
    authMiddleware,
    upload.array("photos", 3),
    validateUploadedFilesSignature,
    async (req, res) => {
      try {
        const { vehicle_type, oil_liters, oil_model_id, description, lat, lng, address, zone } = req.body;
        const userId = req.user?.id;

        if (!userId) {
          return res.status(401).json({ error: "Non authentifié" });
        }

    // ✅ Validation champs obligatoires
        if (!vehicle_type || !oil_liters || !oil_model_id) {
          return res.status(400).json({
            error: "Champs obligatoires manquants: vehicle_type, oil_liters, oil_model_id",
          });
        }

        if (!lat || !lng) {
          return res.status(400).json({ error: "Localisation requise (lat, lng)" });
        }

        const latNum = Number(lat);
        const lngNum = Number(lng);
        if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
          return res.status(400).json({ error: "Coordonnées invalides" });
        }

        const oilLiters = Number(oil_liters);
        if (!Number.isFinite(oilLiters) || oilLiters <= 0) {
          return res.status(400).json({ error: "oil_liters doit être un nombre positif" });
        }

    // ✅ Vérifier que le modèle d'huile existe et est actif
        const [[oilModel]] = await req.db.query(
          "SELECT id FROM oil_models WHERE id = ? AND is_active = 1",
          [oil_model_id]
        );

        if (!oilModel) {
          return res.status(400).json({ error: "Modèle d'huile invalide ou inactif" });
        }

        // 🔒 Empêcher plusieurs demandes actives en parallèle pour le même client
        const [active] = await req.db.query(
          `SELECT id
           FROM requests
           WHERE user_id = ?
             AND LOWER(REPLACE(status, ' ', '_')) NOT IN ('terminee','annulee','annulee_client','annulee_admin')
           LIMIT 1`,
          [userId]
        );
        if (active.length > 0) {
          return res.status(409).json({
            error: "Vous avez déjà une demande publiée ou en cours.",
          });
        }

    // ✅ Traiter photos si présentes
        const photosArray = (req.files || [])
          .map((f) => `/uploads/requests/${f.filename}`)
          .filter(Boolean);

    // ✅ Créer la mission
        const [result] = await req.db.query(
          `INSERT INTO requests 
           (user_id, service, service_type, vehicle_type, oil_liters, oil_model_id, 
            description, lat, lng, address, zone, status, published_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            userId,
            "oil_service",
            "oil_service",
            vehicle_type,
            oilLiters,
            oil_model_id,
            description || null,
            latNum,
            lngNum,
            address || null,
            zone || null,
            "publiee",
          ]
        );

      const requestId = result.insertId;

        if (photosArray.length > 0) {
          for (const photoUrl of photosArray) {
            await req.db.query(
              "INSERT INTO request_photos (request_id, url) VALUES (?, ?)",
              [requestId, photoUrl]
            );
          }
        }

    // ✅ Enregistrer événement
        await req.db.query(
          `INSERT INTO request_events (request_id, type, meta, created_at)
           VALUES (?, ?, ?, NOW())`,
          [requestId, "publiee", JSON.stringify({ user_id: userId, service: "oil_service" })]
        );

    // ✅ Notifier les admins en temps réel (socket)
        const io = getIo(req);
        if (io) {
          io.to("admins").emit("new_oil_service_request", {
            requestId,
            userId,
            vehicle_type,
            oil_liters: oilLiters,
            message: `Nouvelle demande Service à Domicile: ${vehicle_type}`,
          });
        }

        return res.status(201).json({
          message: "✅ Demande Service à Domicile créée avec succès",
          data: {
            id: requestId,
            service: "oil_service",
            vehicle_type,
            oil_liters: oilLiters,
            status: "publiee",
          },
        });
      } catch (err) {
        console.error("❌ Erreur POST /requests/oil-service:", err);
        return res.status(500).json({ error: "Erreur serveur" });
      }
    }
  );

  return router;
};
