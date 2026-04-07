// backend/middleware/auth.js
import jwt from "jsonwebtoken";
import db from "../config/db.js";
import { isTokenBlacklisted } from "../utils/tokenBlacklist.js";

// 🔧 Helper pour parser n'importe quel format de permissions
function normalizePermissions(raw) {
  try {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "object" && !(raw instanceof Buffer)) {
      return Object.keys(raw).filter((k) => !!raw[k]);
    }
    if (raw instanceof Buffer) {
      const str = raw.toString("utf8").trim();
      if (!str) return [];
      return normalizePermissions(JSON.parse(str));
    }
    if (typeof raw === "string") {
      const str = raw.trim();
      if (!str) return [];
      return normalizePermissions(JSON.parse(str));
    }
  } catch (err) {
    console.warn("⚠️ Permissions JSON invalide:", err.message);
  }
  return [];
}

export default async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Non autorisé" });
    }

    const token = authHeader.split(" ")[1];
    if (isTokenBlacklisted(token)) {
      return res.status(401).json({ error: "Session expirée, veuillez vous reconnecter" });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // decoded = { id, role }

    const role = String(decoded.role || "").toLowerCase();

    if (role === "admin") {
      const [[row]] = await db.query(
        `SELECT u.id, u.name, u.email, u.is_super, u.must_change_password, r.name AS role_name, r.permissions
         FROM admin_users u
         LEFT JOIN admin_roles r ON r.id = u.role_id
         WHERE u.id = ?`,
        [decoded.id]
      );

      if (!row) return res.status(401).json({ error: "Admin introuvable" });

      req.user = {
        id: row.id,
        name: row.name,
        email: row.email,
        role: "admin",
        role_name: row.role_name || null,
        is_super: !!row.is_super,
        must_change_password: !!row.must_change_password,
        permissions: normalizePermissions(row.permissions),
      };

      // Enforce password-change workflow at API level for admins.
      // This prevents bypassing the UI by entering dashboard URLs directly.
      if (req.user.must_change_password) {
        const pathname = String(req.originalUrl || "").split("?")[0];
        const method = String(req.method || "GET").toUpperCase();

        const allowed =
          method === "OPTIONS" ||
          (method === "PUT" && pathname === "/api/password") ||
          (method === "POST" && pathname === "/api/logout") ||
          (method === "GET" && (pathname === "/api/me" || pathname === "/api/admin/me"));

        if (!allowed) {
          return res.status(403).json({
            error: "MUST_CHANGE_PASSWORD",
            message: "Changement de mot de passe requis avant d'accéder au dashboard.",
            redirect_to: "/change-password",
          });
        }
      }
    } else {
      // Client ou opérateur
      const [[userRow]] = await db.query(
        "SELECT id, name, phone, role FROM users WHERE id = ?",
        [decoded.id]
      );
      if (!userRow) return res.status(401).json({ error: "Utilisateur introuvable" });

      req.user = userRow;
    }

    next();
  } catch (err) {
    console.error("❌ Erreur middleware auth:", err.message);
    res.status(401).json({ error: "Token invalide ou expiré" });
  }
}
