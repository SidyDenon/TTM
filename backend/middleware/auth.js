// backend/middleware/auth.js
import jwt from "jsonwebtoken";
import db from "../config/db.js";

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
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // decoded = { id, role }

    const role = String(decoded.role || "").toLowerCase();

    if (role === "admin") {
      const [[row]] = await db.query(
        `SELECT u.id, u.name, u.email, u.is_super, r.name AS role_name, r.permissions
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
        permissions: normalizePermissions(row.permissions),
      };
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
