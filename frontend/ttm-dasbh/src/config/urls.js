const RAW_BASE = import.meta.env?.VITE_API_URL || "https://ttm-production-d022.up.railway.app/" || "http://localhost:5000";

export const API_BASE = String(RAW_BASE).trim().replace(/\/+$/g, "");

export const apiUrl = (path = "") => {
  const p = String(path || "");
  if (!p) return API_BASE;
  if (p.startsWith("http")) return p;
  return `${API_BASE}${p.startsWith("/") ? p : "/" + p}`;
};

export const buildAssetUrl = (path = "") => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
};

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

const STATUS_IGNORE = new Set(["tous", "toutes", "all", ""]);

const mapStatus = (path, status, ignore = STATUS_IGNORE) => {
  const value = String(status ?? "").trim();
  if (!value) return path;
  if (ignore.has(value.toLowerCase())) return path;
  const joiner = path.includes("?") ? "&" : "?";
  return `${path}${joiner}status=${encodeURIComponent(value)}`;
};

export const ADMIN_API = {
  withdrawals: (status) =>
    apiUrl(mapStatus("/api/admin/withdrawals", status, new Set(["tous", "all", ""]))),
  withdrawalStatus: (id) => apiUrl(`/api/admin/withdrawals/${id}/status`),
  transactions: (status) =>
    apiUrl(mapStatus("/api/admin/transactions", status, new Set(["toutes", "all", ""]))),
  transactionConfirm: (id) => apiUrl(`/api/admin/transactions/${id}/confirm`),
  requests: (query = "") => apiUrl(`/api/admin/requests${query}`),
  dashboard: () => apiUrl("/api/admin/dashboard"),
};

export const MAP_TILES = {
  DEFAULT: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
};
