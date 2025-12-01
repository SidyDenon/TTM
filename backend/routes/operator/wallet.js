import express from "express";
import authMiddleware from "../../middleware/auth.js";
import { io } from "../../server.js";
import { getCommissionPercent } from "../../utils/commission.js";
import { getSchemaColumns } from "../../utils/schema.js";

const router = express.Router();

// 🔧 Rôles opérateur possibles
const OPERATOR_ROLES = ["operator", "operateur", "opérateur"];

// 🔧 Calcule le total net des gains confirmés pour un opérateur
async function getTotalGainsNet(db, operatorUserId, commissionPercent) {
  const COMM = commissionPercent / 100;
  let totalGainsNet = 0;

  // 1️⃣ Tentative: utiliser la colonne commission si elle existe
  try {
    const [[rowNet]] = await db.query(
      `SELECT COALESCE(SUM(amount - COALESCE(commission, 0)), 0) AS totalNet
       FROM transactions
       WHERE operator_id = ? AND status = 'confirmée'`,
      [operatorUserId]
    );
    totalGainsNet = Number(rowNet.totalNet || 0);
  } catch (e) {
    // 2️⃣ Fallback: calculer à partir du montant + pourcentage (ancienne structure)
    if (e?.code !== "ER_BAD_FIELD_ERROR" && e?.code !== "ER_NO_SUCH_TABLE") {
      throw e;
    }
    const [[rowOld]] = await db.query(
      `SELECT COALESCE(SUM(amount * ?), 0) AS totalGains
       FROM transactions
       WHERE operator_id = ? AND status = 'confirmée'`,
      [1 - COMM, operatorUserId]
    );
    totalGainsNet = Number(rowOld.totalGains || 0);
  }

  return totalGainsNet;
}

// 🔧 Somme totale des retraits approuvés
async function getTotalRetraits(db, operatorId) {
  try {
    const [[row]] = await db.query(
      `SELECT COALESCE(SUM(amount), 0) AS totalRetraits
       FROM withdrawals
       WHERE operator_id = ? AND status = 'approuvée'`,
      [operatorId]
    );
    return Number(row.totalRetraits || 0);
  } catch (e) {
    if (e?.code === "ER_NO_SUCH_TABLE") return 0;
    throw e;
  }
}

