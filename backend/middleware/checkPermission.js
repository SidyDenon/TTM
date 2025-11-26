// middleware/checkPermission.js
import globalDb from "../config/db.js";

// Alias de permissions pour aligner les slugs front/back
const PERM_ALIASES = {
  dashboard_view: "can_view_dashboard",
  demandes_view: "requests_view",
  demandes_manage: "requests_manage",
  // Alignement finance
  transactions_confirm: "transactions_manage",
  withdrawals_approve: "withdrawals_manage",
  withdrawals_reject: "withdrawals_manage",
};
const canon = (p) => PERM_ALIASES[p] || p;

/** Parse permissif & normalisation → renvoie toujours un tableau de strings */
function parsePermissions(raw) {
  try {
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw.filter(Boolean).map(String);
    }
    if (raw instanceof Buffer) {
      const str = raw.toString("utf8").trim();
      if (!str) return [];
      return parsePermissions(JSON.parse(str));
    }
    if (typeof raw === "string") {
      const str = raw.trim();
      if (!str) return [];
      return parsePermissions(JSON.parse(str));
    }
    if (typeof raw === "object") {
      // objet flags { "roles.read": true, "users.write": 1, ... }
      return Object.keys(raw).filter((k) => {
        const v = raw[k];
        if (v === true || v === 1) return true;
        if (typeof v === "string") return v === "1" || v.toLowerCase() === "true";
        return false;
      });
    }
  } catch (e) {
    console.warn("⚠️ permissions parse failed → []:", e?.message || e);
  }
  return [];
}

/**
 * Charge les permissions Admin depuis la DB.
 * - Attache:
 *   - req.isSuperAdmin : boolean
 *   - req.adminPerms   : Set<string>
 *   - req.can(perm)    : boolean
 *   - req.canAll(perms): boolean
 * - Ne jette jamais: en cas d’erreur → super=false, perms=Set()
 */
// middleware/checkPermission.js
// middleware/checkPermission.js

export async function loadAdminPermissions(req, res, next) {
  try {
    // Si pas admin → aucune permission
    if (!req.user || req.user.role !== "admin") {
      req.adminPermissions = [];
      req.adminPerms = new Set();
      req.isSuperAdmin = false;
      return next();
    }

    // NOTE: on NE sélectionne PAS u.extra_permissions (colonne absente chez toi)
    const [[row]] = await req.db.query(
      `
      SELECT u.id, u.is_super, u.role_id,
             r.permissions AS role_permissions
      FROM admin_users u
      LEFT JOIN admin_roles r ON r.id = u.role_id
      WHERE u.id = ?
    `,
      [req.user.id]
    );

    if (!row) {
      req.adminPermissions = [];
      req.isSuperAdmin = false;
      return next();
    }

    const toArray = (raw) => {
      try {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        if (raw instanceof Buffer) {
          const str = raw.toString("utf8").trim();
          if (!str) return [];
          return toArray(JSON.parse(str));
        }
        if (typeof raw === "string") {
          const str = raw.trim();
          if (!str) return [];
          return toArray(JSON.parse(str));
        }
        if (typeof raw === "object") {
          // si jamais un objet {perm:true}
          return Object.keys(raw).filter((k) => !!raw[k]);
        }
      } catch {
        return [];
      }
      return [];
    };

    const rolePerms = toArray(row.role_permissions).map(canon);
    // pas d'extraPerms → []
    req.adminPermissions = Array.from(new Set(rolePerms));
    req.adminPerms = new Set(req.adminPermissions);
    req.isSuperAdmin = !!row.is_super;

    next();
  } catch (e) {
    console.error("loadAdminPermissions error:", e);
    req.adminPermissions = [];
    req.adminPerms = new Set();
    req.isSuperAdmin = false;
    next();
  }
}

export const checkPermission = (perm) => (req, res, next) => {
  if (req.isSuperAdmin) return next();
  if (!perm) return next();
  const key = canon(perm);
  if (req.adminPerms instanceof Set && req.adminPerms.has(key)) return next();
  return res.status(403).json({ error: "FORBIDDEN", need: key });
};



/** Au moins UNE permission requise */
export function requireAny(keys = []) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Accès admin requis" });
    }
    if (req.isSuperAdmin) return next();
    const ok = (keys || []).map(canon).some((k) => req.adminPerms.has(k));
    if (ok) return next();
    return res.status(403).json({ error: "Permission refusée (any)", missing_any_of: keys });
  };
}

/** TOUTES les permissions requises */
export function requireAll(keys = []) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Accès admin requis" });
    }
    if (req.isSuperAdmin) return next();
    const ok = (keys || []).map(canon).every((k) => req.adminPerms.has(k));
    if (ok) return next();
    return res.status(403).json({ error: "Permission refusée (all)", missing_all_of: keys });
  };
}
