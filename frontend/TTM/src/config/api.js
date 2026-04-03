const stripSlash = (value = "") => String(value).replace(/\/+$/, "");

const PROD_BASE = "https://ttm-production-d022.up.railway.app";

/**
 * Retourne la liste des bases à essayer dans l'ordre :
 * - En local : [localhost:5000, prod]
 * - En prod  : [prod]
 */
export function getBaseCandidates() {
  const envBase =
    typeof import.meta !== "undefined" ? import.meta.env.VITE_API_BASE || "" : "";
  if (envBase) return [stripSlash(envBase)];

  if (typeof window === "undefined") return [PROD_BASE];

  const { protocol, hostname } = window.location;
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local") ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("172.");

  if (isLocal) {
    return [stripSlash(`${protocol}//${hostname}:5000`), PROD_BASE];
  }

  return [PROD_BASE];
}

// Compatibilité avec l'ancien code
export function resolveApiBase() {
  return getBaseCandidates()[0];
}
export async function resolveApiBaseAsync() {
  return resolveApiBase();
}
