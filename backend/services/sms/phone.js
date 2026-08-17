export const normalizePhone = (raw) => {
  let digits = String(raw || "").replace(/[^\d+]/g, "");
  if (!digits) throw new Error("Numéro de téléphone requis");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (digits.startsWith("+")) digits = `+${digits.slice(1).replace(/\D/g, "")}`;
  else {
    digits = digits.replace(/\D/g, "");
    digits = digits.startsWith("223") ? `+${digits}` : `+223${digits}`;
  }
  if (!/^\+[1-9]\d{7,14}$/.test(digits)) {
    throw new Error("Numéro de téléphone invalide");
  }
  return digits;
};

export const normalizeMessage = (message) => {
  const content = String(message || "").trim();
  if (!content) throw new Error("Message SMS vide");
  if (content.length > 480) throw new Error("Message SMS trop long");
  return content;
};
