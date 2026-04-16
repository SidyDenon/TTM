import cron from "node-cron";
import { sendPushNotification } from "../utils/sendPush.js";

const REQUEST_AUTO_CANCEL_MINUTES = Number(
  process.env.REQUEST_AUTO_CANCEL_MINUTES || 5
);

export function startCron({ db, emitMissionEvent }) {
  cron.schedule("0 0 * * *", async () => {
    try {
      const [result] = await db.query(
        "UPDATE users SET reset_code = NULL, reset_expires = NULL WHERE reset_expires < NOW()"
      );
      console.log(`🧹 Nettoyage tokens expirés : ${result.affectedRows} ligne(s)`);
    } catch (err) {
      console.error("❌ Erreur cron nettoyage:", err);
    }
  });

  // Auto-annulation des demandes "publiee" non acceptées
  cron.schedule("* * * * *", async () => {
    try {
      if (!Number.isFinite(REQUEST_AUTO_CANCEL_MINUTES) || REQUEST_AUTO_CANCEL_MINUTES <= 0) {
        return;
      }

      const [rows] = await db.query(
        `SELECT r.id, r.user_id
         FROM requests r
         WHERE r.status = 'publiee'
           AND (r.operator_id IS NULL OR r.operator_id = 0)
           AND COALESCE(LOWER(r.service_type), '') <> 'oil_service'
           AND COALESCE(LOWER(r.service), '') <> 'oil_service'
           AND r.created_at <= (NOW() - INTERVAL ? MINUTE)
         LIMIT 200`,
        [REQUEST_AUTO_CANCEL_MINUTES]
      );

      if (!rows.length) return;

      const ids = rows.map((r) => r.id);
      const placeholders = ids.map(() => "?").join(",");

      await db.query(
        `UPDATE requests
         SET status = 'annulee_admin'
         WHERE id IN (${placeholders})`,
        ids
      );

      for (const r of rows) {
        try {
          await db.query(
            "INSERT INTO request_events (request_id, type, meta, created_at) VALUES (?, 'annulee_admin', ?, NOW())",
            [
              r.id,
              JSON.stringify({
                reason: "timeout",
                minutes: REQUEST_AUTO_CANCEL_MINUTES,
              }),
            ]
          );
        } catch {}

        if (emitMissionEvent) {
          emitMissionEvent(
            "mission:status_changed",
            { id: r.id, status: "annulee_admin" },
            { clientId: r.user_id, operators: true }
          );
          emitMissionEvent(
            "mission:updated",
            { id: r.id, status: "annulee_admin" },
            { clientId: r.user_id, operators: true }
          );
        }

        try {
          const [[userRow]] = await db.query(
            "SELECT notification_token FROM users WHERE id = ? LIMIT 1",
            [r.user_id]
          );
          if (userRow?.notification_token) {
            await sendPushNotification(
              userRow.notification_token,
              "Mission expirée",
              "Aucun opérateur n’a accepté votre demande. Réessayez.",
              {
                type: "mission_timeout",
                request_id: Number(r.id),
                status: "annulee_admin",
              }
            );
          }
        } catch (err) {
          console.warn("⚠️ Push mission_timeout échoué:", err?.message || err);
        }
      }

      console.log(`⏱️ Auto-cancel missions: ${rows.length}`);
    } catch (err) {
      console.error("❌ Erreur cron auto-cancel:", err);
    }
  });
}
