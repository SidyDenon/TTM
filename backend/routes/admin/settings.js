import express from "express";
import authMiddleware from "../../middleware/auth.js";
import { loadAdminPermissions, checkPermission } from "../../middleware/checkPermission.js";

const router = express.Router();

const logAdminEvent = async (db, adminId, action, meta = {}) => {
  try {
    if (!db || !adminId) return;
    await db.query(
      "INSERT INTO admin_events (admin_id, action, meta, created_at) VALUES (?, ?, ?, NOW())",
      [adminId, action, JSON.stringify(meta)]
    );
  } catch (e) {
    console.warn("⚠️ log admin_events (settings):", e?.message || e);
  }
};

export default (db) => {
  // 🔗 Injection de la DB
  router.use((req, _res, next) => {
    req.db = db;
    next();
  });

  // 🔐 Auth + permissions pour tout le module
  router.use(authMiddleware, loadAdminPermissions);

  // =========================
  // 🔹 SERVICES
  // =========================

  // ➕ Ajouter un service
  router.post("/services", checkPermission("services_manage"), async (req, res) => {
    try {
      const { name, description, price, icon_url } = req.body;
      if (!name) return res.status(400).json({ error: "Nom requis" });

      let numPrice = Number(price ?? 0);
      if (!Number.isFinite(numPrice) || numPrice < 0) {
        return res.status(400).json({ error: "Prix invalide" });
      }

      const [result] = await req.db.query(
        "INSERT INTO services (name, description, price, icon_url) VALUES (?, ?, ?, ?)",
        [name, description || null, numPrice, icon_url || null]
      );

      await logAdminEvent(req.db, req.user?.id, "service_cree", {
        service_id: result.insertId,
        name,
        price: numPrice,
      });

      res.json({ message: "Service ajouté ✅", id: result.insertId });
    } catch (err) {
      console.error("❌ Erreur ajout service:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // 📋 Lister tous les services
  router.get("/services", checkPermission("services_view"), async (req, res) => {
    try {
      const [rows] = await req.db.query("SELECT * FROM services ORDER BY id DESC");
      res.json(rows);
    } catch (err) {
      console.error("❌ Erreur liste services:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ✏️ Modifier un service
  router.put("/services/:id", checkPermission("services_manage"), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, price, icon_url, is_active } = req.body;

      const [rows] = await req.db.query("SELECT * FROM services WHERE id = ?", [id]);
      if (rows.length === 0) return res.status(404).json({ error: "Service introuvable" });

      const current = rows[0];

      let numPrice =
        price !== undefined && price !== null ? Number(price) : Number(current.price);
      if (!Number.isFinite(numPrice) || numPrice < 0) {
        return res.status(400).json({ error: "Prix invalide" });
      }

      await req.db.query(
        "UPDATE services SET name=?, description=?, price=?, icon_url=?, is_active=? WHERE id=?",
        [
          name || current.name,
          description !== undefined ? description : current.description,
          numPrice,
          icon_url !== undefined ? icon_url : current.icon_url,
          is_active !== undefined ? is_active : current.is_active,
          id,
        ]
      );

      await logAdminEvent(req.db, req.user?.id, "service_modifie", {
        service_id: Number(id),
        name: name || current.name,
        price: numPrice,
      });

      res.json({ message: "Service mis à jour ✅" });
    } catch (err) {
      console.error("❌ Erreur update service:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ❌ Supprimer un service
  router.delete("/services/:id", checkPermission("services_manage"), async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await req.db.query("SELECT * FROM services WHERE id = ?", [id]);
      if (rows.length === 0) return res.status(404).json({ error: "Service introuvable" });

      await req.db.query("DELETE FROM services WHERE id = ?", [id]);
      await logAdminEvent(req.db, req.user?.id, "service_supprime", {
        service_id: Number(id),
        name: rows[0]?.name ?? null,
        price: rows[0]?.price != null ? Number(rows[0].price) : null,
      });
      res.json({ message: "Service supprimé ✅" });
    } catch (err) {
      console.error("❌ Erreur delete service:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // =========================
  // 🔹 CONFIGURATION GLOBALE
  // =========================

  async function ensureConfigRow(db) {
    try {
      // Assure les colonnes remorquage sur une base existante
      try {
        await db.query(
          "ALTER TABLE configurations ADD COLUMN towing_price_per_km DECIMAL(10,2) NOT NULL DEFAULT 500"
        );
      } catch (e) {
        if (e?.code !== "ER_DUP_FIELDNAME") throw e;
      }
      try {
        await db.query(
          "ALTER TABLE configurations ADD COLUMN towing_base_price DECIMAL(10,2) NOT NULL DEFAULT 0"
        );
      } catch (e) {
        if (e?.code !== "ER_DUP_FIELDNAME") throw e;
      }

      let [rows] = await db.query("SELECT * FROM configurations LIMIT 1");
      if (!rows.length) {
        await db.query(
          `INSERT INTO configurations (commission_percent, towing_price_per_km, towing_base_price, currency, created_at, updated_at)
           VALUES (10.00, 500, 0, 'FCFA', NOW(), NOW())`
        );
        const [[cfg]] = await db.query("SELECT * FROM configurations LIMIT 1");
        return cfg;
      }
      return rows[0];
    } catch (e) {
      if (e?.code === "ER_NO_SUCH_TABLE") {
        // Création minimale (fallback dev)
        await db.query(`
          CREATE TABLE IF NOT EXISTS configurations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            commission_percent DECIMAL(5,2) NOT NULL DEFAULT 10.00,
            towing_price_per_km DECIMAL(10,2) NOT NULL DEFAULT 500,
            towing_base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
            currency VARCHAR(10) NOT NULL DEFAULT 'FCFA',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        await db.query(
          `INSERT INTO configurations (commission_percent, towing_price_per_km, towing_base_price, currency, created_at, updated_at)
           VALUES (10.00, 500, 0, 'FCFA', NOW(), NOW())`
        );
        const [[cfg]] = await db.query("SELECT * FROM configurations LIMIT 1");
        return cfg;
      }
      throw e;
    }
  }

  // 📄 Récupérer la configuration actuelle
  router.get("/config", checkPermission("config_view"), async (req, res) => {
    try {
      const config = await ensureConfigRow(req.db);
      res.json(config);
    } catch (err) {
      console.error("❌ Erreur GET config:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ✏️ Mettre à jour la configuration
  router.put("/config", checkPermission("config_manage"), async (req, res) => {
    try {
      const { commission_percent, currency } = req.body;

      // charge la ligne existante ou la crée
      const current = await ensureConfigRow(req.db);
      const id = current.id;

      let newCommission =
        commission_percent !== undefined && commission_percent !== null
          ? Number(commission_percent)
          : Number(current.commission_percent ?? 10);

      if (!Number.isFinite(newCommission) || newCommission < 0 || newCommission > 100) {
        return res
          .status(400)
          .json({ error: "Commission invalide (0 à 100 autorisé)" });
      }

      const newCurrency =
        typeof currency === "string" && currency.trim()
          ? currency.trim()
          : current.currency || "FCFA";

      await req.db.query(
        "UPDATE configurations SET commission_percent=?, currency=?, updated_at=NOW() WHERE id=?",
        [newCommission, newCurrency, id]
      );

      await logAdminEvent(req.db, req.user?.id, "config_update", {
        commission_percent: newCommission,
        currency: newCurrency,
      });

      res.json({ message: "Configuration mise à jour ✅" });
    } catch (err) {
      console.error("❌ Erreur update config:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // =========================
// 🔹 TARIFS REMORQUAGE (settings)
// =========================

// 📄 Lire les tarifs remorquage
router.get("/tow-pricing", checkPermission("config_view"), async (req, res) => {
  try {
    const cfg = await ensureConfigRow(req.db);

    let base = Number(cfg?.towing_base_price);
    let perKm = Number(cfg?.towing_price_per_km);

    if (!Number.isFinite(base) || !Number.isFinite(perKm)) {
      const [rows] = await req.db.query(
        "SELECT key_name, value FROM settings WHERE key_name IN ('tow_base_price','tow_price_per_km','remorquage_base_price','remorquage_price_per_km')"
      );
      const byKey = new Map((rows || []).map((r) => [String(r.key_name), Number(r.value)]));
      const legacyBase = byKey.get("tow_base_price");
      const legacyBaseFr = byKey.get("remorquage_base_price");
      const legacyKm = byKey.get("tow_price_per_km");
      const legacyKmFr = byKey.get("remorquage_price_per_km");
      if (!Number.isFinite(base)) {
        base = Number.isFinite(legacyBase) ? legacyBase : legacyBaseFr;
      }
      if (!Number.isFinite(perKm)) {
        perKm = Number.isFinite(legacyKm) ? legacyKm : legacyKmFr;
      }
    }

    res.json({
      tow_base_price: Number.isFinite(base) ? base : 10000,
      tow_price_per_km: Number.isFinite(perKm) ? perKm : 500,
    });
  } catch (err) {
    console.error("❌ Erreur GET /tow-pricing:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ✏️ Modifier un tarif remorquage
router.put("/tow-pricing", checkPermission("config_manage"), async (req, res) => {
  try {
    const { tow_base_price, tow_price_per_km } = req.body;

    if (tow_base_price == null || tow_price_per_km == null)
      return res.status(400).json({ error: "Paramètres manquants" });

    const base = Number(tow_base_price);
    const perKm = Number(tow_price_per_km);

    if (!Number.isFinite(base) || base < 0)
      return res.status(400).json({ error: "Prix de base invalide" });

    if (!Number.isFinite(perKm) || perKm < 0)
      return res.status(400).json({ error: "Prix au km invalide" });

    const cfg = await ensureConfigRow(req.db);

    // ✔️ Source principale: configurations
    await req.db.query(
      "UPDATE configurations SET towing_base_price = ?, towing_price_per_km = ?, updated_at = NOW() WHERE id = ?",
      [base, perKm, cfg.id]
    );

    // ✔️ Miroir legacy settings pour compatibilité descendante
    await req.db.query(
      `INSERT INTO settings (key_name, value) VALUES 
         ('tow_base_price', ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value)`,
      [String(base)]
    );

    await req.db.query(
      `INSERT INTO settings (key_name, value) VALUES 
         ('tow_price_per_km', ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value)`,
      [String(perKm)]
    );
    await req.db.query(
      `INSERT INTO settings (key_name, value) VALUES 
         ('remorquage_base_price', ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value)`,
      [String(base)]
    );
    await req.db.query(
      `INSERT INTO settings (key_name, value) VALUES 
         ('remorquage_price_per_km', ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value)`,
      [String(perKm)]
    );

    await logAdminEvent(req.db, req.user?.id, "tow_pricing_update", {
      tow_base_price: base,
      tow_price_per_km: perKm,
    });

    res.json({
      message: "Tarifs remorquage mis à jour ✅",
      tow_base_price: base,
      tow_price_per_km: perKm,
    });

  } catch (err) {
    console.error("❌ Erreur PUT /tow-pricing:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});


  return router;
};
