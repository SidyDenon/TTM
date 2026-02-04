import express from "express";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

function safeParsePermissions(raw) {
  try {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "object" && !(raw instanceof Buffer)) {
      return Object.keys(raw).filter((k) => !!raw[k]);
    }
    if (raw instanceof Buffer) {
      const str = raw.toString("utf8").trim();
      if (!str) return [];
      const parsed = JSON.parse(str);
      return safeParsePermissions(parsed);
    }
    if (typeof raw === "string") {
      const str = raw.trim();
      if (!str) return [];
      const parsed = JSON.parse(str);
      return safeParsePermissions(parsed);
    }
  } catch (err) {
    console.warn("⚠️ Permissions JSON invalide:", err.message);
  }
  return [];
}

const PERM_ALIASES = {
  can_view_dashboard: "dashboard_view",
  demandes_view: "requests_view",
  demandes_manage: "requests_manage",
  can_view_services: "services_view",
  can_manage_services: "services_manage",
  can_view_config: "config_view",
  can_manage_config: "config_manage",
  stats_view: "chart_view",
  requests_publish: "requests_manage",
  requests_assign: "requests_manage",
  requests_cancel: "requests_manage",
  requests_complete: "requests_manage",
  requests_delete: "requests_manage",
  transactions_confirm: "transactions_manage",
  withdrawals_approve: "withdrawals_manage",
  withdrawals_reject: "withdrawals_manage",
  clients_create: "clients_manage",
  clients_update: "clients_manage",
  clients_delete: "clients_manage",
  clients_reset_password: "clients_manage",
  operators_create: "operators_manage",
  operators_update: "operators_manage",
  operators_delete: "operators_manage",
  operators_reset_password: "operators_manage",
};
const canon = (p) => PERM_ALIASES[p] || p;

export default (db) => {
  let extraPermsChecked = false;
  let hasExtraPermsColumn = false;

  async function resolveExtraPermsColumn() {
    if (extraPermsChecked) return hasExtraPermsColumn;
    try {
      const [[{ cnt }]] = await db.query(
        "SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admin_users' AND COLUMN_NAME = 'extra_permissions'"
      );
      hasExtraPermsColumn = Number(cnt) > 0;
    } catch {
      hasExtraPermsColumn = false;
    }
    extraPermsChecked = true;
    return hasExtraPermsColumn;
  }

  async function handleMe(req, res) {
    try {
      const user = req.user;

      if (user.role === "admin") {
        const hasExtra = await resolveExtraPermsColumn();
        const extraSelect = hasExtra ? ", u.extra_permissions" : "";
        const [[row]] = await db.query(
          `SELECT u.id, u.name, u.email, COALESCE(u.phone, us.phone) AS phone, u.is_super${extraSelect},
                  r.name AS role_name, r.slug AS role_slug, r.permissions
           FROM admin_users u
           LEFT JOIN admin_roles r ON r.id = u.role_id
           LEFT JOIN users us ON us.id = u.id
           WHERE u.id = ?`,
          [user.id]
        );

        if (!row) return res.status(404).json({ error: "Admin introuvable" });

        const rolePerms = safeParsePermissions(row.permissions);
        const extraPerms = hasExtra ? safeParsePermissions(row.extra_permissions) : [];
        const permissions = Array.from(
          new Set([...(rolePerms || []), ...(extraPerms || [])].map(canon))
        );

        const roleLabelRaw = String(row.role_slug || row.role_name || "").toLowerCase().trim();
        const roleLabel = roleLabelRaw.replace(/[^a-z0-9]/g, "");
        const roleIsSuper = roleLabel === "superadmin";

        return res.json({
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone || null,
          role: "admin",
          role_name: row.role_name || null,
          is_super: !!row.is_super || roleIsSuper,
          permissions,
          extra_permissions: extraPerms,
        });
      }

      res.json({
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      });
    } catch (err) {
      console.error("❌ /me:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }

  router.get("/me", authMiddleware, handleMe);
  router.get("/admin/me", authMiddleware, handleMe);

  return router;
};
