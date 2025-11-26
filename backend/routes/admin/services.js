// routes/admin/services.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import authMiddleware from "../../middleware/auth.js";
import {
  loadAdminPermissions,
  checkPermission,
} from "../../middleware/checkPermission.js";

const router = express.Router();

// 📁 Dossier d’upload des icônes
const uploadDir = "uploads/services";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// 🎯 Config Multer pour upload d’icônes
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

/**
 * 🔹 Normalisation d'un nom de service → clé simple
 *   "Dépannage batterie" -> "depannagebatterie"
 */
const normalizeKey = (str = "") =>
  String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // enlève les accents
    .replace(/[^a-z0-9]+/g, "")
    .trim();

/**
 * 🔹 Mapping type de service -> icône par défaut
 * ⚠️ Tu dois placer ces fichiers dans /uploads/services :
 *    - remorquage.png
 *    - depannage.png
 *    - batterie.png
 *    - pneu.png
 *    - ouverture.png
 */
const SERVICE_ICON_MAP = {
  remorquage: "remorquage.png",
  depannage: "depannage.png",
  depannagebatterie: "batterie.png",
  changementpneu: "pneu.png",
  ouvertureporte: "ouverture.png",
};

/**
 * 🔹 Choix automatique de l'icône selon le nom du service
 *    On cherche un "type" connu dans la version normalisée du nom
 */
const resolveServiceIcon = (name) => {
  const key = normalizeKey(name || "");
  for (const typeKey of Object.keys(SERVICE_ICON_MAP)) {
    if (key.includes(typeKey)) {
      return SERVICE_ICON_MAP[typeKey];
    }
  }
  return null;
};

export default (db) => {
  // Injecte la DB dans req
  router.use((req, _res, next) => {
    req.db = db;
    next();
  });

  // Auth + chargement des permissions
  router.use(authMiddleware, loadAdminPermissions);

  // ────────────────────────────────
  // 📋 Liste des services (admin)
  // ────────────────────────────────
  router.get("/", checkPermission("services_view"), async (req, res) => {
    try {
      let rows = [];
      try {
        [rows] = await req.db.query("SELECT * FROM services ORDER BY id DESC");
      } catch (e) {
        if (e?.code === "ER_NO_SUCH_TABLE") {
          rows = [];
        } else {
          throw e;
        }
      }

      const data = rows.map((s) => ({
        ...s,
        icon_url: s.icon ? `/uploads/services/${s.icon}` : null,
      }));

      res.json({ message: "Liste des services ✅", data });
    } catch (err) {
      console.error("❌ Erreur GET /services:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ────────────────────────────────
  // 📋 Liste publique (app mobile)
  // ────────────────────────────────
  router.get("/public", async (req, res) => {
    try {
      let rows = [];
      try {
        // On inclut aussi l'icône pour la mobile app
        [rows] = await req.db.query(
          "SELECT id, name, price, icon FROM services ORDER BY id ASC"
        );
      } catch (e) {
        if (e?.code === "ER_NO_SUCH_TABLE") {
          rows = [];
        } else {
          throw e;
        }
      }

      const data = rows.map((s) => ({
        id: s.id,
        name: s.name,
        price: Number(s.price),
        icon_url: s.icon ? `/uploads/services/${s.icon}` : null,
      }));

      res.json({ message: "Services disponibles ✅", data });
    } catch (err) {
      console.error("❌ Erreur GET /services/public:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ────────────────────────────────
  // ➕ Ajouter un service
  // ────────────────────────────────
  router.post(
    "/",
    checkPermission("services_manage"),
    upload.single("icon"),
    async (req, res) => {
      try {
        const { name, price } = req.body;
        if (!name || price == null)
          return res.status(400).json({ error: "Nom et prix requis" });

        // 1️⃣ Priorité à l'icône uploadée
        const uploadedIcon = req.file ? req.file.filename : null;

        // 2️⃣ Sinon, on prend une icône par défaut en fonction du type de service
        const autoIcon = uploadedIcon || resolveServiceIcon(name);

        const [result] = await req.db.query(
          "INSERT INTO services (name, price, icon) VALUES (?, ?, ?)",
          [name, price, autoIcon]
        );

        const newService = {
          id: result.insertId,
          name,
          price: Number(price),
          icon_url: autoIcon ? `/uploads/services/${autoIcon}` : null,
        };

        res.json({ message: "Service ajouté ✅", data: newService });
      } catch (err) {
        console.error("❌ Erreur POST /services:", err);
        res.status(500).json({ error: "Erreur ajout service" });
      }
    }
  );

  // ────────────────────────────────
  // ✏️ Modifier un service
  // ────────────────────────────────
  router.put("/:id", checkPermission("services_manage"), async (req, res) => {
    try {
      const { price, name } = req.body;
      if (price == null && !name)
        return res
          .status(400)
          .json({ error: "Au moins un champ (nom ou prix) est requis" });

      const [[current]] = await req.db.query(
        "SELECT * FROM services WHERE id = ?",
        [req.params.id]
      );
      if (!current)
        return res.status(404).json({ error: "Service introuvable" });

      const fields = [];
      const values = [];

      // Mise à jour du nom
      if (name) {
        fields.push("name = ?");
        values.push(name);

        // Si aucune icône existante, on peut en déduire une automatiquement
        if (!current.icon) {
          const autoIcon = resolveServiceIcon(name);
          if (autoIcon) {
            fields.push("icon = ?");
            values.push(autoIcon);
          }
        }
      }

      // Mise à jour du prix
      if (price != null) {
        fields.push("price = ?");
        values.push(price);
      }

      if (!fields.length) {
        return res
          .status(400)
          .json({ error: "Aucune modification à appliquer" });
      }

      values.push(req.params.id);

      const [result] = await req.db.query(
        `UPDATE services SET ${fields.join(", ")} WHERE id = ?`,
        values
      );

      if (result.affectedRows === 0)
        return res.status(404).json({ error: "Service introuvable" });

      // 🔁 On renvoie la version à jour
      const [[updated]] = await req.db.query(
        "SELECT * FROM services WHERE id = ?",
        [req.params.id]
      );

      res.json({
        message: "Service mis à jour ✅",
        data: {
          ...updated,
          price: Number(updated.price),
          icon_url: updated.icon ? `/uploads/services/${updated.icon}` : null,
        },
      });
    } catch (err) {
      console.error("❌ Erreur PUT /services:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ────────────────────────────────
  // 🗑️ Supprimer un service
  // ────────────────────────────────
  router.delete(
    "/:id",
    checkPermission("services_manage"),
    async (req, res) => {
      try {
        const [[service]] = await req.db.query(
          "SELECT * FROM services WHERE id = ?",
          [req.params.id]
        );
        if (!service)
          return res.status(404).json({ error: "Service introuvable" });

        // On supprime aussi le fichier d'icône si présent
        if (service.icon) {
          const filePath = path.join(uploadDir, service.icon);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        await req.db.query("DELETE FROM services WHERE id = ?", [
          req.params.id,
        ]);
        res.json({ message: "Service supprimé ✅" });
      } catch (err) {
        console.error("❌ Erreur DELETE /services:", err);
        res.status(500).json({ error: "Erreur suppression service" });
      }
    }
  );

  return router;
};
