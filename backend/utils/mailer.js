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

export async function sendMail(to, subject, text) {
  if (!transporter) {
    console.warn("⚠️ SMTP non configuré: email ignoré");
    return;
  }
  try {
    await transporter.sendMail({
      from:
        process.env.MAIL_FROM ||
        `"TTM Admin" <${smtpUser}>`,
      to,
      subject,
      text,
    });
    console.log(`📧 Email envoyé à ${to}`);
  } catch (err) {
    console.error("❌ Erreur envoi email:", err);
    throw err;
  }
}
