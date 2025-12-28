// utils/mailer.js
import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure = smtpPort === 465;
const smtpUser = process.env.SMTP_USER || process.env.MAIL_USER;
const smtpPass = process.env.SMTP_PASS || process.env.MAIL_PASS;

export const transporter =
  smtpUser && smtpPass
    ? nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: smtpUser, pass: smtpPass },
      })
    : null;

if (transporter) {
  const masked =
    smtpUser && smtpUser.length > 3
      ? `${smtpUser.slice(0, 2)}***${smtpUser.slice(-2)}`
      : smtpUser || "undefined";
  console.log("📧 SMTP configuré", {
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    user: masked,
  });
} else {
  console.warn("⚠️ SMTP non configuré: SMTP_USER / SMTP_PASS manquants");
}

export async function sendMail(
  to,
  subject,
  text = "",
  html = ""
) {
  if (!transporter) {
    console.warn("⚠️ SMTP non configuré: email ignoré");
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || `"TTM Admin" <${smtpUser}>`,
      to,
      subject,
      text: text || undefined,
      html: html || undefined,
    });
    console.log(`📧 Email envoyé à ${to}`);
  } catch (err) {
    console.error("❌ Erreur envoi email:", err);
    throw err;
  }
}
