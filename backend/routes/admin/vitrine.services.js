import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import authMiddleware from "../../middleware/auth.js";
import { loadAdminPermissions, requireAny } from "../../middleware/checkPermission.js";

const router = express.Router();

const uploadDir = "uploads/vitrine-services";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const ensureTable = async (db) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS vitrine_services (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      subtitle VARCHAR(255) NULL,
      description TEXT NULL,
      price DECIMAL(12,2) NOT NULL DEFAULT 0,
      icon_url VARCHAR(255) NULL,
      icon VARCHAR(120) NULL,
      image_url VARCHAR(255) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage });
const uploadAssets = upload.fields([
  { name: "icon", maxCount: 1 },
  { name: "image", maxCount: 1 },
]);

const normalizeIconUrl = (iconUrl) => {
  if (!iconUrl) return null;
  const raw = String(iconUrl).trim();
  if (!raw) return null;
  if (/^[a-z0-9]+:/i.test(raw)) return raw;
  if (raw.startsWith("http")) return raw;
  if (raw.startsWith("/service-icons/") || raw.startsWith("/uploads/")) return raw;
  return `/service-icons/${raw.replace(/^\/+/, "")}`;
};

const normalizeImageUrl = (imageUrl) => {
  if (!imageUrl) return null;
  const raw = String(imageUrl).trim();
  if (!raw) return null;
  if (raw.startsWith("http")) return raw;
  if (raw.startsWith("/uploads/")) return raw;
  return `/uploads/vitrine-services/${raw.replace(/^\/+/, "")}`;
};

export default (db) => {
  router.use((req, _res, next) => {
    req.db = db;
    next();
  });
  router.use(authMiddleware, loadAdminPermissions);

  router.get("/", requireAny(["site_view", "site_manage"]), async (req, res) => {
    try {
      await ensureTable(req.db);
      const [rows] = await req.db.query(
        `SELECT id, name, subtitle, description, price, icon_url, icon, image_url, is_active
         FROM vitrine_services
         ORDER BY id DESC`
      );
      res.json({ message: "Liste vitrine services ✅", data: rows });
    } catch (err) {
      console.error("❌ GET /vitrine/services:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  router.post("/", requireAny(["site_manage"]), uploadAssets, async (req, res) => {
    try {
      await ensureTable(req.db);
      const { name, subtitle, description, price, selected_icon, icon_name, image_url } = req.body;
      if (!name || price == null) return res.status(400).json({ error: "Nom et prix requis" });

      const uploadedIcon = req.files?.icon?.[0]?.filename || null;
      const uploadedImage = req.files?.image?.[0]?.filename || null;

      let finalIcon = null;
      if (uploadedIcon) {
        finalIcon = `/uploads/vitrine-services/${uploadedIcon}`;
      } else if (selected_icon && String(selected_icon).trim()) {
        finalIcon = normalizeIconUrl(selected_icon);
      } else if (icon_name && String(icon_name).trim()) {
        const v = String(icon_name).trim();
        finalIcon = /^[a-z0-9]+:/i.test(v) ? v : `fa6:${v}`;
      }

      const finalImage = uploadedImage
        ? `/uploads/vitrine-services/${uploadedImage}`
        : normalizeImageUrl(image_url);

      const [result] = await req.db.query(
        `INSERT INTO vitrine_services (name, subtitle, description, price, icon_url, icon, image_url, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          String(name).trim(),
          subtitle != null ? String(subtitle).trim() : null,
          description != null ? String(description).trim() : null,
          Number(price),
          finalIcon,
          icon_name != null ? String(icon_name).trim() : null,
          finalImage,
        ]
      );

      const [[created]] = await req.db.query(
        "SELECT id, name, subtitle, description, price, icon_url, icon, image_url, is_active FROM vitrine_services WHERE id = ?",
        [result.insertId]
      );

      res.json({ message: "Service vitrine ajouté ✅", data: created });
    } catch (err) {
      console.error("❌ POST /vitrine/services:", err);
      res.status(500).json({ error: "Erreur ajout service vitrine" });
    }
  });

  router.put("/:id", requireAny(["site_manage"]), uploadAssets, async (req, res) => {
    try {
      await ensureTable(req.db);
      const { name, subtitle, description, price, selected_icon, icon_name, image_url, is_active } = req.body;
      const uploadedIcon = req.files?.icon?.[0]?.filename || null;
      const uploadedImage = req.files?.image?.[0]?.filename || null;

      const fields = [];
      const values = [];

      if (name != null) {
        fields.push("name = ?");
        values.push(String(name).trim());
      }
      if (subtitle != null) {
        fields.push("subtitle = ?");
        values.push(String(subtitle).trim());
      }
      if (description != null) {
        fields.push("description = ?");
        values.push(String(description).trim());
      }
      if (price != null) {
        fields.push("price = ?");
        values.push(Number(price));
      }
      if (is_active != null) {
        fields.push("is_active = ?");
        values.push(Number(is_active) ? 1 : 0);
      }

      if (uploadedImage) {
        fields.push("image_url = ?");
        values.push(`/uploads/vitrine-services/${uploadedImage}`);
      } else if (image_url != null) {
        fields.push("image_url = ?");
        values.push(normalizeImageUrl(image_url));
      }

      if (uploadedIcon) {
        fields.push("icon_url = ?");
        values.push(`/uploads/vitrine-services/${uploadedIcon}`);
      } else if (selected_icon && String(selected_icon).trim()) {
        fields.push("icon_url = ?");
        values.push(normalizeIconUrl(selected_icon));
      } else if (icon_name != null) {
        const clean = String(icon_name).trim();
        fields.push("icon = ?");
        values.push(clean || null);
      }

      if (!fields.length) return res.status(400).json({ error: "Aucune modification" });
      values.push(Number(req.params.id));

      const [result] = await req.db.query(
        `UPDATE vitrine_services SET ${fields.join(", ")} WHERE id = ?`,
        values
      );
      if (!result.affectedRows) return res.status(404).json({ error: "Service introuvable" });

      const [[updated]] = await req.db.query(
        "SELECT id, name, subtitle, description, price, icon_url, icon, image_url, is_active FROM vitrine_services WHERE id = ?",
        [Number(req.params.id)]
      );
      res.json({ message: "Service vitrine mis à jour ✅", data: updated });
    } catch (err) {
      console.error("❌ PUT /vitrine/services:", err);
      res.status(500).json({ error: "Erreur mise à jour service vitrine" });
    }
  });

  router.delete("/:id", requireAny(["site_manage"]), async (req, res) => {
    try {
      await ensureTable(req.db);
      const [[row]] = await req.db.query(
        "SELECT id, icon_url, image_url FROM vitrine_services WHERE id = ?",
        [Number(req.params.id)]
      );
      if (!row) return res.status(404).json({ error: "Service introuvable" });

      for (const fileUrl of [row.icon_url, row.image_url]) {
        if (typeof fileUrl === "string" && fileUrl.startsWith("/uploads/vitrine-services/")) {
          const rel = fileUrl.replace("/uploads/vitrine-services/", "");
          const full = path.join(uploadDir, rel);
          if (fs.existsSync(full)) fs.unlinkSync(full);
        }
      }

      await req.db.query("DELETE FROM vitrine_services WHERE id = ?", [Number(req.params.id)]);
      res.json({ message: "Service vitrine supprimé ✅" });
    } catch (err) {
      console.error("❌ DELETE /vitrine/services:", err);
      res.status(500).json({ error: "Erreur suppression service vitrine" });
    }
  });

  return router;
};

