// ============================================================
// 🌍 CONFIG BACKEND (auto local → prod)
// ============================================================
const PROD_BASE = "https://ttm-production-d022.up.railway.app";
const LOCAL_BASE = "http://localhost:5000";
const LOCAL_LOOPBACK = "http://127.0.0.1:5000";

// Valeur courante (host sans /api)
export let API_BASE = PROD_BASE;
// URL WebSocket (même host que l’API, sans /api)
export let SOCKET_URL = API_BASE;

// ---------------------- ping test ----------------------
async function testLocalBackend(url) {
  const base = String(url || "").replace(/\/+$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const res = await fetch(`${base}/api/ping`, {
      method: "GET",
      mode: "no-cors", // évite l’échec si le CORS n’est pas configuré en dev
      signal: controller.signal,
    });
    // En no-cors, res.type === "opaque" → on considère que le backend répond
    return res.ok || res.type === "opaque";
  } catch (err) {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------- auto-init ----------------------
// À appeler AVANT de monter React (main.jsx)
export async function initApiBase() {
  // prioritaire : env override (ex: VITE_API_BASE)
  const envBase = import.meta.env.VITE_API_BASE;
  if (envBase) {
    API_BASE = String(envBase).replace(/\/+$/, "");
    SOCKET_URL = API_BASE;
    if (import.meta.env.DEV) {
      console.log("🔧 API sélectionnée (admin, env) :", API_BASE);
    }
    return;
  }

  // Liste des candidats locaux à tester
  const preferredLocal = import.meta.env.VITE_LOCAL_BASE
    ? String(import.meta.env.VITE_LOCAL_BASE).replace(/\/+$/, "")
    : LOCAL_BASE;
  const candidates = [preferredLocal, LOCAL_LOOPBACK].filter(
    (v, idx, arr) => v && arr.indexOf(v) === idx
  );

  let resolved = PROD_BASE;
  for (const candidate of candidates) {
    const ok = await testLocalBackend(candidate);
    if (ok) {
      resolved = candidate;
      break;
    }
  }

  API_BASE = resolved;
  SOCKET_URL = API_BASE; // même host pour Socket.IO

  if (import.meta.env.DEV) {
    console.log("🔧 API sélectionnée (admin) :", API_BASE);
  }
}

// ---------------------- getters ----------------------
export function getApiBase() {
  // ex: http://localhost:5000 OU https://ttm-production...
  return API_BASE.replace(/\/+$/, "");
}

export function getApiUrl() {
  // ex: http://localhost:5000/api
  return `${getApiBase()}/api`;
}

// ---------------------- helpers ----------------------
export const apiUrl = (path = "") => {
  const base = getApiUrl();
  const p = String(path || "");
  if (!p) return base;
  if (p.startsWith("http")) return p;
  return `${base}${p.startsWith("/") ? p : "/" + p}`;
};

// URLs pour les assets uploadés (/uploads/…)
export const buildAssetUrl = (path = "") => {
  const p = String(path || "");
  if (!p) return "";
  if (p.startsWith("http")) return p;
  const base = getApiBase();
  return `${base}${p.startsWith("/") ? "" : "/"}${p}`;
};

// ---------------------- autres constantes ----------------------
export const MAP_TILES = {
  DEFAULT: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
};

// ---------------------- routes internes dashboard ----------------------
export const DASHBOARD_ROUTES = {
  dashboard: "/dashboard",
  missions: "/dashboard/missions",
  operators: "/dashboard/operators",
  clients: "/dashboard/clients",
  transactions: "/dashboard/transactions",
  withdrawals: "/dashboard/withdrawals",
  settings: "/dashboard/settings",
  admins: "/dashboard/admins",
};

// ---------------------- helpers status + endpoints admin ----------------------
const STATUS_IGNORE = new Set(["tous", "toutes", "all", ""]);

const mapStatus = (path, status, ignore = STATUS_IGNORE) => {
  const value = String(status ?? "").trim();
  if (!value) return path;
  if (ignore.has(value.toLowerCase())) return path;
  const joiner = path.includes("?") ? "&" : "?";
  return `${path}${joiner}status=${encodeURIComponent(value)}`;
};

export const ADMIN_API = {
  withdrawals: (status) => apiUrl(mapStatus("/admin/withdrawals", status)),
  withdrawalStatus: (id) => apiUrl(`/admin/withdrawals/${id}/status`),
  transactions: (status) => apiUrl(mapStatus("/admin/transactions", status)),
  transactionConfirm: (id) => apiUrl(`/admin/transactions/${id}/confirm`),
  requests: (query = "") => apiUrl(`/admin/requests${query}`),
  dashboard: () => apiUrl("/admin/dashboard"),
};
