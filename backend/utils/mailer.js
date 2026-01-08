// utils/mailer.js
import nodemailer from "nodemailer";
import { SendMailClient } from "zeptomail";



const IS_PROD = String(process.env.NODE_ENV || "").toLowerCase() === "production";

// ================== ZEPTOMAIL API (PROD) ==================

const zeptoUrl = process.env.ZEPTO_URL || "https://api.zeptomail.com/v1.1/email";
const zeptoToken = process.env.ZEPTO_TOKEN || "";

const zeptoClient = zeptoToken
  ? new SendMailClient({ url: zeptoUrl, token: zeptoToken })
  : null;

async function sendMailViaZepto(to, subject, text = "", html = "", toName = "") {
  if (!zeptoClient) throw new Error("Missing ZEPTO_TOKEN (ZeptoMail API)");

  const fromAddress = process.env.MAIL_FROM;
  const fromName = process.env.MAIL_FROM_NAME || "Tow Truck Mali";
  if (!fromAddress) throw new Error("Missing MAIL_FROM");

  // ZeptoMail a besoin au minimum d’un htmlbody.
  const htmlbody =
    html ||
    (text ? `<pre style="font-family: Arial, sans-serif;">${escapeHtml(text)}</pre>` : "<div></div>");

  return zeptoClient.sendMail({
    from: { address: fromAddress, name: fromName },
    to: [{ email_address: { address: to, name: toName || "" } }],
    subject,
    htmlbody,
    // textbody est optionnel (selon API/SDK). On le met si présent.
    textbody: text || undefined,
  });
}

// Petite fonction pour éviter de casser le HTML si on injecte du text dans <pre>
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ================== SMTP ZOHO (DEV LOCAL) ==================

const smtpHost = process.env.SMTP_HOST || "smtp.zoho.com";
const smtpPort = Number(process.env.SMTP_PORT || 587);

const smtpSecure =
  String(process.env.SMTP_SECURE || "false").trim().toLowerCase() === "true";

const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

const smtpFrom =
  process.env.MAIL_FROM ||
  (smtpUser ? `Tow Truck Mali <${smtpUser}>` : undefined);

// Fallback automatique (587 <-> 465)
const fallbackHost = process.env.SMTP_FALLBACK_HOST || smtpHost;
const fallbackPort = Number(process.env.SMTP_FALLBACK_PORT || (smtpPort === 465 ? 587 : 465));
const fallbackSecure =
  String(process.env.SMTP_FALLBACK_SECURE || (fallbackPort === 465 ? "true" : "false"))
    .trim()
    .toLowerCase() === "true";

if (!smtpUser || !smtpPass) {
  console.warn("⚠️ SMTP Zoho non configuré (SMTP_USER / SMTP_PASS manquants)");
}

const transporterDefs = [];

if (smtpUser && smtpPass) {
  const baseOptions = {
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure, // false pour 587 (STARTTLS), true pour 465
    auth: { user: smtpUser, pass: smtpPass },
    requireTLS: smtpPort === 587, // aide STARTTLS
    connectionTimeout: 20000,
    socketTimeout: 20000,
    greetingTimeout: 15000,
  };
  transporterDefs.push({ label: "primary", options: baseOptions });

  const fallbackOptions = {
    ...baseOptions,
    host: fallbackHost,
    port: fallbackPort,
    secure: fallbackSecure,
    requireTLS: fallbackPort === 587,
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
  transporters.forEach(({ label, options }) => {
    console.log("📧 SMTP Zoho configuré :", {
      label,
      host: options.host,
      port: options.port,
      secure: options.secure,
      user: smtpUser,
    });
  });
}

// ================== API UNIQUE ==================

/**
 * Utilisation partout dans ton code:
 * await sendMail("client@email.com", "Sujet", "texte", "<b>html</b>", "Nom")
 */
export async function sendMail(to, subject, text = "", html = "", toName = "") {
  // ✅ PROD Railway: ZeptoMail API
  if (IS_PROD) {
    const resp = await sendMailViaZepto(to, subject, text, html, toName);
    console.log(`📧 Email envoyé à ${to} via ZeptoMail API`);
    return resp;
  }

  // ✅ DEV local: Zoho SMTP
  if (!transporters.length) {
    console.warn("⚠️ Aucun transport SMTP disponible: email ignoré");
    return;
  }

  if (!smtpFrom) {
    console.warn("⚠️ MAIL_FROM non défini: l'expéditeur sera égal à SMTP_USER par défaut");
  }

  const mail = {
    from: smtpFrom || smtpUser,
    to,
    subject,
    text: text || undefined,
    html: html || undefined,
  };

  let lastError = null;

  for (const { label, transporter, options } of transporters) {
    try {
      const info = await transporter.sendMail(mail);
      console.log(
        `📧 Email envoyé à ${to} via Zoho SMTP [${label}] (${options.host}:${options.port}) (messageId: ${info.messageId})`
      );
      return info;
    } catch (err) {
      lastError = err;
      console.error(
        `❌ Envoi via Zoho SMTP [${label}] (${options.host}:${options.port}) échoué:`,
        err?.code || err?.message || err
      );
    }
  }

  console.error("❌ Erreur envoi email via Zoho SMTP (toutes les tentatives échouées)", {
    message: lastError?.message,
    code: lastError?.code,
    response: lastError?.response,
  });

  throw lastError || new Error("Aucun transport SMTP disponible");
}
