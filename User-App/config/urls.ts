import { Platform } from "react-native";

// 👉 Renseigne l'IP locale de ton PC (même réseau que le téléphone)
// Exemple tolérant: "http:// 192.168.11.174:5000" ou "192.168.11.174"
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

export const API_URL = __DEV__
  ? Platform.OS === "android"
    ? `http://10.0.2.2:${PORT}/api`
    : `${DEV_BASE_HTTP}/api`
  : "https://mon-api-production.com/api";

export const API_BASE = API_URL.replace(/\/+api$/, "");

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

if (__DEV__) {
  console.log("📡 API_URL utilisé:", API_URL);
  console.log("📡 API_BASE utilisé:", API_BASE);
}
