import { Platform } from "react-native";

// ============================================================
// 🟢 CONFIG ORIGINALE (on la garde) MAIS on ne l'utilise plus
// ============================================================
const LOCAL_IP = "192.168.11.174";
const PORT = 5000;

function normalizeHost(input: string): string {
  let s = String(input || "").trim();
  s = s.replace(/^(https?:\/\/)\s+/, "$1");
  s = s.replace(/\/+$/g, "");
  s = s.replace(/^https?:\/\//, "");
  return s;
}

function withPort(host: string, port: number): string {
  const hasPort = /:\\d+$/.test(host);
  return hasPort ? host : `${host}:${port}`;
}

const DEV_HOST = withPort(normalizeHost(LOCAL_IP), PORT);
const DEV_BASE_HTTP = `http://${DEV_HOST}`;

// ============================================================
// 🔥 VERSION RAILWAY (DEV + PROD)
// ============================================================
const RAILWAY_BASE = "https://ttm-production-d022.up.railway.app";

// 👉 Toujours utiliser Railway (/api)
export const API_URL = `${RAILWAY_BASE}/api`;

// 👉 Base URL sans /api
export const API_BASE = RAILWAY_BASE;

// ============================================================
// 📌 buildApiPath ET buildBasePath — identiques à ton code
// ============================================================
export const buildApiPath = (endpoint: string = "") => {
  const path = String(endpoint || "");
  if (!path) return API_URL;
  if (path.startsWith("http")) return path;
  return `${API_URL}${path.startsWith("/") ? path : "/" + path}`;
};

export const buildBasePath = (endpoint: string = "") => {
  const path = String(endpoint || "");
  if (!path) return API_BASE;
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path.startsWith("/") ? path : "/" + path}`;
};

// ============================================================
// 🔍 DEBUG DEV
// ============================================================
if (__DEV__) {
  console.log("📡 API_URL utilisé:", API_URL);
  console.log("📡 API_BASE utilisé:", API_BASE);
}
