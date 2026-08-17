import express from "express";
import authMiddleware from "../../middleware/auth.js";
import { requireClient } from "../../middleware/requireRole.js";

const router = express.Router();

export default function feedbackRoutes(db) {
  router.use((req, _res, next) => {
    req.db = db;
    next();
  });

  router.post("/", authMiddleware, requireClient, async (req, res) => {
    try {
      const missionId = Number(req.body?.mission_id);
      const rating = Number(req.body?.rating);
      const comment = String(req.body?.comment || "").trim().slice(0, 2000);

      if (!Number.isInteger(missionId) || missionId <= 0) {
        return res.status(400).json({ error: "Mission invalide" });
      }
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "La note doit être comprise entre 1 et 5" });
      }

      const [[mission]] = await req.db.query(
        "SELECT id, operator_id, status FROM requests WHERE id = ? AND user_id = ? LIMIT 1",
        [missionId, req.user.id]
      );
      if (!mission) return res.status(404).json({ error: "Mission introuvable" });
      if (mission.status !== "terminee") {
        return res.status(409).json({ error: "La mission doit être terminée avant l’avis" });
      }
      const [[payment]] = await req.db.query(
        `SELECT t.status, t.payment_method,
                EXISTS(
                  SELECT 1 FROM request_events re
                  WHERE re.request_id = ? AND re.type = 'cash_received_operator'
                ) AS cash_received
         FROM transactions t
         WHERE t.request_id = ? ORDER BY t.id DESC LIMIT 1`,
        [missionId, missionId]
      );
      const paymentValidated =
        String(payment?.status || "").toLowerCase() === "confirmée" ||
        String(payment?.payment_method || "").toLowerCase() === "mobile_money" ||
        (String(payment?.payment_method || "").toLowerCase() === "cash" &&
          Boolean(payment?.cash_received));
      if (!paymentValidated) {
        return res.status(409).json({ error: "Le paiement doit être confirmé avant l’avis" });
      }

      await req.db.query(
        `INSERT INTO mission_feedback
           (request_id, user_id, operator_id, rating, comment, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), updated_at = NOW()`,
        [missionId, req.user.id, mission.operator_id || null, rating, comment || null]
      );

      res.status(201).json({
        message: "Avis enregistré",
        data: { mission_id: missionId, rating, comment },
      });
    } catch (err) {
      console.error(" Erreur POST /feedback:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  return router;
}
