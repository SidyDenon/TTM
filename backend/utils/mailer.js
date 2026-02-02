// utils/mailer.js
import { SendMailClient } from "zeptomail";

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

  const htmlbody =
    html ||
    (text ? `<pre style="font-family: Arial, sans-serif;">${escapeHtml(text)}</pre>` : "<div></div>");

  return zeptoClient.sendMail({
    from: { address: fromAddress, name: fromName },
    to: [{ email_address: { address: to, name: toName || "" } }],
    subject,
    htmlbody,
    textbody: text || undefined,
  });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}



export async function sendMail(to, subject, text = "", html = "", toName = "") {
  if (!zeptoClient) {
    console.warn("⚠️ ZEPTO_TOKEN manquant: envoi email ignoré");
    return;
  }

  try {
    const resp = await sendMailViaZepto(to, subject, text, html, toName);
    console.log(`📧 Email envoyé à ${to} via ZeptoMail API`);
    return resp;
  } catch (err) {
    const message =
      err?.message ||
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      (typeof err === "string" ? err : "") ||
      "Erreur ZeptoMail inconnue";
    console.error("❌ Envoi via ZeptoMail API échoué", {
      message,
      code: err?.code,
      status: err?.response?.status,
      data: err?.response?.data,
      name: err?.name,
      cause: err?.cause,
      stack: err?.stack,
      raw: err,
    });
    const wrapped = new Error(message);
    wrapped.cause = err;
    throw wrapped;
  }
}
