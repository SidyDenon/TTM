// routes/admin/rbac.users.js
import express from "express";
import authMiddleware from "../../middleware/auth.js";
import { isAdmin } from "../../middleware/isAdmin.js";
import { loadAdminPermissions, checkPermission } from "../../middleware/checkPermission.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendMail } from "../../utils/mailer.js";

const router = express.Router();
const columnCache = new Map();

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

const columnExists = async (db, table, column) => {
  const key = `${table}:${column}`;
  if (columnCache.has(key)) return columnCache.get(key);
  const [[{ cnt }]] = await db.query(
    "SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    [table, column]
  );
  const exists = Number(cnt) > 0;
  columnCache.set(key, exists);
  return exists;
};

const resolveAdminBlockColumn = async (db) => {
  if (await columnExists(db, "admin_users", "is_blocked")) return "is_blocked";
  if (await columnExists(db, "admin_users", "blocked")) return "blocked";
  return null;
};

const uniqueRoleName = async (conn, baseName) => {
  const trimmed = (baseName || "Personnalisé").trim();
  let name = trimmed;
  let i = 1;
  // Try base, then add suffix if needed
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const [[row]] = await conn.query(
      "SELECT COUNT(*) AS cnt FROM admin_roles WHERE name = ?",
      [name]
    );
    if (Number(row?.cnt || 0) === 0) return name;
    i += 1;
    name = `${trimmed} (${i})`;
  }
};

const normalizeRoleLabel = (row) => {
  const raw = String(row?.slug || row?.name || "").toLowerCase().trim();
  return raw.replace(/[^a-z0-9]/g, "");
};

const isSuperRole = (row) => normalizeRoleLabel(row) === "superadmin";

const getSuperRoleId = async (conn) => {
  const [rows] = await conn.query(
    "SELECT id, name, slug FROM admin_roles"
  );
  const match = rows.find((r) => isSuperRole(r));
  return match ? match.id : null;
};

