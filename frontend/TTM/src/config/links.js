export const RAW_WHATSAPP_NUMBER = "0022373585046";
export const RAW_SUPPORT_PHONE = "+22373585046";
export const RAW_SUPPORT_EMAIL = "support@ttm.com";

export const DEFAULT_MESSAGES = {
  generalInquiry: "Bonjour 👋, j’aimerais avoir des informations sur vos services TTM.",
  appInfo: "Bonjour 👋, j’aimerais en savoir plus sur l’app TTM.",
  faqQuestion: "Bonjour 👋, j’ai une question à propos de vos services TTM.",
};

export const NAV_LINKS = [
  { href: "#", label: "Accueil" },
  { href: "#histoire", label: "Notre Histoire" },
  { href: "#services", label: "Services" },
  { href: "#avis", label: "Avis" },
  { href: "#tarifs", label: "Tarifs" },
  { href: "#faq", label: "FAQ" },
];

export const normalizeWhatsAppNumber = (value = RAW_WHATSAPP_NUMBER) => {
  let phone = String(value).replace(/\D/g, "");
  if (phone.startsWith("00")) phone = phone.slice(2);
  return phone;
};

export const buildWhatsAppLink = (message = DEFAULT_MESSAGES.generalInquiry, phone = RAW_WHATSAPP_NUMBER) => {
  const normalized = normalizeWhatsAppNumber(phone);
  const safeMessage = message?.trim() ? message : DEFAULT_MESSAGES.generalInquiry;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(safeMessage)}`;
};

export const buildServiceRequestMessage = (service) => {
  const title = service?.title || "Service";
  const amount = service?.amount || "—";
  return `Bonjour 👋, je souhaite *demander le service* "${title}"\n\n💰 Tarif indiqué : ${amount}\n👤 Nom : [Votre nom]\n📞 Téléphone : [Votre numéro]\n📍 Localisation (lien GMaps) : [collez ici]\n⚡ Urgence : [Oui / Non]\nℹ️ Détails : [optionnel]\n\nMerci de me recontacter rapidement.`;
};

export const buildServiceRequestLink = (service) => buildWhatsAppLink(buildServiceRequestMessage(service));

// Optionnel : récupérer la config support depuis l'API backend (si dispo)
import { resolveApiBase, resolveApiBaseAsync } from "./api";

export async function fetchSupportConfig(apiBase = "") {
  try {
    const base = apiBase || await resolveApiBaseAsync();
    if (!base) return { phone: RAW_SUPPORT_PHONE, whatsapp: RAW_WHATSAPP_NUMBER, email: RAW_SUPPORT_EMAIL };
    const normalized = base.replace(/\/+$/, "");
    const res = await fetch(`${normalized}/api/config/public`);
    const data = await res.json();
    return {
      phone: data.support_phone || RAW_SUPPORT_PHONE,
      whatsapp: data.support_whatsapp || RAW_WHATSAPP_NUMBER,
      email: data.support_email || RAW_SUPPORT_EMAIL,
    };
  } catch {
    return { phone: RAW_SUPPORT_PHONE, whatsapp: RAW_WHATSAPP_NUMBER, email: RAW_SUPPORT_EMAIL };
  }
}
