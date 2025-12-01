import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import twilio from "twilio";
import authMiddleware from "../middleware/auth.js";
import { getSchemaColumns } from "../utils/schema.js";

export default (db) => {
  const router = express.Router();

  const canonicalRole = (role) => {
    const r = String(role || "").toLowerCase();
    if (r === 'operateur' || r === 'opérateur') return 'operator';
    if (r === 'administrateur') return 'admin';
    return r;
  };

  // ⚡ Injecter db
  router.use((req, res, next) => {
    req.db = db;
    next();
  });

  const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});


  // ⚡ Config Twilio
  const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

  // 🔑 Enregistrement utilisateur
  router.post("/register", async (req, res) => {
    try {
      const { name, phone, password, email } = req.body;
      if (!name || !phone || !password) {
        return res.status(400).json({ error: "Tous les champs sont obligatoires" });
      }

      const [rows] = await req.db.query("SELECT * FROM users WHERE phone = ?", [phone]);
      if (rows.length > 0) {
        return res.status(400).json({ error: "Numéro déjà utilisé" });
      }

      const hashed = await bcrypt.hash(password, 10);

      const [result] = await req.db.query(
        "INSERT INTO users (name, phone, email, password, role, must_change_password) VALUES (?, ?, ?, ?, 'client', 0)",
        [name, phone, email || null, hashed]
      );

      res.status(201).json({
        message: "Compte créé avec succès ✅",
        user: {
          id: result.insertId,
          name,
          phone,
          email,
          role: "client",
          must_change_password: 0,
        },
      });
    } catch (err) {
      console.error("❌ Erreur register:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

// 🔑 Connexion
// routes/auth.js (ou fichier équivalent)
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) {
      return res.status(400).json({ error: "Identifiant et mot de passe requis" });
    }

    const isEmail = identifier.includes("@");

    // ---------- 1) ESSAI DANS users ----------
    let [rows] = await req.db.query(
      isEmail ? "SELECT id, name, phone, email, role, password, must_change_password FROM users WHERE email = ?"
              : "SELECT id, name, phone, email, role, password, must_change_password FROM users WHERE phone = ?",
      [identifier]
    );

    const candidates = [...rows];

    // ---------- 2) FALLBACK ADMIN PAR EMAIL ----------
    if (isEmail) {
      const [admins] = await req.db.query(
        // password_hash AS password => on réutilise le même chemin de comparaison
        "SELECT id, name, email, NULL as phone, 'admin' AS role, password_hash AS password, must_change_password \
         FROM admin_users WHERE email = ?",
        [identifier]
      );
      candidates.push(...admins);
    }

    // ---------- 3) FALLBACK ADMIN PAR TÉLÉPHONE ----------
    if (!isEmail) {
      // variantes 223
      const raw = String(identifier).replace(/\s+/g, "");
      const variants = Array.from(new Set([
        raw,
        raw.replace(/^\+/, ""),
        raw.replace(/^\+?223/, ""),
        `+223${raw.replace(/^\+?223/, "")}`
      ]));

      try {
        const placeholders = variants.map(() => "?").join(",");
        const [adminsByPhone] = await req.db.query(
          `SELECT id, name, email, phone, 'admin' AS role, password_hash AS password, must_change_password
           FROM admin_users
           WHERE phone IN (${placeholders})`,
          variants
        );
        candidates.push(...adminsByPhone);
      } catch (e) {
        // si la colonne phone n’existe pas, on ignore
        if (e?.code !== "ER_BAD_FIELD_ERROR") throw e;
      }
    }

    if (candidates.length === 0) {
      return res.status(400).json({ error: "Utilisateur introuvable" });
    }

    let userMatch = null;
    for (const cand of candidates) {
      const ok = await bcrypt.compare(password, cand.password || "");
      if (ok) {
        userMatch = cand;
        break;
      }
    }

    if (!userMatch) {
      return res.status(400).json({ error: "Mot de passe incorrect" });
    }

    // 🚫 Blocage opérateur (dispo = 0)
    if (canonicalRole(userMatch.role) === "operator") {
      try {
        const { operatorDispo } = await getSchemaColumns(req.db);
        if (operatorDispo) {
          const [[opRow]] = await req.db.query(
            `SELECT ${operatorDispo} AS dispo FROM operators WHERE user_id = ? LIMIT 1`,
            [userMatch.id]
          );
          if (opRow && Number(opRow.dispo) === 0) {
            return res.status(403).json({ error: "Compte opérateur bloqué. Contactez un administrateur." });
          }
        }
      } catch (e) {
        console.warn("⚠️ Vérification blocage opérateur échouée:", e?.message || e);
      }
    }

    const u = userMatch;

    const token = jwt.sign(
      { id: u.id, role: (String(u.role || "").toLowerCase() === "administrateur" ? "admin" : String(u.role || "").toLowerCase()) || "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      message: "Connexion réussie ✅",
      token,
      user: {
        id: u.id,
        name: u.name,
        phone: u.phone || null,
        email: u.email || null,
        role: (String(u.role || "").toLowerCase() === "administrateur" ? "admin" : String(u.role || "").toLowerCase()) || "admin",
        must_change_password: u.must_change_password ? 1 : 0,
      },
    });
  } catch (err) {
    console.error("❌ Erreur login:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});


  // 🔑 Mot de passe oublié (OTP mail / SMS)
  router.post("/forgot-password", async (req, res) => {
    try {
      const { identifier } = req.body;
      if (!identifier) {
        return res.status(400).json({ error: "Identifiant requis" });
      }

      let query, params;
      if (identifier.includes("@")) {
        query = "SELECT * FROM users WHERE email = ?";
        params = [identifier];
      } else {
        query = "SELECT * FROM users WHERE phone = ?";
        params = [identifier];
      }

      const [rows] = await req.db.query(query, params);
      if (rows.length === 0) {
        return res.status(400).json({ error: "Utilisateur introuvable" });
      }

      const user = rows[0];
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 1000 * 60 * 15);

      await req.db.query(
        "UPDATE users SET reset_code = ?, reset_expires = ? WHERE id = ?",
        [resetCode, expires, user.id]
      );

      let channel = null;

      if (identifier.includes("@") && user.email) {
        await transporter.sendMail({
          from: `"Support" <${process.env.SMTP_USER}>`,
          to: user.email,
          subject: "Code de réinitialisation",
          html: `<h2>Bonjour ${user.name || "utilisateur"},</h2>
                 <p>Voici votre code de réinitialisation :</p>
                 <h1 style="color:#E53935">${resetCode}</h1>
                 <p>⚠️ Ce code est valable 15 minutes.</p>`,
        });
        channel = "email";
      }

      if (!identifier.includes("@") && user.phone) {
        await twilioClient.messages.create({
          body: `Votre code de réinitialisation est : ${resetCode} (valide 15 min)`,
          from: process.env.TWILIO_PHONE,
          to: user.phone.startsWith("+") ? user.phone : `+223${user.phone}`,
        });
        channel = "sms";
      }

      res.json({ message: "✅ Code envoyé", channel });
    } catch (err) {
      console.error("❌ Erreur forgot-password:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // 🔑 Vérification OTP
  router.post("/verify-code", async (req, res) => {
    try {
      const { identifier, code } = req.body;
      const [rows] = await req.db.query(
        "SELECT * FROM users WHERE (email = ? OR phone = ?) AND reset_code = ? AND reset_expires > NOW()",
        [identifier, identifier, code]
      );
      if (rows.length === 0) {
        return res.status(400).json({ error: "Code invalide ou expiré" });
      }
      res.json({ message: "✅ Code validé, vous pouvez réinitialiser le mot de passe" });
    } catch (err) {
      console.error("❌ Erreur verify-code:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // 🔑 Réinitialisation du mot de passe
  router.post("/reset-password", async (req, res) => {
    try {
      const { identifier, code, newPassword } = req.body;
      const [rows] = await req.db.query(
        "SELECT * FROM users WHERE (email = ? OR phone = ?) AND reset_code = ? AND reset_expires > NOW()",
        [identifier, identifier, code]
      );
      if (rows.length === 0) {
        return res.status(400).json({ error: "Code invalide ou expiré" });
      }

      const user = rows[0];
      const hashed = await bcrypt.hash(newPassword, 10);
      await req.db.query(
        "UPDATE users SET password = ?, must_change_password = 0, reset_code = NULL, reset_expires = NULL WHERE id = ?",
        [hashed, user.id]
      );
      const normalizedIdentifier = String(identifier || "").trim();
      if (normalizedIdentifier.includes("@")) {
        await req.db.query(
          "UPDATE admin_users SET password_hash = ?, must_change_password = 0 WHERE email = ?",
          [hashed, normalizedIdentifier]
        );
      } else if (normalizedIdentifier) {
        const raw = normalizedIdentifier.replace(/\s+/g, "");
        const variants = Array.from(
          new Set([
            raw,
            raw.replace(/^\+/, ""),
            raw.replace(/^\+?223/, ""),
            `+223${raw.replace(/^\+?223/, "")}`,
          ])
        );
        const placeholders = variants.map(() => "?").join(",");
        await req.db.query(
          `UPDATE admin_users SET password_hash = ?, must_change_password = 0 WHERE phone IN (${placeholders})`,
          [hashed, ...variants]
        );
      }

      res.json({ message: "✅ Mot de passe réinitialisé avec succès" });
    } catch (err) {
      console.error("❌ Erreur reset-password:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

// 🔐 Changer son mot de passe (session)
router.put("/password", authMiddleware, async (req, res) => {
  try {
    const { current, new: next, confirm } = req.body || {};
    if (!current || !next || !confirm) {
      return res.status(400).json({ error: "Champs requis: current, new, confirm" });
    }
    if (next !== confirm) {
      return res.status(400).json({ error: "Les mots de passe ne correspondent pas" });
    }

    const { id, role } = req.user;

    if (canonicalRole(role) === "admin") {
      const [[row]] = await db.query("SELECT id, password_hash FROM admin_users WHERE id = ?", [id]);
      if (!row) return res.status(404).json({ error: "Admin introuvable" });
      const ok = await bcrypt.compare(current, row.password_hash);
      if (!ok) return res.status(400).json({ error: "Mot de passe actuel incorrect" });
      const hashed = await bcrypt.hash(next, 10);
      await db.query(
        "UPDATE admin_users SET password_hash = ?, must_change_password = 0, updated_at = NOW() WHERE id = ?",
        [hashed, id]
      );
      return res.json({ message: "Mot de passe admin mis à jour ✅" });
    }

    const [[u]] = await db.query("SELECT id, password FROM users WHERE id = ?", [id]);
    if (!u) return res.status(404).json({ error: "Utilisateur introuvable" });
    const ok = await bcrypt.compare(current, u.password);
    if (!ok) return res.status(400).json({ error: "Mot de passe actuel incorrect" });
    const hashed = await bcrypt.hash(next, 10);
    await db.query("UPDATE users SET password = ?, must_change_password = 0 WHERE id = ?", [
      hashed,
      id,
    ]);
    return res.json({ message: "Mot de passe mis à jour ✅" });
  } catch (err) {
    console.error("❌ PUT /auth/password:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});


// 🔑 Vérification session
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const { id, role } = req.user;

    if (canonicalRole(role) === "admin") {
      const [[adm]] = await req.db.query(
        `SELECT u.id, u.name, u.email, u.phone, u.is_super, u.role_id, u.must_change_password,
                r.name AS role_name, r.permissions
         FROM admin_users u
         LEFT JOIN admin_roles r ON r.id = u.role_id
         WHERE u.id = ?`,
        [id]
      );
      if (!adm) return res.status(404).json({ error: "Admin introuvable" });

      // normaliser permissions (array)
      let perms = [];
      try {
        const parsed = JSON.parse(adm.permissions || "[]");
        perms = Array.isArray(parsed) ? parsed : [];
      } catch {}

      return res.json({
        id: adm.id,
        name: adm.name,
        email: adm.email,
        phone: adm.phone,
        role: "admin",
        is_super: !!adm.is_super,
        permissions: perms,
        must_change_password: adm.must_change_password ?? 0, // si tu ajoutes la colonne plus tard
      });
    }

    // sinon utilisateur standard
    const [[u]] = await req.db.query(
      "SELECT id, name, phone, email, role, must_change_password FROM users WHERE id = ?",
      [id]
    );
    if (!u) return res.status(404).json({ error: "Utilisateur introuvable" });

    return res.json({
      id: u.id,
      name: u.name,
      phone: u.phone,
      email: u.email,
      role: canonicalRole(u.role),
      must_change_password: u.must_change_password,
    });
  } catch (err) {
    console.error("❌ Erreur /me:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});


  // 🛠️ DEV: Bootstrap d'un super-admin (crée/maj users + admin_users)
  // Sécurisé par DEV_BOOTSTRAP_KEY et désactivé si la variable n'est pas définie
  router.post("/dev/bootstrap-admin", async (req, res) => {
    try {
      const secret = process.env.DEV_BOOTSTRAP_KEY;
      if (!secret) return res.status(403).json({ error: "Route désactivée" });
      const { key, name, email, phone, password } = req.body || {};
      if (key !== secret) return res.status(403).json({ error: "Clé invalide" });
      if (!email && !phone) return res.status(400).json({ error: "email ou phone requis" });
      if (!password) return res.status(400).json({ error: "password requis" });

      const hashed = await bcrypt.hash(password, 10);

      // users (pour login téléphone et compat divers)
      let userId = null;
      if (email) {
        const [[uByEmail]] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
        if (uByEmail) userId = uByEmail.id;
      }
      if (!userId && phone) {
        const [[uByPhone]] = await db.query("SELECT id FROM users WHERE phone = ?", [phone]);
        if (uByPhone) userId = uByPhone.id;
      }

      if (!userId) {
        const [ins] = await db.query(
          "INSERT INTO users (name, phone, email, password, role, must_change_password) VALUES (?, ?, ?, ?, 'admin', 0)",
          [name || "Admin", phone || null, email || null, hashed]
        );
        userId = ins.insertId;
      } else {
        await db.query(
          "UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), email = COALESCE(?, email), password = ?, role = 'admin' WHERE id = ?",
          [name || null, phone || null, email || null, hashed, userId]
        );
      }

      // admin_users (RBAC)
const [[adm]] = await db.query("SELECT id FROM admin_users WHERE id = ?", [userId]);
if (!adm) {
  await db.query(
    "INSERT INTO admin_users (id, name, email, password_hash, is_super, created_at) VALUES (?, ?, ?, ?, 1, NOW())",
    [userId, name || "Admin", email || null, hashed]
  );
} else {
  await db.query(
    "UPDATE admin_users SET name = COALESCE(?, name), email = COALESCE(?, email), password_hash = ?, is_super = 1, updated_at = NOW() WHERE id = ?",
    [name || null, email || null, hashed, userId]
  );
}


      return res.json({ message: "Super admin bootstrapé ✅", id: userId });
    } catch (err) {
      console.error("❌ bootstrap-admin:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  return router;
};
