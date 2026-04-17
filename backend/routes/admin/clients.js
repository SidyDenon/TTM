import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import authMiddleware from "../../middleware/auth.js";
import { sendMail } from "../../utils/mailer.js";
import { getSchemaColumns } from "../../utils/schema.js";
import { loadAdminPermissions, checkPermission } from "../../middleware/checkPermission.js";
import { findIdentityConflict } from "../../utils/identityUniqueness.js";

const router = express.Router();

function genererMotDePasse(longueur = 12) {
  return crypto.randomBytes(longueur).toString("base64").slice(0, longueur);
}

// Historiser actions admin
async function logAdminEvent(db, adminId, action, meta = {}) {
  try {
    await db.query(
      "INSERT INTO admin_events (admin_id, action, meta, created_at) VALUES (?, ?, ?, NOW())",
      [adminId, action, JSON.stringify(meta)]
    );
  } catch (e) {
    console.warn("⚠️ Impossible d'enregistrer admin_events:", e.message || e);
  }
}

export default (db) => {
  router.use((req, _res, next) => {
    req.db = db;
    next();
  });

  router.use(authMiddleware, loadAdminPermissions);

  //  Liste des clients
  router.get("/", checkPermission("clients_view"), async (req, res) => {
    try {
      const { clientAddress } = await getSchemaColumns(req.db);
      const addrSel = clientAddress ? `c.${clientAddress}` : "NULL";
      const sql = `
        SELECT 
          u.id, u.name, u.phone, u.email, u.role, u.created_at, 
          ${addrSel} AS adresse
        FROM users u
        LEFT JOIN clients c ON u.id = c.user_id
        WHERE u.role = 'client'
        ORDER BY u.created_at DESC
      `;
      const [rows] = await req.db.query(sql);
      res.json({ message: "Liste des clients récupérée ✅", data: rows });
    } catch (err) {
      console.error("❌ Erreur GET /clients:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  //  Créer un client (écriture)
  router.post("/", checkPermission("clients_manage"), async (req, res) => {
    try {
      const { name, phone, email, adresse } = req.body;
      if (!name || !phone) {
        return res.status(400).json({ error: "Nom et téléphone requis" });
      }

      const conflict = await findIdentityConflict(req.db, { email, phone });
      if (conflict) {
        return res
          .status(400)
          .json({ error: "Téléphone ou email déjà utilisé" });
      }

      const motDePasseClair = genererMotDePasse(10);
      const hash = await bcrypt.hash(motDePasseClair, 10);

      const [result] = await req.db.query(
        "INSERT INTO users (name, phone, email, password, role, must_change_password, created_at) VALUES (?, ?, ?, ?, 'client', 1, NOW())",
        [name, phone, email || null, hash]
      );
      const userId = result.insertId;

      const { clientAddress } = await getSchemaColumns(req.db);
      if (clientAddress) {
        await req.db.query(
          `INSERT INTO clients (user_id, ${clientAddress}) VALUES (?, ?)`,
          [userId, adresse || null]
        );
      } else {
        await req.db.query(
          `INSERT INTO clients (user_id) VALUES (?)`,
          [userId]
        );
      }

      await logAdminEvent(req.db, req.user.id, "client_cree", {
        client_id: userId,
        name,
        phone,
        email,
      });

      if (email) {
        try {
          await sendMail(
            email,
            "Bienvenue sur Tow Truck Mali – Dépannage express 🚨",
            `Bonjour ${name},

Bienvenue sur TOW TRUCK MALI 🚗💨  
Votre compte client a été créé avec succès.

📞 Téléphone : ${phone}
🔑 Mot de passe provisoire : ${motDePasseClair}

⚠️ Pour votre sécurité, merci de modifier ce mot de passe lors de votre première connexion.

📍 Grâce à l’application TOW TRUCK MALI, vous pouvez :
✅ Demander un dépannage rapidement
📍 Être localisé automatiquement
🕒 Suivre l’arrivée de la dépanneuse en temps réel

En cas de besoin, notre équipe est prête à intervenir.

🌐 Visitez notre site : https://towtruckmali.com/

🚨 TOW TRUCK MALI  
Dépannage express – 24h/24
`
          );
        } catch (mailErr) {
          console.warn("⚠️ Erreur envoi mail:", mailErr.message);
        }
      }

      res.status(201).json({
        message: "Client créé ✅",
        data: {
          id: userId,
          name,
          phone,
          email: email || null,
          role: "client",
          must_change_password: 1,
          motDePasse: motDePasseClair,
          adresse: adresse || null,
        },
      });
    } catch (err) {
      console.error("❌ Erreur POST /clients:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ✏️ Modifier un client (écriture)
  router.put("/:id", checkPermission("clients_manage"), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, phone, email, adresse } = req.body;

      // 🔎 unicité globale phone/email (users + admin_users)
      if (phone || email !== undefined) {
        const conflict = await findIdentityConflict(req.db, {
          email,
          phone,
          excludeUserId: Number(id),
        });
        if (conflict) {
          return res.status(400).json({ error: "Téléphone ou email déjà utilisé" });
        }
      }

      // 1️⃣ Update users
      const champsUsers = [];
      const valeursUsers = [];
      if (name) {
        champsUsers.push("name = ?");
        valeursUsers.push(name);
      }
      if (phone) {
        champsUsers.push("phone = ?");
        valeursUsers.push(phone);
      }
      if (email !== undefined) {
        champsUsers.push("email = ?");
        valeursUsers.push(email || null);
      }
      if (champsUsers.length > 0) {
        valeursUsers.push(id);
        await req.db.query(
          `UPDATE users SET ${champsUsers.join(", ")} WHERE id = ?`,
          valeursUsers
        );
      }

      // 2️⃣ Update clients (colonne d'adresse dynamique)
      if (adresse !== undefined) {
        const { clientAddress } = await getSchemaColumns(req.db);
        if (clientAddress) {
          await req.db.query(
            `UPDATE clients SET ${clientAddress} = ? WHERE user_id = ?`,
            [adresse || null, id]
          );
        }
      }

      await logAdminEvent(req.db, req.user.id, "client_modifie", {
        client_id: id,
      });

      res.json({ message: "Client mis à jour ✅" });
    } catch (err) {
      console.error("❌ Erreur PUT /clients/:id:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ❌ Supprimer un client (écriture)
  router.delete("/:id", checkPermission("clients_manage"), async (req, res) => {
    try {
      const { id } = req.params;

      const [[user]] = await req.db.query(
        "SELECT id FROM users WHERE id = ? AND role = 'client'",
        [id]
      );
      if (!user) {
        return res.status(404).json({ error: "Client introuvable" });
      }

      // Bloquer si missions encore en cours (non terminées/annulées)
      const [missions] = await req.db.query(
        `SELECT id FROM requests WHERE user_id = ? AND status IN (
          'en_attente','publiee','assignee','acceptee','en_route','sur_place'
        )`,
        [id]
      );
      if (missions.length > 0) {
        return res
          .status(400)
          .json({ error: "Ce client a encore des missions actives" });
      }

      // Récupérer toutes les demandes du client
      const [allRequests] = await req.db.query(
        "SELECT id FROM requests WHERE user_id = ?",
        [id]
      );
      if (allRequests.length > 0) {
        const requestIds = allRequests.map((r) => r.id);
        const placeholders = requestIds.map(() => "?").join(",");

        // 1) transactions (réf → requests)
        try {
          await req.db.query(
            `DELETE FROM transactions WHERE request_id IN (${placeholders})`,
            requestIds
          );
        } catch (e) {
          if (e?.code !== "ER_NO_SUCH_TABLE") throw e;
        }

        // 2) request_events (réf → requests)
        try {
          await req.db.query(
            `DELETE FROM request_events WHERE request_id IN (${placeholders})`,
            requestIds
          );
        } catch (e) {
          if (e?.code !== "ER_NO_SUCH_TABLE") throw e;
        }

        // 3) requests eux-mêmes (réf → users)
        await req.db.query(
          `DELETE FROM requests WHERE id IN (${placeholders})`,
          requestIds
        );
      }

      // 4) tokens push (réf → users)
      try {
        await req.db.query("DELETE FROM device_tokens WHERE user_id = ?", [id]);
      } catch (e) {
        if (e?.code !== "ER_NO_SUCH_TABLE") throw e;
      }

      // 5) profil client (réf → users)
      try {
        await req.db.query("DELETE FROM clients WHERE user_id = ?", [id]);
      } catch (e) {
        if (e?.code !== "ER_NO_SUCH_TABLE") throw e;
      }

      // 6) utilisateur
      await req.db.query("DELETE FROM users WHERE id = ?", [id]);

      await logAdminEvent(req.db, req.user.id, "client_supprime", {
        client_id: id,
      });

      res.json({ message: `Client #${id} supprimé ✅` });
    } catch (err) {
      console.error("❌ Erreur DELETE /clients/:id:", err?.message || err, err?.code);
      res.status(500).json({ error: "Erreur serveur", detail: err?.message });
    }
  });

  // 🔄 Réinitialiser mot de passe (écriture)
  router.post(
    "/:id/reinitialiser-mdp",
    checkPermission("clients_manage"),
    async (req, res) => {
      try {
        const { id } = req.params;

        const [[client]] = await req.db.query(
          "SELECT * FROM users WHERE id = ? AND role = 'client'",
          [id]
        );
        if (!client) {
          return res.status(404).json({ error: "Client introuvable" });
        }

        const nouveauMdp = genererMotDePasse(10);
        const hash = await bcrypt.hash(nouveauMdp, 10);

        await req.db.query(
          "UPDATE users SET password = ?, must_change_password = 1 WHERE id = ?",
          [hash, id]
        );

        await logAdminEvent(req.db, req.user.id, "client_reset_mdp", {
          client_id: id,
        });

        if (client.email) {
          try {
            await sendMail(
              client.email,
              "🔑 Réinitialisation de votre mot de passe TTM",
              `Bonjour ${client.name},\n\nVotre mot de passe a été réinitialisé.\n\n🔑 Nouveau mot de passe: ${nouveauMdp}\n\n⚠️ Merci de le modifier lors de votre prochaine connexion.\n\n🚀 L'équipe TTM`
            );
          } catch (mailErr) {
            console.warn("⚠️ Erreur envoi mail:", mailErr.message);
          }
        }

        res.json({
          message: client.email
            ? "Mot de passe réinitialisé et envoyé par email ✅"
            : "Mot de passe réinitialisé ✅ (pas d’email trouvé)",
          motDePasse: nouveauMdp,
        });
      } catch (err) {
        console.error("❌ Erreur reset mot de passe client:", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  );

  return router;
};
