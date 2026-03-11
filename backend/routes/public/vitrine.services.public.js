import express from "express";
import { buildUploadUrl } from "../../config/links.js";

const router = express.Router();

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

const makeAbsolute = (req, p = "") => {
  if (!p) return null;
  if (p.startsWith("http")) return p;
  const path = p.startsWith("/") ? p : `/${p}`;
  const proto =
    (req.headers["x-forwarded-proto"] || "").split(",")[0]?.trim() ||
    req.protocol ||
    "http";
  const host =
    (req.headers["x-forwarded-host"] || "").split(",")[0]?.trim() ||
    req.headers.host;
  if (host) return `${proto}://${host}${path}`;
  return buildUploadUrl(path);
};

const normalizeIcon = (req, value) => {
  if (!value) return { icon: null, icon_url: null };
  const raw = String(value).trim();
  if (!raw) return { icon: null, icon_url: null };
  if (/^[a-z0-9]+:/i.test(raw)) return { icon: raw, icon_url: raw };
  if (raw.startsWith("http")) return { icon: raw, icon_url: raw };
  const path = raw.startsWith("/") ? raw : `/uploads/vitrine-services/${raw}`;
  return { icon: path, icon_url: makeAbsolute(req, path) };
};

export default (db) => {
  router.get("/", async (req, res) => {
    try {
      await ensureTable(db);
      const [rows] = await db.query(
        `SELECT id, name, subtitle, description, price, icon_url, icon, image_url
         FROM vitrine_services
         WHERE is_active = 1
         ORDER BY id DESC`
      );

      const data = rows.map((s) => ({
        id: s.id,
        name: s.name,
        subtitle: s.subtitle || "",
        description: s.description || "",
        price: Number(s.price),
        image_url: makeAbsolute(req, s.image_url),
        ...normalizeIcon(req, s.icon_url || s.icon),
      }));

      res.json({ data, count: data.length });
    } catch (err) {
      console.error("❌ GET /api/vitrine/services/public:", err);
      res.status(500).json({ error: "Erreur serveur vitrine services" });
    }
  });

  return router;
};

