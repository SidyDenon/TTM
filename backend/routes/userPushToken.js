import express from "express";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

export default (db) => {
  router.use(authMiddleware);

  //  Vérification basique d’un token Expo
  const isValidExpoToken = (token) =>
    typeof token === "string" &&
    (token.startsWith("ExponentPushToken[") ||
      token.startsWith("ExpoPushToken["));

  //  Enregistrement / mise à jour du token Expo Push
  router.post("/push-token", async (req, res) => {
    try {
      const { token, platform } = req.body;

      if (!token) {
        return res.status(400).json({ error: "Token manquant" });
      }

      if (!isValidExpoToken(token)) {
        return res.status(400).json({ error: "Token Expo invalide" });
      }

      // Vérifier que l'utilisateur existe
      const [[user]] = await db.query(
        "SELECT id FROM users WHERE id = ?",
        [req.user.id]
      );
      if (!user) {
        return res.status(404).json({ error: "Utilisateur introuvable" });
      }

      // 🧱 Upsert dans device_tokens (multi-appareils)
      try {
        await db.query(
          `
          INSERT INTO device_tokens (user_id, token, platform, last_seen_at, created_at)
          VALUES (?, ?, ?, NOW(), NOW())
          ON DUPLICATE KEY UPDATE
            user_id = VALUES(user_id),
            platform = VALUES(platform),
            last_seen_at = NOW()
        `,
          [req.user.id, token, platform || null]
        );
      } catch (e) {
        console.error(" Erreur INSERT device_tokens:", e.message || e);
        // on continue quand même, au pire on aura seulement users.notification_token
      }

      // Évite les push croisés: un même token ne doit pointer que vers un seul user.
      try {
        await db.query(
          `UPDATE users
           SET notification_token = NULL
           WHERE id <> ? AND notification_token = ?`,
          [req.user.id, token]
        );
      } catch (e) {
        console.error(" Erreur nettoyage token dupliqué:", e.message || e);
      }

      //  Compatibilité avec ton code existant : dernier device = notification_token
      try {
        await db.query(
          `UPDATE users
           SET notification_token = ?, updated_at = NOW()
           WHERE id = ?`,
          [token, req.user.id]
        );
      } catch (e) {
        console.error(" Erreur update users.notification_token:", e.message || e);
      }

      console.log(
        `📲 Expo token enregistré pour user #${req.user.id} (${platform || "unknown"}): ${token}`
      );

      res.json({
        message: "Token Expo enregistré avec succès ",
        token,
        platform: platform || null,
      });
    } catch (err) {
      console.error(" Erreur POST /user/push-token :", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // 🧹 Suppression d’un token (ex: logout, changement de téléphone)
  router.delete("/push-token", async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ error: "Token manquant" });
      }

      // On essaie de supprimer dans device_tokens (si la table existe)
      try {
        await db.query(
          "DELETE FROM device_tokens WHERE token = ? AND user_id = ?",
          [token, req.user.id]
        );
      } catch (e) {
        if (e?.code !== "ER_NO_SUCH_TABLE") {
          console.error(" Erreur delete device_tokens:", e.message || e);
        }
      }

      // Si c'était le token principal dans users.notification_token, on le vide
      try {
        await db.query(
          `UPDATE users
           SET notification_token = NULL
           WHERE id = ? AND notification_token = ?`,
          [req.user.id, token]
        );
      } catch (e) {
        console.error(" Erreur update users.notification_token (delete):", e.message || e);
      }

      console.log(
        `🧹 Expo token supprimé pour user #${req.user.id} : ${token}`
      );

      res.json({
        message: "Token Expo supprimé ",
      });
    } catch (err) {
      console.error(" Erreur DELETE /user/push-token :", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  return router;
};
