// utils/mailer.js
import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure =
  typeof process.env.SMTP_SECURE !== "undefined"
    ? String(process.env.SMTP_SECURE).trim() === "true"
    : smtpPort === 465;
const smtpUser = process.env.SMTP_USER || process.env.MAIL_USER;
const smtpPass = process.env.SMTP_PASS || process.env.MAIL_PASS;
const smtpPool = String(process.env.SMTP_POOL || "true").toLowerCase() !== "false";

const connectionTimeout = Number(process.env.SMTP_CONN_TIMEOUT || 10000);
const socketTimeout = Number(process.env.SMTP_SOCKET_TIMEOUT || 10000);
const greetingTimeout = Number(process.env.SMTP_GREETING_TIMEOUT || 8000);

export const transporter =
  smtpUser && smtpPass
    ? nodemailer.createTransport({
        pool: smtpPool,
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: smtpUser, pass: smtpPass },
        connectionTimeout,
        socketTimeout,
        greetingTimeout,
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
    pool: smtpPool,
    connectionTimeout,
    socketTimeout,
    greetingTimeout,
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
