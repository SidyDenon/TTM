export const normalizeServiceName = (value?: string | null) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const isTowingService = (value?: string | null) => {
  const normalized = normalizeServiceName(value);
  return normalized.includes("remorqu") || normalized.includes("tow");
};

export const isHomeOilService = (value?: string | null) => {
  const normalized = normalizeServiceName(value);
  return (
    normalized.includes("domicile") ||
    normalized.includes("huile") ||
    normalized.includes("oil") ||
    normalized.includes("vidange") ||
    normalized === "oil_service"
  );
};

export const getResponderLabel = (serviceName?: string | null) =>
  isTowingService(serviceName) ? "remorqueur" : "intervenant";

export const getRespondersLabel = (serviceName?: string | null) =>
  isTowingService(serviceName) ? "remorqueurs" : "intervenants";