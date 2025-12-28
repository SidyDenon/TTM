// utils/mailer.js
import nodemailer from "nodemailer";

// ================== SENDGRID (PROD / RENDER) ==================
let sendgridEnabled = false;
let sgMail = null;
if (process.env.SENDGRID_API_KEY) {
  try {
    const mod = await import("@sendgrid/mail");
    sgMail = mod.default || mod;
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    sendgridEnabled = true;
    console.log("📧 SendGrid configuré (API KEY détectée)");
  } catch (err) {
    console.warn(
      "⚠️ SendGrid non chargé (package manquant ou erreur d'init) – fallback SMTP.",
      err?.message || err
    );
  }
}

// ================== SMTP (LOCAL / DEV) ==================
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

const fallbackHost = process.env.SMTP_FALLBACK_HOST || smtpHost;
const fallbackPortEnv = process.env.SMTP_FALLBACK_PORT;
const fallbackPort =
  typeof fallbackPortEnv !== "undefined"
    ? Number(fallbackPortEnv)
    : smtpPort === 465
    ? 587
    : 465;
const fallbackSecure =
  typeof process.env.SMTP_FALLBACK_SECURE !== "undefined"
    ? String(process.env.SMTP_FALLBACK_SECURE).trim() === "true"
    : fallbackPort === 465;

const transporterDefs = [];

if (smtpUser && smtpPass) {
  const baseOptions = {
    pool: smtpPool,
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: { user: smtpUser, pass: smtpPass },
    connectionTimeout,
    socketTimeout,
    greetingTimeout,
  };
  transporterDefs.push({ label: "primary", options: baseOptions });

  const fallbackOptions = {
    ...baseOptions,
    host: fallbackHost,
    port: fallbackPort,
    secure: fallbackSecure,
  };
  const isDifferent =
    fallbackOptions.host !== baseOptions.host ||
    fallbackOptions.port !== baseOptions.port ||
    fallbackOptions.secure !== baseOptions.secure;
  if (isDifferent) {
    transporterDefs.push({ label: "fallback", options: fallbackOptions });
  }
}

export const transporters = transporterDefs.map(({ label, options }) => ({
  label,
  transporter: nodemailer.createTransport(options),
  options,
}));

export const transporter = transporters[0]?.transporter || null;

if (transporters.length) {
  const masked =
    smtpUser && smtpUser.length > 3
      ? `${smtpUser.slice(0, 2)}***${smtpUser.slice(-2)}`
      : smtpUser || "undefined";

  transporters.forEach(({ label, options }) => {
    console.log("📧 SMTP configuré", {
      label,
      host: options.host,
      port: options.port,
      secure: options.secure,
      user: masked,
      pool: options.pool,
      connectionTimeout: options.connectionTimeout,
      socketTimeout: options.socketTimeout,
      greetingTimeout: options.greetingTimeout,
    });
  });
} else {
  console.warn("⚠️ SMTP non configuré: SMTP_USER / SMTP_PASS manquants (utilisé seulement en dev)");
}

const defaultFrom =
  process.env.MAIL_FROM ||
  (smtpUser ? `"TTM Admin" <${smtpUser}>` : "no-reply@towtruckmali.com");

// ================== FONCTION D'ENVOI UNIQUE ==================
export async function sendMail(to, subject, text = "", html = "") {
  const mail = {
    from: defaultFrom,
    to,
    subject,
    text: text || undefined,
    html: html || undefined,
  };

  // 1️⃣ PROD / RENDER → SENDGRID
  if (sendgridEnabled && sgMail) {
    try {
      await sgMail.send(mail);
      console.log(`📧 Email envoyé via SendGrid à ${to}`);
      return;
    } catch (err) {
      console.error("❌ Erreur envoi email via SendGrid:", err.response?.body || err);
      throw err;
    }
  }

  // 2️⃣ DEV / LOCAL → SMTP (Nodemailer)
  if (!transporters.length) {
    console.warn("⚠️ Aucun transport SMTP configuré: email ignoré");
    return;
  }

  let lastError = null;
  for (const { label, transporter, options } of transporters) {
    try {
      await transporter.sendMail(mail);
      console.log(
        `📧 Email envoyé à ${to} via ${label} (${options.host}:${options.port})`
      );
      return;
    } catch (err) {
      lastError = err;
      console.error(
        `❌ Envoi via ${label} (${options.host}:${options.port}) échoué:`,
        err.code || err.message || err
      );
    }
  }

  console.error("❌ Erreur envoi email (toutes les tentatives SMTP):", lastError);
  throw lastError || new Error("Aucun transport SMTP disponible");
}
