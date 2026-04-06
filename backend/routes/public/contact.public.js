import express from "express";
import { sendMail } from "../../utils/mailer.js";

const router = express.Router();

const isValidEmail = (value = "") =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());

export default (db) => {
  router.post("/", async (req, res) => {
    try {
      const name = String(req.body?.name || "").trim();
      const email = String(req.body?.email || "").trim();
      const message = String(req.body?.message || "").trim();

      if (!name || !email || !message) {
        return res.status(400).json({ error: "name, email et message sont requis" });
      }
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: "email invalide" });
      }
      if (message.length < 10) {
        return res.status(400).json({ error: "message trop court" });
      }

      let supportEmail = process.env.MAIL_FROM || "support@ttm.com";
      try {
        const [[cfg]] = await db.query(
          "SELECT support_email FROM configurations LIMIT 1"
        );
        if (cfg?.support_email) supportEmail = cfg.support_email;
      } catch {}

      const esc = (s) => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
      await sendMail(
        supportEmail,
        `Nouveau message site vitrine - ${name}`,
        `Nom: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
        `
          <h3>Nouveau message site vitrine</h3>
          <p><b>Nom:</b> ${esc(name)}</p>
          <p><b>Email:</b> ${esc(email)}</p>
          <p><b>Message:</b></p>
          <pre style="white-space:pre-wrap;font-family:inherit">${esc(message)}</pre>
        `
      );

      return res.json({ ok: true, message: "Message envoyé ✅" });
    } catch (err) {
      console.error("❌ POST /api/contact/public:", err);
      return res.status(500).json({ error: "Erreur envoi message" });
    }
  });

  return router;
};
