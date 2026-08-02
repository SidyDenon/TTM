// routes/admin/withdrawals.js
import express from "express";
import authMiddleware from "../../middleware/auth.js";
import { loadAdminPermissions, checkPermission } from "../../middleware/checkPermission.js";
import { sendPushNotification } from "../../utils/sendPush.js";

const router = express.Router();

async function logAdminEvent(db, adminId, action, meta = {}) {
  try {
    await db.query(
      "INSERT INTO admin_events (admin_id, action, meta, created_at) VALUES (?, ?, ?, NOW())",
      [adminId, action, JSON.stringify(meta)]
    );
  } catch (e) {
    console.warn(" log admin_events (withdrawals):", e?.message || e);
  }
}

// 🔧 Helpers pour récupérer io & onlineUsers injectés dans app (server.js)
const getIo = (req) => {
  try {
    return req.app?.get?.("io") || null;
  } catch {
    return null;
  }
};

const getOnlineUsers = (req) => {
  try {
    return req.app?.get?.("onlineUsers") || null;
  } catch {
    return null;
  }
};

export default (db) => {
  // Injecte la DB dans la requête
  router.use((req, _res, next) => {
    req.db = db;
    next();
  });

  // Auth + chargement des permissions pour tout le module
  router.use(authMiddleware, loadAdminPermissions);

  // 📋 Liste des retraits + stats (lecture)
  router.get("/", checkPermission("withdrawals_view"), async (req, res) => {
    try {
      let rows = [];
      try {
        [rows] = await req.db.query(`
          SELECT w.*, u.name AS operator_name, u.notification_token
          FROM withdrawals w
          LEFT JOIN users u ON u.id = w.operator_id
          ORDER BY w.created_at DESC
        `);
      } catch (e) {
        if (e?.code === "ER_NO_SUCH_TABLE") {
          rows = [];
        } else {
          throw e;
        }
      }

      // Stats robustes (gère "en_attente" ET "en attente")
      const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, "_");
      const sum = (acc, r) => acc + Number(r.amount || 0);

      const total_attente = rows
        .filter((r) => ["en_attente"].includes(norm(r.status)))
        .reduce(sum, 0);
      const total_approuve = rows
        .filter((r) => norm(r.status) === "approuvée")
        .reduce(sum, 0);
      const total_rejete = rows
        .filter((r) => norm(r.status) === "rejetée")
        .reduce(sum, 0);

      try {
        const approvedIds = rows
          .filter((r) => norm(r.status) === "approuvée")
          .map((r) => Number(r.id))
          .filter((id) => Number.isFinite(id));

        if (approvedIds.length > 0) {
          const placeholders = approvedIds.map(() => "?").join(",");
          const [approveLogs] = await req.db.query(
            `SELECT
               CAST(JSON_UNQUOTE(JSON_EXTRACT(ae.meta, '$.withdrawal_id')) AS UNSIGNED) AS withdrawal_id,
               u.name AS admin_name,
               ae.created_at
             FROM admin_events ae
             LEFT JOIN users u ON u.id = ae.admin_id
             WHERE ae.action = 'retrait_approuve'
               AND CAST(JSON_UNQUOTE(JSON_EXTRACT(ae.meta, '$.withdrawal_id')) AS UNSIGNED) IN (${placeholders})
             ORDER BY ae.created_at DESC`,
            approvedIds
          );

          const adminByWithdrawal = new Map();
          for (const log of approveLogs || []) {
            const wid = Number(log?.withdrawal_id);
            if (!Number.isFinite(wid) || adminByWithdrawal.has(wid)) continue;
            adminByWithdrawal.set(wid, log?.admin_name || null);
          }

          rows = rows.map((r) => ({
            ...r,
            approved_by_admin:
              norm(r.status) === "approuvée"
                ? adminByWithdrawal.get(Number(r.id)) || null
                : null,
          }));
        } else {
          rows = rows.map((r) => ({ ...r, approved_by_admin: null }));
        }
      } catch (e) {
        rows = rows.map((r) => ({ ...r, approved_by_admin: null }));
      }

      res.json({
        message: "Liste des retraits ",
        data: rows,
        stats: {
          total_attente,
          total_approuve,
          total_rejete,
        },
      });
    } catch (err) {
      console.error(" Erreur GET /withdrawals:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  //  Changer le statut (écriture)
  router.patch(
    "/:id/status",
    checkPermission("withdrawals_manage"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body;

        //  Validation stricte du statut demandé
        if (!["approuvée", "rejetée"].includes(status)) {
          return res.status(400).json({ error: "Statut invalide" });
        }

        // 🔎 Récupération du retrait + infos opérateur
        const [[withdrawal]] = await req.db.query(
          `SELECT w.*, u.notification_token, u.name, u.id AS operator_id
           FROM withdrawals w
           LEFT JOIN users u ON u.id = w.operator_id
           WHERE w.id = ?`,
          [id]
        );

        if (!withdrawal) {
          return res.status(404).json({ error: "Retrait introuvable" });
        }

        // 🚫 Protection anti double-traitement
        const currentStatus = String(withdrawal.status || "")
          .toLowerCase()
          .replace(/\s+/g, "_");
        if (currentStatus !== "en_attente") {
          return res
            .status(409)
            .json({ error: "Ce retrait a déjà été traité." });
        }

        //  Mise à jour en base (tolérante pour l'état initial)
        const [result] = await req.db.query(
          `UPDATE withdrawals
             SET status = ?, updated_at = NOW()
           WHERE id = ?
             AND (status = 'en_attente' OR status = 'en attente')`,
          [status, id]
        );

        if (result.affectedRows === 0) {
          return res.status(409).json({
            error:
              "Retrait déjà confirmé ou rejeté par un autre administrateur.",
          });
        }

        //  Notification push Expo
        if (withdrawal.notification_token) {
          const title = "💸 Mise à jour de votre retrait";
          const message =
            status === "approuvée"
              ? ` Bonjour ${withdrawal.name}, votre retrait de ${withdrawal.amount} ${withdrawal.currency} a été approuvé.`
              : ` Bonjour ${withdrawal.name}, votre demande de retrait de ${withdrawal.amount} ${withdrawal.currency} a été rejetée.`;
          try {
            await sendPushNotification(
              withdrawal.notification_token,
              title,
              message
            );
            console.log(`📲 Push envoyé à ${withdrawal.name}`);
          } catch (pushErr) {
            console.warn(
              " Erreur d’envoi push:",
              pushErr?.message || pushErr
            );
          }
        }

        // ⚡ Notification Socket.IO à l’opérateur concerné
        const io = getIo(req);
        const onlineUsers = getOnlineUsers(req);
        if (io && onlineUsers?.operators instanceof Map) {
          const operatorSocketId = onlineUsers.operators.get(
            Number(withdrawal.operator_id)
          );
          if (operatorSocketId) {
            io.to(operatorSocketId).emit("withdrawal_update", {
              id: withdrawal.id,
              status,
              amount: withdrawal.amount,
              currency: withdrawal.currency,
              message:
                status === "approuvée"
                  ? `Votre retrait de ${withdrawal.amount} ${withdrawal.currency} a été approuvé `
                  : `Votre retrait de ${withdrawal.amount} ${withdrawal.currency} a été rejeté `,
              updated_at: new Date().toISOString(),
            });
            console.log(
              `📡 [SOCKET] withdrawal_update → opérateur ${withdrawal.operator_id}`
            );
          } else {
            console.log(
              ` Opérateur ${withdrawal.operator_id} non connecté via socket`
            );
          }
        }

        // 🧩 Broadcast temps réel pour tous les admins
        if (io) {
          io.to("admins").emit("withdrawal_updated_admin", {
            id: withdrawal.id,
            operator_id: withdrawal.operator_id,
            operator_name: withdrawal.name,
            amount: withdrawal.amount,
            currency: withdrawal.currency,
            status,
            updated_at: new Date().toISOString(),
          });
          console.log("📢 [SOCKET] withdrawal_updated_admin → admins");

          //  Mise à jour tableau de bord (stats)
          io.to("admins").emit("dashboard_update", {
            type: "withdrawal",
            action: "updated",
            id: withdrawal.id,
            status,
          });
        }

        //  Réponse
        res.json({
          message: `Retrait #${id} ${
            status === "approuvée" ? "approuvé " : "rejeté "
          }`,
          id,
          status,
        });

        await logAdminEvent(req.db, req.user?.id, status === "approuvée" ? "retrait_approuve" : "retrait_rejete", {
          withdrawal_id: Number(id),
          operator_id: Number(withdrawal.operator_id),
          amount: Number(withdrawal.amount || 0),
          currency: withdrawal.currency || "FCFA",
          status,
        });
      } catch (err) {
        console.error(" Erreur PATCH /withdrawals/:id/status:", err);
        res.status(500).json({ error: "Erreur serveur" });
      }
    }
  );

  return router;
};
