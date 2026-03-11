import express from "express";
import { buildUploadUrl } from "../../config/links.js";

export default (db) => {
  const router = express.Router();

  const normalizeServiceIcon = (req, value) => {
    if (!value) return { icon: null, icon_url: null };
    const raw = String(value).trim();

    const makeAbsolute = (p = "") => {
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
      // dernier recours: BASE_URL
      return buildUploadUrl(path);
    };

    // Icône virtuelle avec préfixe de pack (fa:, mci:, ion:, gi:, etc.)
    if (/^[a-z0-9]+:/i.test(raw)) {
      return { icon: raw, icon_url: raw };
    }

    // URL absolue déjà servie
    if (raw.startsWith("http")) {
      return { icon: raw, icon_url: raw };
    }

    // Fichier local (service-icons ou uploads)
    if (raw.startsWith("/service-icons/") || raw.startsWith("/uploads/")) {
      return { icon: raw, icon_url: makeAbsolute(raw) };
    }
    const path = `/uploads/services/${raw.replace(/^\/+/, "")}`;
    return { icon: path, icon_url: makeAbsolute(path) };
  };

  const normalizeServiceImage = (req, value) => {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    if (raw.startsWith("http")) return raw;
    const path = raw.startsWith("/") ? raw : `/${raw}`;
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

  router.get("/", async (req, res) => {
    try {
      let rows = [];
      let sql;

      // 1️⃣ Vérifier si la colonne "is_active" existe
      const [columns] = await db.query("SHOW COLUMNS FROM services");
      const hasIsActive = columns.some((c) => c.Field === "is_active");
      const hasIcon = columns.some((c) => c.Field === "icon");
      const hasIconURL = columns.some((c) => c.Field === "icon_url");
      const hasImageURL = columns.some((c) => c.Field === "image_url");
      const hasSubtitle = columns.some((c) => c.Field === "subtitle");

      if (hasIsActive) {
        sql = `
          SELECT id, name, description, price,
                 ${hasSubtitle ? "subtitle" : "NULL"} AS subtitle,
                 ${hasImageURL ? "image_url" : "NULL"} AS image_url,
                 ${hasIconURL ? "icon_url" : "NULL"} AS icon_url,
                 ${hasIcon ? "icon" : "NULL"} AS icon
          FROM services
          WHERE is_active = 1
          ORDER BY id DESC
        `;
      } else {
        // Fallback : on prend tout si "is_active" n'existe pas
        sql = `
          SELECT id, name, description, price,
                 ${hasSubtitle ? "subtitle" : "NULL"} AS subtitle,
                 ${hasImageURL ? "image_url" : "NULL"} AS image_url,
                 ${hasIconURL ? "icon_url" : "NULL"} AS icon_url,
                 ${hasIcon ? "icon" : "NULL"} AS icon
          FROM services
          ORDER BY id DESC
        `;
      }

      [rows] = await db.query(sql);

      if (!rows || rows.length === 0) {
        return res.status(404).json({
          error: "Aucun service disponible pour le moment.",
        });
      }

      const data = rows.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        subtitle: s.subtitle || "",
        price: Number(s.price),
        image_url: normalizeServiceImage(req, s.image_url),
        ...normalizeServiceIcon(req, hasIconURL ? s.icon_url || s.icon : s.icon || s.icon_url),
      }));

      res.json({
        data,
        count: data.length,
      });
    } catch (err) {
      console.error("❌ Erreur lors du chargement des services publics :", err);
      res.status(500).json({
        error: "Erreur serveur lors de la récupération des services.",
      });
    }
  });

  return router;
};


