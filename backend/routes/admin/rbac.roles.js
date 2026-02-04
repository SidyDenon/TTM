// routes/admin/rbac.roles.js
import express from "express";
import authMiddleware from "../../middleware/auth.js";
import { isAdmin } from "../../middleware/isAdmin.js";
import { loadAdminPermissions, checkPermission } from "../../middleware/checkPermission.js";

const router = express.Router();

// 🦸 Super admin only
const superOnly = (req, res, next) => {
  if (req.isSuperAdmin) return next();
  return res.status(403).json({ error: "SUPER_ONLY" });
};

// Slug helper
const makeSlug = (s) =>
  String(s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

// Normalise le JSON venant de MySQL (string | objet | array)
const normalizePerms = (val) => {
  if (Array.isArray(val)) return val;
  if (val && typeof val === "object") {
    return Object.keys(val).filter((k) => !!val[k]);
  }
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === "object") {
        return Object.keys(parsed).filter((k) => !!parsed[k]);
      }
      return [];
    } catch {
      return [];
    }
  }
  return [];
};

const CATALOG = [
  "rbac_users_view", "rbac_users_manage",
  "rbac_roles_view", "rbac_roles_manage",
  "clients_view", "clients_manage",
  "operators_view", "operators_manage",
  "services_view", "services_manage",
  "config_view", "config_manage",
  "transactions_view", "transactions_manage",
  "withdrawals_view", "withdrawals_manage",
  "requests_view", "requests_manage",
  "dashboard_view",
  "chart_view",
  "map_view",
  "map_fullscreen",
  "requests_refresh",
  "pricing_calculate" // optionnel : pour la route /prix si tu veux un droit séparé
];

const logAdminEvent = async (db, adminId, action, meta = {}) => {
  try {
    if (!db || !adminId) return;
    await db.query(
      "INSERT INTO admin_events (admin_id, action, meta, created_at) VALUES (?, ?, ?, NOW())",
      [adminId, action, JSON.stringify(meta)]
    );
  } catch (e) {
    console.warn("⚠️ log admin_events (rbac.roles):", e?.message || e);
  }
};


export default (db) => {
  router.use((req, _res, next) => { req.db = db; next(); });
  router.use(authMiddleware, isAdmin, loadAdminPermissions);

  // GET /api/admin/rbac/roles
  router.get("/", checkPermission("rbac_roles_view"), async (req, res) => {
    try {
      // ⚠️ entourer `system` avec des backticks
      const [rows] = await req.db.query(
        "SELECT id, name, slug, `system`, permissions, created_at FROM admin_roles ORDER BY id DESC"
      );

      const data = rows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug ?? null,
        system: Number(r.system) ? 1 : 0,
        permissions: normalizePerms(r.permissions),
        created_at: r.created_at,
      }));

      res.json({ message: "Rôles récupérés ✅", data, catalog: CATALOG });
    } catch (e) {
      console.error("❌ GET /rbac/roles:", e);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // POST /api/admin/rbac/roles  → crée un rôle
  router.post("/", superOnly, checkPermission("rbac_roles_manage"), async (req, res) => {
    try {
      const { name, slug, system = 0, permissions } = req.body || {};
      if (!name) return res.status(400).json({ error: "Nom requis" });

      const finalSlug = makeSlug(slug || name);

      const [[dup]] = await req.db.query("SELECT id FROM admin_roles WHERE slug = ?", [finalSlug]);
      if (dup) return res.status(400).json({ error: "Slug déjà utilisé" });

      const permsJson = JSON.stringify(
        Array.isArray(permissions) ? permissions : normalizePerms(permissions)
      );

      const [r] = await req.db.query(
        "INSERT INTO admin_roles (name, slug, `system`, permissions, created_at) VALUES (?, ?, ?, ?, NOW())",
        [name, finalSlug, Number(system) ? 1 : 0, permsJson]
      );

      await logAdminEvent(req.db, req.user?.id, "role_cree", {
        role_id: r.insertId,
        name,
        slug: finalSlug,
        system: Number(system) ? 1 : 0,
        permissions_count: Array.isArray(permissions) ? permissions.length : normalizePerms(permissions).length,
      });

      res.status(201).json({ message: "Rôle créé ✅", id: r.insertId });
    } catch (e) {
      console.error("❌ POST /rbac/roles:", e);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // PUT /api/admin/rbac/roles/:id  → met à jour un rôle
  router.put("/:id", superOnly, checkPermission("rbac_roles_manage"), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, slug, system, permissions } = req.body || {};

      const [[role]] = await req.db.query("SELECT * FROM admin_roles WHERE id = ?", [id]);
      if (!role) return res.status(404).json({ error: "Rôle introuvable" });

      // Slug update + collision check
      let newSlug = role.slug;
      if (slug !== undefined && slug !== null) {
        const cand = makeSlug(slug);
        if (cand !== role.slug) {
          const [[dup]] = await req.db.query("SELECT id FROM admin_roles WHERE slug = ?", [cand]);
          if (dup) return res.status(400).json({ error: "Slug déjà utilisé" });
          newSlug = cand;
        }
      }

      const newName  = name ?? role.name;
      const newSys   = (system === undefined || system === null) ? role.system : (Number(system) ? 1 : 0);
      const newPerms = JSON.stringify(
        Array.isArray(permissions) ? permissions : normalizePerms(permissions ?? role.permissions)
      );

      await req.db.query(
        "UPDATE admin_roles SET name = ?, slug = ?, `system` = ?, permissions = ?, updated_at = NOW() WHERE id = ?",
        [newName, newSlug, newSys, newPerms, id]
      );

      await logAdminEvent(req.db, req.user?.id, "role_modifie", {
        role_id: Number(id),
        name: newName,
        slug: newSlug,
        system: Number(newSys) ? 1 : 0,
        permissions_count: normalizePerms(permissions ?? role.permissions).length,
      });

      res.json({ message: "Rôle mis à jour ✅" });
    } catch (e) {
      console.error("❌ PUT /rbac/roles/:id:", e);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // DELETE /api/admin/rbac/roles/:id
  router.delete("/:id", superOnly, checkPermission("rbac_roles_manage"), async (req, res) => {
    try {
      const { id } = req.params;

      const [[role]] = await req.db.query("SELECT * FROM admin_roles WHERE id = ?", [id]);
      if (!role) return res.status(404).json({ error: "Rôle introuvable" });

      const [[used]] = await req.db.query("SELECT COUNT(*) AS n FROM admin_users WHERE role_id = ?", [id]);
      if (used.n > 0) return res.status(400).json({ error: "Rôle assigné à des utilisateurs" });

      await req.db.query("DELETE FROM admin_roles WHERE id = ?", [id]);
      await logAdminEvent(req.db, req.user?.id, "role_supprime", {
        role_id: Number(id),
        name: role.name,
        slug: role.slug,
      });
      res.json({ message: "Rôle supprimé ✅" });
    } catch (e) {
      console.error("❌ DELETE /rbac/roles/:id:", e);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  return router;
};
