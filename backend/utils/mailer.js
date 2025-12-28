// utils/mailer.js
import nodemailer from "nodemailer";

// ================== SMTP ZOHO ==================

const smtpHost = process.env.SMTP_HOST || "smtp.zoho.com";
const smtpPort = Number(process.env.SMTP_PORT || 587);

// SMTP_SECURE doit être "true" ou "false" dans .env
const smtpSecure =
  String(process.env.SMTP_SECURE || "false").trim().toLowerCase() === "true";

const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom =
  process.env.MAIL_FROM ||
  (smtpUser ? `"Tow Truck Mali" <${smtpUser}>` : undefined);

if (!smtpUser || !smtpPass) {
  console.warn("⚠️ SMTP Zoho non configuré (SMTP_USER / SMTP_PASS manquants)");
}

export const transporter =
  smtpUser && smtpPass
    ? nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure, // false pour 587 (STARTTLS), true pour 465
        auth: { user: smtpUser, pass: smtpPass },
        // optionnel mais propre :
        connectionTimeout: 10000,
        socketTimeout: 10000,
        greetingTimeout: 8000,
      })
    : null;

if (transporter) {
  console.log("📧 SMTP Zoho configuré :", {
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    user: smtpUser,
  });
}

// ================== FONCTION D'ENVOI UNIQUE ==================

export async function sendMail(to, subject, text = "", html = "") {
  if (!transporter) {
    console.warn("⚠️ Aucun transport SMTP disponible: email ignoré");
    return;
  }

  if (!smtpFrom) {
    console.warn(
      "⚠️ MAIL_FROM non défini: l'expéditeur sera égal à SMTP_USER par défaut"
    );
  }

  const mail = {
    from: smtpFrom || smtpUser,
    to,
    subject,
    text: text || undefined,
    html: html || undefined,
  };

  try {
    const info = await transporter.sendMail(mail);
    console.log(
      `📧 Email envoyé à ${to} via Zoho SMTP (messageId: ${info.messageId})`
    );
    return info;
  } catch (err) {
    console.error("❌ Erreur envoi email via Zoho SMTP:", {
      message: err.message,
      code: err.code,
      response: err.response,
    });
    throw err;
  }
}
