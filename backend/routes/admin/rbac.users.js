// routes/admin/rbac.users.js
import express from "express";
import authMiddleware from "../../middleware/auth.js";
import { isAdmin } from "../../middleware/isAdmin.js";
import { loadAdminPermissions, checkPermission } from "../../middleware/checkPermission.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendMail } from "../../utils/mailer.js";

const router = express.Router();

// 🦸 super admins only
const superOnly = (req, res, next) => {
  if (req.isSuperAdmin) return next();
  return res.status(403).json({ error: "SUPER_ONLY" });
};

// parse JSON safely to array
const safeJson = (str, fallback = []) => {
  try {
    if (!str || typeof str !== "string") return fallback;
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

export default (db) => {
  router.use((req, _res, next) => { req.db = db; next(); });
  router.use(authMiddleware, isAdmin, loadAdminPermissions);

  // 📋 Lister tous les administrateurs (1 rôle max)
  router.get("/", checkPermission("rbac_users_view"), async (req, res) => {
    try {
      const [rows] = await req.db.query(`
        SELECT 
          u.id, u.name, u.email,
          u.phone,
          u.is_super,
          u.role_id,
          r.name AS role_name,
          r.permissions
        FROM admin_users u
        LEFT JOIN admin_roles r ON r.id = u.role_id
        ORDER BY u.id DESC
      `);

      const data = rows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone ?? null,
        is_super: !!u.is_super,
        role_id: u.role_id || null,
        role_name: u.role_name || null,
        // pour compat front si tu veux aussi "roles: [...]"
        roles: u.role_id
          ? [{ id: u.role_id, name: u.role_name, permissions: safeJson(u.permissions, []) }]
          : [],
      }));

      res.json({ message: "Admins récupérés ✅", data });
    } catch (e) {
      console.error("❌ GET /rbac/users:", e);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

 // ➕ Créer un administrateur (superOnly) : mdp aléatoire + hash + email + must_change_password
router.post("/", superOnly, checkPermission("rbac_users_manage"), async (req, res) => {
  const conn = await req.db.getConnection(); // mysql2/promise pool
  try {
    const { name, email, phone, role_id, permissions = [] } = req.body || {};
    if (!name || !email) return res.status(400).json({ error: "Nom et email requis" });

    const [existing] = await req.db.query("SELECT id FROM admin_users WHERE email = ?", [email]);
    if (existing.length > 0) return res.status(400).json({ error: "Email déjà utilisé" });

    // Normaliser permissions (tableau)
    const perms = Array.isArray(permissions) ? permissions : [];
    await conn.beginTransaction();

    // Rôle cible : soit role_id, soit on fabrique un rôle custom si des perms sont fournies
    let targetRoleId = role_id || null;

    if (perms.length) {
      if (targetRoleId) {
        // Si un rôle est fourni mais ne correspond pas exactement aux perms cochées → créer un rôle custom
        const [[baseRole]] = await conn.query("SELECT id, permissions FROM admin_roles WHERE id = ?", [targetRoleId]);
        if (!baseRole) {
          await conn.rollback();
          return res.status(404).json({ error: "Rôle introuvable" });
        }
        const basePerms = (() => { try { const p = JSON.parse(baseRole.permissions); return Array.isArray(p) ? p : []; } catch { return []; }})();
        const same = basePerms.length === perms.length && basePerms.every(p => perms.includes(p));
        if (!same) {
          const customName = `Personnalisé - ${name}`;
          const customSlug = `personnalise_${Date.now()}`;
          const [insRole] = await conn.query(
  "INSERT INTO admin_roles (name, slug, `system`, permissions, created_at) VALUES (?, ?, 0, ?, NOW())",
  [customName, customSlug, JSON.stringify(perms)]
);

          targetRoleId = insRole.insertId;
        }
      } else {
        // Pas de role_id → on crée un rôle custom directement
        const customName = `Personnalisé - ${name}`;
        const customSlug = `personnalise_${Date.now()}`;
        const [insRole] = await conn.query(
  "INSERT INTO admin_roles (name, slug, `system`, permissions, created_at) VALUES (?, ?, 0, ?, NOW())",
  [customName, customSlug, JSON.stringify(perms)]
);

        targetRoleId = insRole.insertId;
      }
    } else if (targetRoleId) {
      // Rien à faire : on assignera ce rôle
      const [[role]] = await conn.query("SELECT id FROM admin_roles WHERE id = ?", [targetRoleId]);
      if (!role) {
        await conn.rollback();
        return res.status(404).json({ error: "Rôle introuvable" });
      }
    } else {
      await conn.rollback();
      return res.status(400).json({ error: "role_id ou permissions requis" });
    }

    // Générer et hasher le mot de passe
    const tempPassword = crypto.randomBytes(5).toString("base64url"); // ~8-9 chars
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Créer l’admin
    const [r] = await conn.query(
      `INSERT INTO admin_users (name, email, phone, password_hash, is_super, role_id, must_change_password, created_at)
       VALUES (?, ?, ?, ?, 0, ?, 1, NOW())`,
      [name, email, phone || null, passwordHash, targetRoleId]
    );

    await conn.commit();

    // Envoyer l’email (on ne fait pas échouer si ça plante)
    try {
      const appName  = process.env.APP_NAME || "Admin";
      const loginUrl = process.env.ADMIN_LOGIN_URL || "https://example.com/admin/login";
      await sendMail(
        email,
        `Votre accès administrateur • ${appName}`,
        `Bonjour ${name || ""},
Un compte administrateur a été créé pour vous.
Identifiant : ${email}
Mot de passe provisoire : ${tempPassword}
Connexion : ${loginUrl}
Important : changez votre mot de passe à la première connexion.`,
        `
          <p>Bonjour ${name || ""},</p>
          <p>Un compte administrateur a été créé pour vous.</p>
          <p><b>Identifiant :</b> ${email}<br/><b>Mot de passe provisoire :</b> ${tempPassword}</p>
          <p>Connexion : <a href="${loginUrl}">${loginUrl}</a></p>
          <p><b>Important :</b> changez votre mot de passe à la première connexion.</p>
        `
      );
    } catch (mailErr) {
      console.error("✉️  Envoi email échoué:", mailErr);
    }

    return res.status(201).json({
      message: "Administrateur créé ✅",
      data: { id: r.insertId },
      temp_password: tempPassword,
    });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    console.error("❌ POST /rbac/users:", e);
    res.status(500).json({ error: "Erreur serveur" });
  } finally {
    try { conn.release(); } catch {}
  }
});


  // 🔁 Assigner / changer un rôle
  router.put("/:id/role", superOnly, checkPermission("rbac_users_manage"), async (req, res) => {
    try {
      const { id } = req.params;
      const { role_id } = req.body;
      if (!role_id) return res.status(400).json({ error: "role_id requis" });

      const [[admin]] = await req.db.query("SELECT id FROM admin_users WHERE id = ?", [id]);
      if (!admin) return res.status(404).json({ error: "Admin introuvable" });

      const [[role]] = await req.db.query("SELECT id FROM admin_roles WHERE id = ?", [role_id]);
      if (!role) return res.status(404).json({ error: "Rôle introuvable" });

      // pas d'updated_at si la colonne n'existe pas
      await req.db.query("UPDATE admin_users SET role_id = ? WHERE id = ?", [role_id, id]);

      res.json({ message: "Rôle assigné ✅" });
    } catch (e) {
      console.error("❌ PUT /rbac/users/:id/role:", e);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // 👑 Toggle superadmin
  router.patch("/:id/super", superOnly, checkPermission("rbac_users_manage"), async (req, res) => {
    try {
      const { id } = req.params;

      const [[admin]] = await req.db.query("SELECT id, is_super FROM admin_users WHERE id = ?", [id]);
      if (!admin) return res.status(404).json({ error: "Admin introuvable" });

      const newStatus = admin.is_super ? 0 : 1;
      await req.db.query("UPDATE admin_users SET is_super = ? WHERE id = ?", [newStatus, id]);

      res.json({ message: newStatus ? "Superadmin attribué ✅" : "Superadmin retiré ✅" });
    } catch (e) {
      console.error("❌ PATCH /rbac/users/:id/super:", e);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // 🗑️ Supprimer un administrateur
  router.delete("/:id", superOnly, checkPermission("rbac_users_manage"), async (req, res) => {
    try {
      const { id } = req.params;

      const [[admin]] = await req.db.query("SELECT id, is_super FROM admin_users WHERE id = ?", [id]);
      if (!admin) return res.status(404).json({ error: "Admin introuvable" });
      if (admin.is_super) return res.status(400).json({ error: "Impossible de supprimer un superadmin" });

      await req.db.query("DELETE FROM admin_users WHERE id = ?", [id]);
      res.json({ message: "Administrateur supprimé ✅" });
    } catch (e) {
      console.error("❌ DELETE /rbac/users/:id:", e);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  return router;
};