export default (db) => {
  router.use((req, _res, next) => { req.db = db; next(); });
  router.use(authMiddleware, isAdmin, loadAdminPermissions);

  // 📋 Lister tous les administrateurs (1 rôle max)
  router.get("/", checkPermission("rbac_users_view"), async (req, res) => {
    try {
      const blockCol = await resolveAdminBlockColumn(req.db);
      const selectCols = [
        "u.id",
        "u.name",
        "u.email",
        "COALESCE(u.phone, us.phone) AS phone",
        "u.is_super",
        "u.role_id",
        "r.name AS role_name",
        "r.permissions"
      ];
      if (blockCol) {
        selectCols.push(`u.${blockCol} AS is_blocked`);
      }
      const [rows] = await req.db.query(`
        SELECT 
          ${selectCols.join(", ")},
          r.slug AS role_slug
        FROM admin_users u
        LEFT JOIN admin_roles r ON r.id = u.role_id
        LEFT JOIN users us ON us.id = u.id
        ORDER BY u.id DESC
      `);

      const data = rows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone ?? null,
        is_super: (() => {
          const roleLabelRaw = String(u.role_slug || u.role_name || "").toLowerCase().trim();
          const roleLabel = roleLabelRaw.replace(/[^a-z0-9]/g, "");
          const roleIsSuper = roleLabel === "superadmin";
          return !!u.is_super || roleIsSuper;
        })(),
        role_id: u.role_id || null,
        role_name: u.role_name || null,
        is_blocked: blockCol ? !!u.is_blocked : null,
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
        const [[baseRole]] = await conn.query("SELECT id, name, slug, permissions FROM admin_roles WHERE id = ?", [targetRoleId]);
        if (!baseRole) {
          await conn.rollback();
          return res.status(404).json({ error: "Rôle introuvable" });
        }
        if (isSuperRole(baseRole)) {
          // Superadmin : on garde le rôle et on ignore les perms personnalisées
        } else {
        const basePerms = (() => { try { const p = JSON.parse(baseRole.permissions); return Array.isArray(p) ? p : []; } catch { return []; }})();
        const same = basePerms.length === perms.length && basePerms.every(p => perms.includes(p));
        if (!same) {
          const customName = await uniqueRoleName(conn, `Personnalisé - ${name}`);
          const customSlug = `personnalise_${Date.now()}`;
          const [insRole] = await conn.query(
  "INSERT INTO admin_roles (name, slug, `system`, permissions, created_at) VALUES (?, ?, 0, ?, NOW())",
  [customName, customSlug, JSON.stringify(perms)]
);

          targetRoleId = insRole.insertId;
        }
        }
      } else {
        // Pas de role_id → on crée un rôle custom directement
        const customName = await uniqueRoleName(conn, `Personnalisé - ${name}`);
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

    if (targetRoleId) {
      const [[roleRow]] = await conn.query("SELECT id, name, slug FROM admin_roles WHERE id = ?", [targetRoleId]);
      if (roleRow && isSuperRole(roleRow)) {
        await conn.query("UPDATE admin_users SET is_super = 1 WHERE id = ?", [r.insertId]);
      }
    }

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

      const [[role]] = await req.db.query("SELECT id, name, slug FROM admin_roles WHERE id = ?", [role_id]);
      if (!role) return res.status(404).json({ error: "Rôle introuvable" });

      // pas d'updated_at si la colonne n'existe pas
      await req.db.query("UPDATE admin_users SET role_id = ? WHERE id = ?", [role_id, id]);
      if (isSuperRole(role)) {
        await req.db.query("UPDATE admin_users SET is_super = 1 WHERE id = ?", [id]);
      }

      res.json({ message: "Rôle assigné ✅" });
    } catch (e) {
      console.error("❌ PUT /rbac/users/:id/role:", e);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ✏️ Modifier un administrateur (nom/email/téléphone)
  router.patch("/:id", superOnly, checkPermission("rbac_users_manage"), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, email, phone } = req.body || {};

      const [[admin]] = await req.db.query(
        "SELECT id, name, email, phone FROM admin_users WHERE id = ?",
        [id]
      );
      if (!admin) return res.status(404).json({ error: "Admin introuvable" });

      const nextName = ((name ?? admin.name) || "").trim();
      const nextEmail = ((email ?? admin.email) || "").trim();
      const nextPhone = phone === "" ? null : (phone ?? admin.phone ?? null);

      if (!nextName || !nextEmail) {
        return res.status(400).json({ error: "Nom et email requis" });
      }

      if (nextEmail !== admin.email) {
        const [existing] = await req.db.query(
          "SELECT id FROM admin_users WHERE email = ? AND id <> ?",
          [nextEmail, id]
        );
        if (existing.length > 0) {
          return res.status(400).json({ error: "Email déjà utilisé" });
        }
      }

      await req.db.query(
        "UPDATE admin_users SET name = ?, email = ?, phone = ?, updated_at = NOW() WHERE id = ?",
        [nextName, nextEmail, nextPhone, id]
      );
      await req.db.query(
        "UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ? AND role = 'admin'",
        [nextName, nextEmail, nextPhone, id]
      );

      const [[row]] = await req.db.query(
        `SELECT u.id, u.name, u.email, COALESCE(u.phone, us.phone) AS phone, u.is_super, u.role_id,
                r.name AS role_name, r.permissions
         FROM admin_users u
         LEFT JOIN admin_roles r ON r.id = u.role_id
         LEFT JOIN users us ON us.id = u.id
         WHERE u.id = ?`,
        [id]
      );

      res.json({
        message: "Admin mis à jour ✅",
        data: {
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone ?? null,
          is_super: !!row.is_super,
          role_id: row.role_id || null,
          role_name: row.role_name || null,
          roles: row.role_id
            ? [{ id: row.role_id, name: row.role_name, permissions: safeJson(row.permissions, []) }]
            : [],
        },
      });
    } catch (e) {
      console.error("❌ PATCH /rbac/users/:id:", e);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // 🔒 Bloquer / débloquer un admin
  router.patch("/:id/block", superOnly, checkPermission("rbac_users_manage"), async (req, res) => {
    try {
      const { id } = req.params;
      const { blocked } = req.body || {};
      const blockCol = await resolveAdminBlockColumn(req.db);
      if (!blockCol) return res.status(400).json({ error: "BLOCK_UNSUPPORTED" });

      const [[admin]] = await req.db.query("SELECT id, is_super FROM admin_users WHERE id = ?", [id]);
      if (!admin) return res.status(404).json({ error: "Admin introuvable" });
      if (admin.is_super) return res.status(400).json({ error: "Impossible de bloquer un superadmin" });

      await req.db.query(
        `UPDATE admin_users SET ${blockCol} = ? WHERE id = ?`,
        [blocked ? 1 : 0, id]
      );
      res.json({
        message: blocked ? "Admin bloqué ✅" : "Admin débloqué ✅",
        data: { id: Number(id), is_blocked: !!blocked },
      });
    } catch (e) {
      console.error("❌ PATCH /rbac/users/:id/block:", e);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // 🔄 Réinitialiser mot de passe admin
  router.post("/:id/reset-password", superOnly, checkPermission("rbac_users_manage"), async (req, res) => {
    try {
      const { id } = req.params;
      const [[admin]] = await req.db.query(
        "SELECT id, name, email FROM admin_users WHERE id = ?",
        [id]
      );
      if (!admin) return res.status(404).json({ error: "Admin introuvable" });

      const nouveauMdp = crypto.randomBytes(6).toString("base64url");
      const hash = await bcrypt.hash(nouveauMdp, 10);

      await req.db.query(
        "UPDATE admin_users SET password_hash = ?, must_change_password = 1, updated_at = NOW() WHERE id = ?",
        [hash, id]
      );

      if (admin.email) {
        try {
          await sendMail(
            admin.email,
            "🔑 Réinitialisation du mot de passe TTM",
            `Bonjour ${admin.name || ""},\n\nVotre mot de passe administrateur a été réinitialisé.\n\n🔑 Nouveau mot de passe : ${nouveauMdp}\n\n⚠️ Merci de le modifier lors de votre prochaine connexion.\n\n— L'équipe TTM`
          );
        } catch (mailErr) {
          console.warn("⚠️ Erreur email:", mailErr.message);
        }
      }

      res.json({
        message: admin.email
          ? "Mot de passe réinitialisé et envoyé par email ✅"
          : "Mot de passe réinitialisé ✅ (pas d’email trouvé)",
        motDePasse: nouveauMdp,
      });
    } catch (e) {
      console.error("❌ POST /rbac/users/:id/reset-password:", e);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // 🧩 Mettre à jour les permissions d'un admin (superOnly)
  router.patch("/:id/permissions", superOnly, checkPermission("rbac_users_manage"), async (req, res) => {
    const conn = await req.db.getConnection();
    try {
      const { id } = req.params;
      const { role_id, permissions = [] } = req.body || {};
      const perms = Array.isArray(permissions) ? permissions : [];

      const [[admin]] = await conn.query("SELECT id, name, role_id FROM admin_users WHERE id = ?", [id]);
      if (!admin) return res.status(404).json({ error: "Admin introuvable" });

      await conn.beginTransaction();

      // Rôle cible : soit role_id, soit on fabrique un rôle custom si des perms sont fournies
      let targetRoleId = role_id || null;

      if (perms.length) {
        if (targetRoleId) {
          const [[baseRole]] = await conn.query("SELECT id, name, slug, permissions FROM admin_roles WHERE id = ?", [targetRoleId]);
          if (!baseRole) {
            await conn.rollback();
            return res.status(404).json({ error: "Rôle introuvable" });
          }
          if (isSuperRole(baseRole)) {
            // Superadmin : on garde le rôle et on ignore les perms personnalisées
          } else {
          const basePerms = safeJson(baseRole.permissions, []);
          const same = basePerms.length === perms.length && basePerms.every(p => perms.includes(p));
          if (!same) {
            const customName = await uniqueRoleName(conn, `Personnalisé - ${admin.name || "Admin"}`);
            const customSlug = `personnalise_${Date.now()}`;
            const [insRole] = await conn.query(
              "INSERT INTO admin_roles (name, slug, `system`, permissions, created_at) VALUES (?, ?, 0, ?, NOW())",
              [customName, customSlug, JSON.stringify(perms)]
            );
            targetRoleId = insRole.insertId;
          }
          }
        } else {
          const customName = await uniqueRoleName(conn, `Personnalisé - ${admin.name || "Admin"}`);
          const customSlug = `personnalise_${Date.now()}`;
          const [insRole] = await conn.query(
            "INSERT INTO admin_roles (name, slug, `system`, permissions, created_at) VALUES (?, ?, 0, ?, NOW())",
            [customName, customSlug, JSON.stringify(perms)]
          );
          targetRoleId = insRole.insertId;
        }
      } else if (targetRoleId) {
        const [[role]] = await conn.query("SELECT id FROM admin_roles WHERE id = ?", [targetRoleId]);
        if (!role) {
          await conn.rollback();
          return res.status(404).json({ error: "Rôle introuvable" });
        }
      } else {
        await conn.rollback();
        return res.status(400).json({ error: "role_id ou permissions requis" });
      }

      await conn.query("UPDATE admin_users SET role_id = ? WHERE id = ?", [targetRoleId, id]);
      if (targetRoleId) {
        const [[roleRow]] = await conn.query("SELECT id, name, slug FROM admin_roles WHERE id = ?", [targetRoleId]);
        if (roleRow && isSuperRole(roleRow)) {
          await conn.query("UPDATE admin_users SET is_super = 1 WHERE id = ?", [id]);
        }
      }
      await conn.commit();

      const [[row]] = await conn.query(
        `SELECT u.id, u.role_id, r.name AS role_name, r.permissions
         FROM admin_users u
         LEFT JOIN admin_roles r ON r.id = u.role_id
         WHERE u.id = ?`,
        [id]
      );
      const rolePerms = safeJson(row?.permissions, []);
      res.json({
        message: "Permissions mises à jour ✅",
        data: {
          id: row.id,
          role_id: row.role_id || null,
          role_name: row.role_name || null,
          roles: row.role_id ? [{ id: row.role_id, name: row.role_name, permissions: rolePerms }] : [],
        },
      });
    } catch (e) {
      try { await conn.rollback(); } catch {}
      console.error("❌ PATCH /rbac/users/:id/permissions:", e);
      res.status(500).json({ error: "Erreur serveur" });
    } finally {
      try { conn.release(); } catch {}
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
      if (Number(id) === Number(req.user?.id)) {
        return res.status(400).json({ error: "Impossible de supprimer son propre compte" });
      }

      await req.db.query("DELETE FROM admin_users WHERE id = ?", [id]);
      res.json({ message: "Administrateur supprimé ✅" });
    } catch (e) {
      console.error("❌ DELETE /rbac/users/:id:", e);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // 📜 Historique d'activité admin (superadmin uniquement)
  router.get("/:id/events", superOnly, async (req, res) => {
    try {
      const requesterId = Number(req.user?.id);
      const targetId = Number(req.params.id);
      if (!Number.isFinite(targetId)) {
        return res.status(400).json({ error: "ID invalide" });
      }

      const [[requester]] = await req.db.query(
        `SELECT u.is_super
         FROM admin_users u
         WHERE u.id = ?`,
        [requesterId]
      );
      if (!requester?.is_super) {
        return res.status(403).json({ error: "SUPER_ONLY" });
      }

      const [rows] = await req.db.query(
        `SELECT id, admin_id, action, meta, created_at
         FROM admin_events
         WHERE admin_id = ?
           AND action <> 'admin_request'
         ORDER BY created_at DESC
         LIMIT 200`,
        [targetId]
      );

      const data = rows.map((e) => {
        let meta = null;
        try {
          meta = e.meta ? JSON.parse(e.meta) : null;
        } catch {
          meta = e.meta || null;
        }
        return { ...e, meta };
      });

      res.json({ data });
    } catch (e) {
      console.error("❌ GET /rbac/users/:id/events:", e);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // 🦸 Forcer superadmin (role + is_super)
  router.patch("/:id/force-super", superOnly, checkPermission("rbac_users_manage"), async (req, res) => {
    const conn = await req.db.getConnection();
    try {
      const { id } = req.params;
      const [[admin]] = await conn.query("SELECT id FROM admin_users WHERE id = ?", [id]);
      if (!admin) return res.status(404).json({ error: "Admin introuvable" });

      const superRoleId = await getSuperRoleId(conn);
      if (!superRoleId) {
        return res.status(400).json({ error: "ROLE_SUPERADMIN_INTROUVABLE" });
      }

      await conn.query("UPDATE admin_users SET role_id = ?, is_super = 1 WHERE id = ?", [superRoleId, id]);

      const [[row]] = await conn.query(
        `SELECT u.id, u.name, u.email, COALESCE(u.phone, us.phone) AS phone, u.is_super, u.role_id,
                r.name AS role_name, r.permissions
         FROM admin_users u
         LEFT JOIN admin_roles r ON r.id = u.role_id
         LEFT JOIN users us ON us.id = u.id
         WHERE u.id = ?`,
        [id]
      );

      res.json({
        message: "Superadmin forcé ✅",
        data: {
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone ?? null,
          is_super: !!row.is_super,
          role_id: row.role_id || null,
          role_name: row.role_name || null,
          roles: row.role_id
            ? [{ id: row.role_id, name: row.role_name, permissions: safeJson(row.permissions, []) }]
            : [],
        },
      });
    } catch (e) {
      console.error("❌ PATCH /rbac/users/:id/force-super:", e);
      res.status(500).json({ error: "Erreur serveur" });
    } finally {
      try { conn.release(); } catch {}
    }
  });

  return router;
};
