import express from "express";
import authMiddleware from "../../middleware/auth.js";
import { io, notifyUser } from "../../server.js";
import { loadAdminPermissions, checkPermission } from "../../middleware/checkPermission.js";
import { getCommissionPercent } from "../../utils/commission.js";

const router = express.Router();

export default (db) => {
  // Injecte la DB
  router.use((req, _res, next) => {
    req.db = db;
    next();
  });

  // Auth + chargement des permissions pour TOUTES les routes de ce module
  router.use(authMiddleware, loadAdminPermissions);

  // 🧾 Liste des transactions + totaux (lecture)
  router.get("/", checkPermission("transactions_view"), async (req, res) => {
    try {
      const { status } = req.query;
      let sql = `
        SELECT 
          t.*, 
          o.name AS operator_name, 
          u.name AS client_name,
          r.id AS request_id,
          r.status AS request_status,
          r.user_id AS client_id
        FROM transactions t
        LEFT JOIN operators op ON op.user_id = t.operator_id
        LEFT JOIN requests r ON r.id = t.request_id
        LEFT JOIN users o ON o.id = op.user_id
        LEFT JOIN users u ON u.id = r.user_id
        WHERE 1
      `;

      const params = [];
      if (status && status !== "toutes") {
        sql += " AND t.status = ?";
        params.push(status);
      }

      sql += " ORDER BY t.created_at DESC";
      let rows = [];
      try {
        [rows] = await req.db.query(sql, params);
      } catch (e) {
        if (e?.code === 'ER_NO_SUCH_TABLE') {
          rows = [];
        } else { throw e; }
      }

      // Statistiques globales
      let statsRows = [{ total: 0, total_confirme: 0, total_attente: 0 }];
      try {
        [statsRows] = await req.db.query(`
          SELECT
            COALESCE(SUM(amount), 0) AS total,
            SUM(CASE WHEN status = 'confirmée' THEN amount ELSE 0 END) AS total_confirme,
            SUM(CASE WHEN status = 'en_attente' THEN amount ELSE 0 END) AS total_attente
          FROM transactions
        `);
      } catch (e) {
        if (e?.code !== 'ER_NO_SUCH_TABLE') throw e;
      }

      const stats = statsRows[0];
      const commissionPercent = await getCommissionPercent(req.db);
      const COMM = commissionPercent / 100;

      const commission = stats.total * COMM;
      const afterCommission = stats.total - commission;
      const remaining = afterCommission - (stats.total_confirme || 0);

      res.json({
        message: "Transactions récupérées ✅",
        data: rows,
        stats: {
          total: stats.total,
          commission,
          afterCommission,
          total_confirme: stats.total_confirme,
          total_attente: stats.total_attente,
          remaining,
        },
      });
    } catch (err) {
      console.error("❌ Erreur GET /transactions:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ➕ Ajouter une transaction manuelle (écriture)
  router.post("/", checkPermission("transactions_manage"), async (req, res) => {
    try {
      const { operator_id, request_id, amount, currency = "FCFA", status = "en_attente" } = req.body;

      if (!operator_id || !request_id || !amount) {
        return res.status(400).json({ error: "Champs requis manquants" });
      }

      const [result] = await req.db.query(
        `INSERT INTO transactions (operator_id, request_id, amount, currency, status, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [operator_id, request_id, amount, currency, status]
      );

      const id = result?.insertId;
      // 🔊 Temps réel pour tous les admins
      io.to("admins").emit("transaction_created", {
        id,
        operator_id,
        request_id,
        amount,
        currency,
        status,
        created_at: new Date().toISOString(),
      });
      io.to("admins").emit("dashboard_update", { type: "transaction", action: "created", id });

      res.status(201).json({ message: "Transaction ajoutée ✅", id });
    } catch (err) {
      console.error("❌ Erreur POST /transactions:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ♻️ Changer le statut (écriture)
  router.patch("/:id/status", checkPermission("transactions_manage"), async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!["en_attente", "confirmée"].includes(status)) {
        return res.status(400).json({ error: "Statut invalide" });
      }

      const [rows] = await req.db.query("SELECT * FROM transactions WHERE id = ?", [id]);
      if (rows.length === 0) {
        return res.status(404).json({ error: "Transaction introuvable" });
      }

      await req.db.query("UPDATE transactions SET status = ? WHERE id = ?", [status, id]);

      // 🔊 Broadcast temps réel pour admins
      io.to("admins").emit("transaction_updated", { id: Number(id), status });
      io.to("admins").emit("dashboard_update", { type: "transaction", action: "updated", id: Number(id), status });

      res.json({
        message: `Transaction #${id} ${status === "confirmée" ? "confirmée ✅" : "mise en attente ⏳"}`,
      });
    } catch (err) {
      console.error("❌ Erreur PATCH /transactions/:id/status:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ✅ Confirmation + crédit opérateur (écriture)
  router.patch("/:id/confirm", checkPermission("transactions_manage"), async (req, res) => {
    let connection;
    try {
      const { id } = req.params;

      connection = await req.db.getConnection();
      await connection.beginTransaction();

      // 1) Transaction
      const [[tx]] = await connection.query(`SELECT * FROM transactions WHERE id = ?`, [id]);
      if (!tx) {
        await connection.rollback(); connection.release();
        return res.status(404).json({ error: "Transaction introuvable" });
      }
      if (tx.status === "confirmée") {
        await connection.rollback(); connection.release();
        return res.status(400).json({ error: "Déjà confirmée" });
      }

      // 2) Opérateur
      const [[op]] = await connection.query(`SELECT * FROM operators WHERE user_id = ?`, [tx.operator_id]);
      if (!op) {
        await connection.rollback(); connection.release();
        return res.status(404).json({ error: "Profil opérateur introuvable" });
      }

      // 3) Calculs
      const commissionPercent = await getCommissionPercent(connection);
      const COMM = commissionPercent / 100;
      const commission = tx.amount * COMM;
      const netAmount = tx.amount - commission;

      // 4) Maj transaction
      await connection.query(
        "UPDATE transactions SET status = 'confirmée', commission = ?, confirmed_at = NOW() WHERE id = ?",
        [commission, id]
      );

      // 5) Créditer l’opérateur (balance) et décrémenter le pending_balance
      await connection.query(
        `UPDATE operators SET balance = balance + ?, pending_balance = GREATEST(0, pending_balance - ?) WHERE id = ?`,
        [netAmount, netAmount, op.id]
      );

      await connection.commit();
      connection.release();

      // 6) Notifs
      io.to("admins").emit("transaction_confirmed", {
        id,
        operator_id: tx.operator_id,
        amount: tx.amount,
        netAmount,
        commission,
        message: `Transaction #${id} confirmée ✅`,
      });

      notifyUser(op.user_id, "transaction_update", {
        id,
        amount: tx.amount,
        netAmount,
        commission,
        message: `Votre paiement de ${tx.amount} FCFA a été validé. Vous recevez ${netAmount} FCFA après 10% de commission.`,
      });

      res.json({
        message: `Transaction #${id} confirmée ✅`,
        data: { id, operator_id: tx.operator_id, amount: tx.amount, netAmount, commission, status: "confirmée" },
      });
    } catch (err) {
      console.error("❌ Erreur PATCH /transactions/:id/confirm:", err);
      if (connection) { await connection.rollback(); connection.release(); }
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  return router;
};
