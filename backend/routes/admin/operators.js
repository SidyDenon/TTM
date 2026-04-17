// routes/admin/operators.js
import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import authMiddleware from "../../middleware/auth.js";
import { sendMail } from "../../utils/mailer.js";
import { getSchemaColumns } from "../../utils/schema.js";
import { loadAdminPermissions, checkPermission } from "../../middleware/checkPermission.js";
import { findIdentityConflict } from "../../utils/identityUniqueness.js";

const router = express.Router();

// 🔑 Génération mot de passe aléatoire
function genererMotDePasse(longueur = 12) {
  return crypto.randomBytes(longueur).toString("base64").slice(0, longueur);
}

// 🧾 Historiser actions admin
async function logAdminEvent(db, adminId, action, meta = {}) {
  await db.query(
    "INSERT INTO admin_events (admin_id, action, meta, created_at) VALUES (?, ?, ?, NOW())",
    [adminId, action, JSON.stringify(meta)]
  );
}

export default (db) => {
  // Inject DB
  router.use((req, _res, next) => {
    req.db = db;
    next();
  });

  // Auth + charge les permissions pour tout ce module
  router.use(authMiddleware, loadAdminPermissions);

  // 📋 Liste des opérateurs (lecture)
  router.get(
    "/",
    checkPermission("operators_view"),
    async (req, res) => {
      try {
        const { operatorDispo, operatorInternal } = await getSchemaColumns(req.db);
        const dispoSel = operatorDispo ? `o.${operatorDispo}` : "NULL";
        const internalSel = operatorInternal ? `o.${operatorInternal}` : "NULL";
        const sql = `
          SELECT u.id, u.name, u.phone, u.email, u.created_at,
                 o.ville, o.quartier, o.vehicle_type, o.lat, o.lng, o.balance, o.pending_balance,
                 ${dispoSel} AS dispo, ${internalSel} AS is_internal,
                 (
                   SELECT COUNT(*)
                   FROM requests r
                   WHERE r.operator_id = u.id
                     AND LOWER(r.status) = 'terminee'
                 ) AS missions_terminees
          FROM users u
          LEFT JOIN operators o ON o.user_id = u.id
          WHERE u.role = 'operator'
          ORDER BY u.created_at DESC
        `;
        const [rows] = await req.db.query(sql);
        res.json({ message: "Liste des opérateurs récupérée ✅", data: rows });
      } catch (err) {
        console.error("❌ Erreur GET /operators:", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  );

  // ➕ Créer un opérateur (écriture)
  router.post(
    "/",
    checkPermission("operators_manage"),
    async (req, res) => {
      try {
        const { name, phone, email, ville, quartier, is_internal } = req.body;
        if (!name || !phone) {
          return res
            .status(400)
            .json({ error: "Nom et téléphone sont requis" });
        }

        const conflict = await findIdentityConflict(req.db, { email, phone });
        if (conflict) {
          return res
            .status(400)
            .json({ error: "Téléphone ou email déjà utilisé" });
        }

        const motDePasseClair = genererMotDePasse(12);
        const hash = await bcrypt.hash(motDePasseClair, 10);

        // 1️⃣ users
        const [result] = await req.db.query(
          "INSERT INTO users (name, phone, email, password, role, must_change_password, created_at) VALUES (?, ?, ?, ?, 'operator', 1, NOW())",
          [name, phone, email || null, hash]
        );
        const userId = result.insertId;

        // 2️⃣ operators
        const { operatorDispo, operatorCreatedAt, operatorInternal } = await getSchemaColumns(req.db);
        const columns = ["user_id", "ville", "quartier"];
        const placeholders = ["?", "?", "?"];
        const values = [userId, ville || "", quartier || ""];
        if (operatorInternal) {
          columns.push(operatorInternal);
          placeholders.push("?");
          values.push(is_internal ? 1 : 0);
        }
        if (operatorDispo) {
          columns.push(operatorDispo);
          placeholders.push("?");
          values.push(1);
        }
        if (operatorCreatedAt) {
          columns.push(operatorCreatedAt);
          placeholders.push("NOW()");
        }
        const sql = `INSERT INTO operators (${columns.join(", ")}) VALUES (${placeholders.join(", ")})`;
        await req.db.query(sql, values);

        await logAdminEvent(req.db, req.user.id, "operateur_cree", {
          operator_id: userId,
        });

        // 3️⃣ Email (si fourni)
        if (email) {
          try {
            await sendMail(
              email,
              "🚚 Vos identifiants TTM",
              `Bonjour ${name},\n\nVotre compte opérateur a été créé.\n\n📱 Téléphone: ${phone}\n🔑 Mot de passe provisoire: ${motDePasseClair}\n\n⚠️ Merci de le modifier lors de votre première connexion.\n\n🚀 L'équipe TTM`
            );
          } catch (mailErr) {
            console.warn("⚠️ Erreur envoi email:", mailErr.message);
          }
        }

        res.status(201).json({
          message: "Opérateur créé ✅",
          motDePasse: motDePasseClair,
          data: {
            id: userId,
            name,
            phone,
            email: email || null,
            role: "operator",
            must_change_password: 1,
            ville: ville || "",
            quartier: quartier || "",
          },
        });
      } catch (err) {
        console.error("❌ Erreur POST /operators:", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  );

  // ✏️ Modifier un opérateur (écriture)
  router.put(
    "/:id",
    checkPermission("operators_manage"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const { name, phone, email, password, ville, quartier, dispo, is_internal } =
          req.body;

        // unicité globale phone/email (users + admin_users)
        if (phone || email !== undefined) {
          const conflict = await findIdentityConflict(req.db, {
            email,
            phone,
            excludeUserId: Number(id),
          });
          if (conflict) {
            return res
              .status(400)
              .json({ error: "Téléphone ou email déjà utilisé" });
          }
        }

        // 1️⃣ users
        const fieldsUser = [];
        const valuesUser = [];
        if (name) {
          fieldsUser.push("name = ?");
          valuesUser.push(name);
        }
        if (phone) {
          fieldsUser.push("phone = ?");
          valuesUser.push(phone);
        }
        // autoriser null sur email
        if (email !== undefined) {
          fieldsUser.push("email = ?");
          valuesUser.push(email || null);
        }
        if (password) {
          const hash = await bcrypt.hash(password, 10);
          fieldsUser.push("password = ?");
          valuesUser.push(hash);
          // si tu veux forcer must_change_password lors d’un reset admin :
          // fieldsUser.push("must_change_password = 1");
        }
        if (fieldsUser.length > 0) {
          valuesUser.push(id);
          await req.db.query(
            `UPDATE users SET ${fieldsUser.join(", ")} WHERE id = ?`,
            valuesUser
          );
        }

        // 2️⃣ operators
        const fieldsOp = [];
        const valuesOp = [];
        if (ville !== undefined) {
          fieldsOp.push("ville = ?");
          valuesOp.push(ville || "");
        }
        if (quartier !== undefined) {
          fieldsOp.push("quartier = ?");
          valuesOp.push(quartier || "");
        }
        const { operatorDispo, operatorInternal } = await getSchemaColumns(req.db);
        if (dispo !== undefined && operatorDispo) {
          fieldsOp.push(`${operatorDispo} = ?`);
          valuesOp.push(dispo ? 1 : 0);
        }
        if (is_internal !== undefined && operatorInternal) {
          fieldsOp.push(`${operatorInternal} = ?`);
          valuesOp.push(is_internal ? 1 : 0);
        }
        if (fieldsOp.length > 0) {
          valuesOp.push(id);
          await req.db.query(
            `UPDATE operators SET ${fieldsOp.join(", ")} WHERE user_id = ?`,
            valuesOp
          );
        }

        await logAdminEvent(req.db, req.user.id, "operateur_modifie", {
          operator_id: id,
        });

        res.json({ message: "Opérateur mis à jour ✅" });
      } catch (err) {
        console.error("❌ Erreur PUT /operators/:id:", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  );

  // ❌ Supprimer un opérateur (écriture)
  router.delete(
    "/:id",
    checkPermission("operators_manage"),
    async (req, res) => {
      try {
        const { id } = req.params;

        const [rows] = await req.db.query(
          "SELECT id FROM users WHERE id = ? AND role = 'operator'",
          [id]
        );
        if (rows.length === 0) {
          return res.status(404).json({ error: "Opérateur introuvable" });
        }

        // Empêcher suppression si missions actives
        const [missions] = await req.db.query(
          "SELECT id FROM requests WHERE operator_id = ? AND status IN ('acceptee','en_route','sur_place')",
          [id]
        );
        if (missions.length > 0) {
          return res.status(400).json({
            error:
              "Impossible de supprimer un opérateur avec des missions actives",
          });
        }

        await req.db.query("UPDATE requests SET operator_id = NULL WHERE operator_id = ?", [id]);
        await req.db.query("DELETE FROM operators WHERE user_id = ?", [id]);
        await req.db.query("DELETE FROM users WHERE id = ?", [id]);

        await logAdminEvent(req.db, req.user.id, "operateur_supprime", {
          operator_id: id,
        });

        res.json({ message: `Opérateur #${id} supprimé ✅` });
      } catch (err) {
        console.error("❌ Erreur DELETE /operators/:id:", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  );

  // 🔄 Réinitialiser mot de passe (écriture)
  router.post(
    "/:id/reset-password",
    checkPermission("operators_manage"),
    async (req, res) => {
      try {
        const { id } = req.params;

        const [[user]] = await req.db.query(
          "SELECT * FROM users WHERE id = ? AND role = 'operator'",
          [id]
        );
        if (!user) return res.status(404).json({ error: "Opérateur introuvable" });

        const nouveauMdp = genererMotDePasse(12);
        const hash = await bcrypt.hash(nouveauMdp, 10);

        await req.db.query(
          "UPDATE users SET password = ?, must_change_password = 1 WHERE id = ?",
          [hash, id]
        );

        await logAdminEvent(req.db, req.user.id, "operateur_reset_mdp", {
          operator_id: id,
        });

        if (user.email) {
          try {
            await sendMail(
              user.email,
              "🔑 Réinitialisation du mot de passe TTM",
              `Bonjour ${user.name},\n\nVotre mot de passe a été réinitialisé.\n\n🔑 Nouveau mot de passe : ${nouveauMdp}\n\n⚠️ Merci de le modifier lors de votre prochaine connexion.\n\n🚀 L'équipe TTM`
            );
          } catch (mailErr) {
            console.warn("⚠️ Erreur email:", mailErr.message);
          }
        }

        res.json({
          message: user.email
            ? "Mot de passe réinitialisé et envoyé par email ✅"
            : "Mot de passe réinitialisé ✅ (pas d’email trouvé)",
          motDePasse: nouveauMdp,
        });
      } catch (err) {
        console.error("❌ Erreur reset mot de passe opérateur:", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  );

  return router;
};