export default (db) => {
  router.use((req, _res, next) => {
    req.db = db;
    next();
  });

  // 💰 Récupérer solde + historique complet
  router.get("/", authMiddleware, async (req, res) => {
    const role = String(req.user.role || "").toLowerCase();
    if (!OPERATOR_ROLES.includes(role)) {
      return res.status(403).json({ error: "Accès refusé" });
    }

    try {
      // 🔹 Récupérer l’ID opérateur + soldes éventuels
      const [[operator]] = await req.db.query(
        "SELECT id, balance, pending_balance, is_internal FROM operators WHERE user_id = ?",
        [req.user.id]
      );

      if (!operator) {
        return res.status(404).json({ error: "Profil opérateur introuvable" });
      }

      const operatorId = operator.id; // id dans table operators
      const operatorUserId = req.user.id; // id dans table users

      // 💰 Total des gains nets confirmés (en fonction de la commission)
      const commissionPercentRaw = await getCommissionPercent(req.db);
      const commissionPercent =
        operator?.is_internal ? 0 : commissionPercentRaw;

      const totalGainsNet = await getTotalGainsNet(req.db, operatorUserId, commissionPercent);

      // 💸 Total des retraits approuvés
      const totalRetraits = await getTotalRetraits(req.db, operatorId);

      // ✅ Solde disponible pour retrait = gains nets confirmés - retraits approuvés
      const solde = totalGainsNet - totalRetraits;

      // 📜 Historique des transactions (toutes, même en_attente)
      let transactions = [];
      const COMM = commissionPercent / 100;

      try {
        const [rowsTx] = await req.db.query(
          `SELECT id, request_id, amount, currency, status, created_at, commission
           FROM transactions
           WHERE operator_id = ?
           ORDER BY created_at DESC`,
          [operatorUserId]
        );
        transactions = rowsTx.map((t) => {
          const comm =
            t.commission != null
              ? Number(t.commission)
              : Number(t.amount) * COMM;
          const net = Number(t.amount) - comm;
          return {
            id: t.id,
            request_id: t.request_id,
            amount: Number(t.amount),
            net,
            commission: comm,
            currency: t.currency || "FCFA",
            status: t.status,
            created_at: t.created_at,
            type: "gain",
          };
        });
      } catch (e) {
        if (e?.code !== "ER_BAD_FIELD_ERROR" && e?.code !== "ER_NO_SUCH_TABLE") {
          throw e;
        }
        // Fallback si pas de colonne commission ou pas de table
        const [rowsTx] = await req.db
          .query(
            `SELECT id, request_id, amount, currency, status, created_at
             FROM transactions
             WHERE operator_id = ?
             ORDER BY created_at DESC`,
            [operatorUserId]
          )
          .catch(() => [[]]);

        transactions = rowsTx.map((t) => {
          const comm = Number(t.amount) * COMM;
          const net = Number(t.amount) - comm;
          return {
            id: t.id,
            request_id: t.request_id,
            amount: Number(t.amount),
            net,
            commission: comm,
            currency: t.currency || "FCFA",
            status: t.status,
            created_at: t.created_at,
            type: "gain",
          };
        });
      }

      // 📜 Historique des retraits
      let withdrawals = [];
      try {
        const [rowsW] = await req.db.query(
          `SELECT id, amount, currency, status, created_at, method, phone
           FROM withdrawals
           WHERE operator_id = ?
           ORDER BY created_at DESC`,
          [operatorId]
        );
        withdrawals = rowsW.map((w) => ({
          id: w.id,
          amount: Number(w.amount),
          currency: w.currency || "FCFA",
          status: w.status,
          created_at: w.created_at,
          method: w.method,
          phone: w.phone,
          type: "retrait",
        }));
      } catch (e) {
        if (e?.code !== "ER_NO_SUCH_TABLE") throw e;
        withdrawals = [];
      }

      // 🔹 Fusionner les historiques
      const historique = [...transactions, ...withdrawals].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );

      res.json({
        message: "💰 Wallet chargé avec succès",
        solde,
        // infos complémentaires (optionnel pour ton front)
        balance: Number(operator.balance || 0),
        pending_balance: Number(operator.pending_balance || 0),
        commission_percent: commissionPercent,
        is_internal: !!operator.is_internal,
        transactions: historique,
      });
    } catch (err) {
      console.error("❌ Erreur GET /operator/wallet:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // 📤 Demande de retrait
  router.post("/withdraw", authMiddleware, async (req, res) => {
    const role = String(req.user.role || "").toLowerCase();
    if (!OPERATOR_ROLES.includes(role)) {
      return res.status(403).json({ error: "Accès refusé" });
    }

    try {
      const { amount, phone, method } = req.body;
      const montant = Number(amount);

      if (!montant || !Number.isFinite(montant) || montant <= 0) {
        return res.status(400).json({ error: "Montant invalide" });
      }

      if (!phone || !method) {
        return res.status(400).json({ error: "Informations incomplètes" });
      }

      // 🔹 Récupérer opérateur
      const [[operator]] = await req.db.query(
        "SELECT id FROM operators WHERE user_id = ?",
        [req.user.id]
      );

      if (!operator) {
        return res.status(404).json({ error: "Profil opérateur introuvable" });
      }

      const operatorId = operator.id; // operators.id
      const operatorUserId = req.user.id; // users.id

      // 💰 Recalculer solde disponible
      const totalGainsNet = await getTotalGainsNet(req.db, operatorUserId);
      const totalRetraits = await getTotalRetraits(req.db, operatorId);
      const soldeDispo = totalGainsNet - totalRetraits;

      if (montant > soldeDispo) {
        return res
          .status(400)
          .json({ error: "Montant supérieur au solde disponible" });
      }

      // ✅ Insérer la demande
      const [result] = await req.db.query(
        `INSERT INTO withdrawals (operator_id, amount, currency, status, phone, method, created_at)
         VALUES (?, ?, 'FCFA', 'en_attente', ?, ?, NOW())`,
        [operatorId, montant, phone, method]
      );

      const withdrawalId = result.insertId;

      // 🔎 Récupérer le nom de l’opérateur (pour l’admin)
      const [[user]] = await req.db.query(
        `SELECT u.name 
         FROM users u
         JOIN operators o ON o.user_id = u.id
         WHERE o.id = ?`,
        [operatorId]
      );

      // 📡 Notifier les admins
      io.to("admins").emit("withdrawal_created", {
        id: withdrawalId,
        operator_id: operatorId,
        operator_name: user?.name || "Opérateur",
        amount: montant,
        phone,
        method,
        status: "en_attente",
        currency: "FCFA",
        created_at: new Date().toISOString(),
      });

      console.log(
        `📢 "withdrawal_created" envoyé à tous les admins (#${withdrawalId})`
      );

      res.json({
        message: "✅ Demande de retrait enregistrée",
        data: { id: withdrawalId, amount: montant, status: "en_attente" },
      });
    } catch (err) {
      console.error("❌ Erreur POST /operator/wallet/withdraw:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  return router;
};
