// routes/admin/config.js
import express from "express";
import authMiddleware from "../../middleware/auth.js";
import { loadAdminPermissions, checkPermission } from "../../middleware/checkPermission.js";
import { sendSMS } from "../../config/twilo.js";

const router = express.Router();

const logAdminEvent = async (db, adminId, action, meta = {}) => {
  try {
    if (!db || !adminId) return;
    await db.query(
      "INSERT INTO admin_events (admin_id, action, meta, created_at) VALUES (?, ?, ?, NOW())",
      [adminId, action, JSON.stringify(meta)]
    );
  } catch (e) {
    console.warn("⚠️ log admin_events (config):", e?.message || e);
  }
};

export default (db) => {
  // Injecte la DB dans req
  router.use((req, _res, next) => {
    req.db = db;
    next();
  });

  // Auth + permissions
  router.use(authMiddleware, loadAdminPermissions);

  // ---------------------------------------------------------
  // 📌 Assurer que la table existe + retourner la ligne unique
  // ---------------------------------------------------------
  async function ensureConfigRow(db) {
    try {
      // Ajoute support_email si la table existe déjà mais sans la colonne
      try {
        const [[col]] = await db.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'configurations' AND COLUMN_NAME = 'support_email'`
        );
        if (!col) {
          await db.query(
            "ALTER TABLE configurations ADD COLUMN support_email VARCHAR(120) NOT NULL DEFAULT 'support@ttm.com'"
          );
        }
      } catch (e) {
        // ignore si table absente, traité plus bas
      }
      // Ajoute operator_mission_radius_km si manquante
      try {
        const [[col]] = await db.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'configurations' AND COLUMN_NAME = 'operator_mission_radius_km'`
        );
        if (!col) {
          await db.query(
            "ALTER TABLE configurations ADD COLUMN operator_mission_radius_km DECIMAL(6,2) NOT NULL DEFAULT 5"
          );
        }
      } catch (e) {
        // ignore si table absente, traité plus bas
      }
      // Ajoute operator_towing_radius_km si manquante
      try {
        const [[col]] = await db.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'configurations' AND COLUMN_NAME = 'operator_towing_radius_km'`
        );
        if (!col) {
          await db.query(
            "ALTER TABLE configurations ADD COLUMN operator_towing_radius_km DECIMAL(6,2) NOT NULL DEFAULT 100"
          );
        }
      } catch (e) {
        // ignore si table absente, traité plus bas
      }

      const [[row]] = await db.query(
        "SELECT * FROM configurations LIMIT 1"
      );

      if (!row) {
        await db.query(`
          INSERT INTO configurations 
          (commission_percent, towing_price_per_km, towing_base_price, currency, support_phone, support_whatsapp, support_email, operator_mission_radius_km, operator_towing_radius_km, created_at, updated_at)
          VALUES (10, 500, 0, 'FCFA', '+22373585046', '0022373585046', 'support@ttm.com', 5, 100, NOW(), NOW())
        `);

        const [[created]] = await db.query(
          "SELECT * FROM configurations LIMIT 1"
        );
        return created;
      }

      return row;
    } catch (err) {
      if (err?.code === "ER_NO_SUCH_TABLE") {
        console.warn("⚠️ Table configurations absente → création automatique");

        await db.query(`
          CREATE TABLE IF NOT EXISTS configurations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            commission_percent DECIMAL(5,2) NOT NULL DEFAULT 10.00,
            towing_price_per_km DECIMAL(10,2) NOT NULL DEFAULT 500,
            towing_base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
            currency VARCHAR(10) NOT NULL DEFAULT 'FCFA',
            support_phone VARCHAR(30) NOT NULL DEFAULT '+22373585046',
            support_whatsapp VARCHAR(30) NOT NULL DEFAULT '0022373585046',
            support_email VARCHAR(120) NOT NULL DEFAULT 'support@ttm.com',
            operator_mission_radius_km DECIMAL(6,2) NOT NULL DEFAULT 5,
            operator_towing_radius_km DECIMAL(6,2) NOT NULL DEFAULT 100,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await db.query(`
          INSERT INTO configurations 
          (commission_percent, towing_price_per_km, towing_base_price, currency, support_phone, support_whatsapp, support_email, operator_mission_radius_km, operator_towing_radius_km)
          VALUES (10, 500, 0, 'FCFA', '+22373585046', '0022373585046', 'support@ttm.com', 5, 100)
        `);

        const [[created]] = await db.query(
          "SELECT * FROM configurations LIMIT 1"
        );
        return created;
      }
      throw err;
    }
  }

  // ---------------------------------------------------------
  // 📖 GET — Lire la configuration Business
  // ---------------------------------------------------------
  router.get("/", checkPermission("config_view"), async (req, res) => {
    try {
      const cfg = await ensureConfigRow(req.db);

      const commission = Number(cfg.commission_percent);

      return res.json({
        // 🔙 compat avec l'ancien front
        commission,
        // et nouveaux champs plus explicites
        commission_percent: commission,
        towing_price_per_km: Number(cfg.towing_price_per_km),
        towing_base_price: Number(cfg.towing_base_price),
        currency: cfg.currency || "FCFA",
        support_phone: cfg.support_phone || "+22373585046",
        support_whatsapp: cfg.support_whatsapp || "0022373585046",
        support_email: cfg.support_email || "support@ttm.com",
        operator_mission_radius_km: Number(cfg.operator_mission_radius_km ?? 5),
        operator_towing_radius_km: Number(cfg.operator_towing_radius_km ?? 100),
      });
    } catch (err) {
      console.error("❌ Erreur GET /admin/config:", err);
      res.status(500).json({ error: "Erreur chargement config" });
    }
  });

  // ---------------------------------------------------------
  // ✏️ PUT — Mettre à jour la configuration Business
  // ---------------------------------------------------------
  router.put("/", checkPermission("config_manage"), async (req, res) => {
    try {
      // On récupère d’abord la ligne actuelle
      const cfg = await ensureConfigRow(req.db);
      const id = cfg.id;

      // On accepte:
      //  - commission_percent (nouveau)
      //  - ou commission (ancien front)
      let {
        commission_percent,
        towing_price_per_km,
        towing_base_price,
        currency,
        support_phone,
        support_whatsapp,
        support_email,
        operator_mission_radius_km,
        operator_towing_radius_km,
      } = req.body;

      const rawCommission =
        commission_percent !== undefined
          ? commission_percent
          : (req.body.commission !== undefined
              ? req.body.commission
              : cfg.commission_percent);

      const rawPriceKm =
        towing_price_per_km !== undefined
          ? towing_price_per_km
          : cfg.towing_price_per_km;

      const rawBasePrice =
        towing_base_price !== undefined
          ? towing_base_price
          : cfg.towing_base_price;

      const curr =
        typeof currency === "string" && currency.trim()
          ? currency.trim()
          : cfg.currency || "FCFA";

      const phone =
        typeof support_phone === "string" && support_phone.trim()
          ? support_phone.trim()
          : cfg.support_phone || "+22373585046";

      const whatsapp =
        typeof support_whatsapp === "string" && support_whatsapp.trim()
          ? support_whatsapp.trim()
          : cfg.support_whatsapp || "0022373585046";

      const email =
        typeof support_email === "string" && support_email.trim()
          ? support_email.trim()
          : cfg.support_email || "support@ttm.com";

      const radiusRaw =
        operator_mission_radius_km !== undefined
          ? operator_mission_radius_km
          : cfg.operator_mission_radius_km;
      const towingRadiusRaw =
        operator_towing_radius_km !== undefined
          ? operator_towing_radius_km
          : cfg.operator_towing_radius_km;

      const pct = Number(rawCommission);
      const priceKm = Number(rawPriceKm);
      const basePrice = Number(rawBasePrice);
      const radiusKm = Number(radiusRaw);
      const towingRadiusKm = Number(towingRadiusRaw);

      // 🧪 Validations
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        return res.status(400).json({ error: "Commission invalide (0-100)" });
      }

      if (!Number.isFinite(priceKm) || priceKm < 0) {
        return res.status(400).json({ error: "Prix par km invalide" });
      }

      if (!Number.isFinite(basePrice) || basePrice < 0) {
        return res.status(400).json({ error: "Prix de base invalide" });
      }
      if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 200) {
        return res.status(400).json({ error: "Rayon opérateur invalide (1-200 km)" });
      }
      if (!Number.isFinite(towingRadiusKm) || towingRadiusKm <= 0 || towingRadiusKm > 500) {
        return res.status(400).json({ error: "Rayon remorquage invalide (1-500 km)" });
      }

      // ✅ Update
      await req.db.query(
        `UPDATE configurations 
         SET commission_percent=?, towing_price_per_km=?, towing_base_price=?, currency=?, support_phone=?, support_whatsapp=?, support_email=?, operator_mission_radius_km=?, operator_towing_radius_km=?, updated_at=NOW()
         WHERE id=?`,
        [pct, priceKm, basePrice, curr, phone, whatsapp, email, radiusKm, towingRadiusKm, id]
      );

      await logAdminEvent(req.db, req.user?.id, "config_update", {
        commission_percent: pct,
        towing_price_per_km: priceKm,
        towing_base_price: basePrice,
        currency: curr,
        support_phone: phone,
        support_whatsapp: whatsapp,
        support_email: email,
        operator_mission_radius_km: radiusKm,
        operator_towing_radius_km: towingRadiusKm,
      });

      res.json({
        message: "Configuration mise à jour ✅",
        commission: pct,
        commission_percent: pct,
        towing_price_per_km: priceKm,
        towing_base_price: basePrice,
        currency: curr,
        support_phone: phone,
        support_whatsapp: whatsapp,
        support_email: email,
        operator_mission_radius_km: radiusKm,
        operator_towing_radius_km: towingRadiusKm,
      });
    } catch (err) {
      console.error("❌ Erreur PUT /admin/config:", err);
      res.status(500).json({ error: "Erreur mise à jour config" });
    }
  });

  // ---------------------------------------------------------
  // 📲 POST — Tester l'envoi SMS (admin panel)
  // ---------------------------------------------------------
  router.post("/test-sms", checkPermission("config_manage"), async (req, res) => {
    try {
      const rawPhone = String(req.body?.phone || "").trim();
      if (!rawPhone) {
        return res.status(400).json({ error: "Numero requis" });
      }

      const compact = rawPhone.replace(/\s+/g, "");
      let to = compact;
      if (compact.startsWith("00")) {
        to = `+${compact.slice(2)}`;
      } else if (!compact.startsWith("+")) {
        to = `+223${compact.replace(/^\+?223/, "")}`;
      }

      await sendSMS(to, "TTM test SMS OK");
      await logAdminEvent(req.db, req.user?.id, "config_test_sms", { to });
      return res.json({ message: "SMS de test envoye", to });
    } catch (err) {
      console.error("❌ Erreur POST /admin/config/test-sms:", err);
      return res.status(500).json({
        error: "Erreur envoi SMS",
        code: err?.code,
        message: err?.message,
      });
    }
  });

  return router;
};
