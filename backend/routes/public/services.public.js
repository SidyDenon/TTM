import express from "express";
import { buildUploadUrl } from "../../config/links.js";

export default (db) => {
  const router = express.Router();

  const resolveServiceIcon = (filename) => {
    if (!filename) return null;
    if (filename.startsWith("http")) return filename;
    const path = filename.startsWith("/uploads/") ? filename : `/uploads/services/${filename}`;
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

      if (hasIsActive) {
        sql = `
          SELECT id, name, description, price,
                 ${hasIconURL ? "icon_url" : hasIcon ? "icon" : "NULL"} AS icon
          FROM services
          WHERE is_active = 1
          ORDER BY id DESC
        `;
      } else {
        // Fallback : on prend tout si "is_active" n'existe pas
        sql = `
          SELECT id, name, description, price,
                 ${hasIconURL ? "icon_url" : hasIcon ? "icon" : "NULL"} AS icon
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
        price: s.price,
        icon_url: resolveServiceIcon(s.icon),
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


