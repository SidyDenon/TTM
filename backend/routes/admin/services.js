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
const AVAILABLE_ICONS_DIR = "public/service-icons";
if (!fs.existsSync(AVAILABLE_ICONS_DIR)) fs.mkdirSync(AVAILABLE_ICONS_DIR, { recursive: true });

// Détection colonnes icon_url / icon (pas de cache pour éviter les incohérences après migration)
const ensureIconColumns = async (db) => {
  try {
    const [rows] = await db.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'services'
         AND COLUMN_NAME IN ('icon_url','icon')`
    );
    const hasIconUrlColumn = rows.some((r) => r.COLUMN_NAME === "icon_url");
    const hasIconNameColumn = rows.some((r) => r.COLUMN_NAME === "icon");
    return { hasIconUrlColumn, hasIconNameColumn };
  } catch {
    return { hasIconUrlColumn: false, hasIconNameColumn: false };
  }
};

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
      return `/service-icons/${SERVICE_ICON_MAP[typeKey]}`;
    }
  }
  return null;
};

const normalizeIconUrl = (iconUrl) => {
  if (!iconUrl) return null;
  // virtual icon (with pack prefix)
  if (/^[a-z0-9]+:/i.test(iconUrl)) return iconUrl;
  if (iconUrl.startsWith("http")) return iconUrl;
  if (iconUrl.startsWith("/icons/")) {
    const fname = iconUrl.split("/").pop();
    return fname ? `/service-icons/${fname}` : null;
  }
  if (iconUrl.startsWith("/service-icons/") || iconUrl.startsWith("/uploads/")) {
    return iconUrl;
  }
  if (!iconUrl.startsWith("/")) {
    return `/service-icons/${iconUrl}`;
  }
  return iconUrl;
};

const extractIconName = (iconUrl) => {
  if (!iconUrl) return null;
  if (/^[a-z0-9]+:/i.test(iconUrl)) return iconUrl; // keep pack:name
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
  // 📋 Liste d'icônes disponibles (pour picker front)
  // ────────────────────────────────
  router.get("/icons", checkPermission("services_view"), async (_req, res) => {
    try {
      const files = fs.readdirSync(AVAILABLE_ICONS_DIR);
      const icons = files
        .filter((f) => /\.(png|jpg|jpeg|svg)$/i.test(f))
        .map((f) => ({
          name: f,
          url: `/service-icons/${f}`,
        }));
      res.json({ message: "Icônes disponibles ✅", data: icons });
    } catch (err) {
      console.error("❌ Erreur GET /services/icons:", err);
      res.status(500).json({ error: "Erreur chargement icônes" });
    }
  });

  
  router.get("/", checkPermission("services_view"), async (req, res) => {
    try {
      const { hasIconUrlColumn: iconUrlEnabled, hasIconNameColumn } = await ensureIconColumns(req.db);
      const selectFields = [
        "id",
        "name",
        "price",
        iconUrlEnabled ? "icon_url" : null,
        hasIconNameColumn ? "icon" : null,
      ]
        .filter(Boolean)
        .join(", ");
      let rows = [];
      try {
        [rows] = await req.db.query(`SELECT ${selectFields} FROM services ORDER BY id DESC`);
      } catch (e) {
        if (e?.code === "ER_NO_SUCH_TABLE") {
          rows = [];
        } else {
          throw e;
        }
      }

      const data = rows.map((s) => {
        const normUrl = iconUrlEnabled ? normalizeIconUrl(s.icon_url) : null;
        const virtualIcon =
          (hasIconNameColumn ? s.icon : null) ||
          extractIconName(s.icon_url) ||
          extractIconName(normUrl) ||
          null;
        return {
          ...s,
          icon_url: normUrl || virtualIcon || null,
          icon: virtualIcon,
        };
      });

      res.json({ message: "Liste des services ✅", data });
    } catch (err) {
      console.error("❌ Erreur GET /services:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });


  router.get("/public", async (req, res) => {
    try {
      const { hasIconUrlColumn: iconUrlEnabled, hasIconNameColumn } = await ensureIconColumns(req.db);
      const selectFields = [
        "id",
        "name",
        "price",
        iconUrlEnabled ? "icon_url" : null,
        hasIconNameColumn ? "icon" : null,
      ]
        .filter(Boolean)
        .join(", ");
      let rows = [];
      try {
        [rows] = await req.db.query(
          `SELECT ${selectFields} FROM services ORDER BY id ASC`
        );
      } catch (e) {
        if (e?.code === "ER_NO_SUCH_TABLE") {
          rows = [];
        } else {
          throw e;
        }
      }

      const data = rows.map((s) => {
        const normUrl = iconUrlEnabled ? normalizeIconUrl(s.icon_url) : null;
        const virtualIcon =
          (hasIconNameColumn ? s.icon : null) ||
          extractIconName(s.icon_url) ||
          extractIconName(normUrl) ||
          null;
        return {
          id: s.id,
          name: s.name,
          price: Number(s.price),
          icon_url: normUrl || virtualIcon || null,
          icon: virtualIcon,
        };
      });

      res.json({ message: "Services disponibles ✅", data });
    } catch (err) {
      console.error("❌ Erreur GET /services/public:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  router.post(
    "/",
    checkPermission("services_manage"),
    upload.single("icon"),
    async (req, res) => {
      try {
        const { name, price, selected_icon, icon_name } = req.body;
        if (!name || price == null)
          return res.status(400).json({ error: "Nom et prix requis" });

        const { hasIconUrlColumn: iconUrlEnabled, hasIconNameColumn } = await ensureIconColumns(req.db);
        const uploadedIcon = req.file ? req.file.filename : null;

        const pickedIcon =
          selected_icon && typeof selected_icon === "string" && selected_icon.trim()
            ? selected_icon.trim()
            : null;
        const iconName =
          icon_name && typeof icon_name === "string" && icon_name.trim()
            ? icon_name.trim()
            : null;

        const defaultIcon = resolveServiceIcon(name); // déjà /service-icons/xxx ou null
        let autoIcon = defaultIcon;
        if (uploadedIcon) {
          autoIcon = `/uploads/services/${uploadedIcon}`;
        } else if (pickedIcon) {
          if (pickedIcon.startsWith("/service-icons/") || pickedIcon.startsWith("/uploads/")) {
            autoIcon = pickedIcon;
          } else if (/^[a-z0-9]+:/i.test(pickedIcon)) {
            autoIcon = pickedIcon; // virtual icon with pack
          } else {
            const cleaned = pickedIcon.replace(/^\/+/, "");
            autoIcon = `/service-icons/${cleaned}`;
          }
        } else if (iconName) {
          autoIcon = /^[a-z0-9]+:/i.test(iconName) ? iconName : `fa:${iconName}`;
        }

        let result;
        if (iconUrlEnabled || hasIconNameColumn) {
          const fields = ["name", "price"];
          const placeholders = ["?", "?"];
          const values = [name, price];
          if (iconUrlEnabled) {
            fields.push("icon_url");
            placeholders.push("?");
            values.push(autoIcon);
          }
          if (hasIconNameColumn) {
            fields.push("icon");
            placeholders.push("?");
            values.push(iconName);
          }
          [result] = await req.db.query(
            `INSERT INTO services (${fields.join(",")}) VALUES (${placeholders.join(",")})`,
            values
          );
        } else {
          if (uploadedIcon) {
            try {
              fs.unlinkSync(path.join(uploadDir, uploadedIcon));
            } catch {}
          }
          [result] = await req.db.query(
            "INSERT INTO services (name, price) VALUES (?, ?)",
            [name, price]
          );
        }

        const newService = {
          id: result.insertId,
          name,
          price: Number(price),
          icon_url: iconUrlEnabled ? autoIcon : null,
          icon: hasIconNameColumn ? iconName : null,
        };

        res.json({ message: "Service ajouté ✅", data: newService });
      } catch (err) {
        console.error("❌ Erreur POST /services:", err);
        res.status(500).json({ error: "Erreur ajout service" });
      }
    }
  );


  router.put("/:id", checkPermission("services_manage"), async (req, res) => {
    try {
      const { price, name, selected_icon, icon_name } = req.body;
      const { hasIconUrlColumn: iconUrlEnabled, hasIconNameColumn } = await ensureIconColumns(req.db);
      if (price == null && !name && (!iconUrlEnabled || !selected_icon) && (!hasIconNameColumn || !icon_name))
        return res
          .status(400)
          .json({ error: "Au moins un champ (nom, prix ou icône) est requis" });

      const [[current]] = await req.db.query("SELECT * FROM services WHERE id = ?", [
        req.params.id,
      ]);
      if (!current)
        return res.status(404).json({ error: "Service introuvable" });

      const fields = [];
      const values = [];

      if (name) {
        fields.push("name = ?");
        values.push(name);

      }

      if (iconUrlEnabled && selected_icon && typeof selected_icon === "string" && selected_icon.trim()) {
        const sel = selected_icon.trim();
        fields.push("icon_url = ?");
        values.push(/^[a-z0-9]+:/i.test(sel) ? sel : sel);
      }
      if (hasIconNameColumn && typeof icon_name === "string") {
        const clean = icon_name.trim();
        fields.push("icon = ?");
        values.push(clean || null);
      } else if (iconUrlEnabled && typeof icon_name === "string" && icon_name.trim()) {
        const clean = icon_name.trim();
        fields.push("icon_url = ?");
        values.push(/^[a-z0-9]+:/i.test(clean) ? clean : `fa:${clean}`);
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
          icon_url: iconUrlEnabled ? updated.icon_url || null : null,
          icon: hasIconNameColumn ? updated.icon || null : null,
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
        const { hasIconUrlColumn: iconEnabled } = await ensureIconColumns(req.db);
        const [[service]] = await req.db.query(
          iconEnabled
            ? "SELECT * FROM services WHERE id = ?"
            : "SELECT id, name, price FROM services WHERE id = ?",
          [req.params.id]
        );
        if (!service)
          return res.status(404).json({ error: "Service introuvable" });

        // On supprime aussi le fichier d'icône si présent
        if (iconEnabled && service.icon_url && service.icon_url.startsWith("/uploads/services/")) {
          const rel = service.icon_url.replace("/uploads/services/", "");
          const filePath = path.join(uploadDir, rel);
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
