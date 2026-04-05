import { Platform } from "react-native";

// ============================================================
// 🌍 CONFIG BACKEND (auto local → prod) — aligné sur le dashboard
// ============================================================
const PROD_BASE = "https://ttm-production-d022.up.railway.app";
const DEFAULT_PORT = 5000;
const LOCAL_ANDROID = `http://10.0.2.2:${DEFAULT_PORT}`;
const LOCAL_LOCALHOST = `http://localhost:${DEFAULT_PORT}`;
const LOCAL_LOOPBACK = `http://127.0.0.1:${DEFAULT_PORT}`;
const LAN_IPS = ["192.168.11.103", "192.168.11.164", "192.168.11.241"]; // ajoute ici tes IP LAN possibles

export let API_BASE = PROD_BASE; // host sans /api
export let API_URL = `${API_BASE}/api`;

// ---------------------- ping test ----------------------
async function testBackend(url: string) {
  const base = String(url || "").replace(/\/+$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);
  try {
    const res = await fetch(`${base}/api/ping`, { method: "GET", signal: controller.signal });
    return res.ok;
  } catch (err) {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------- auto-init ----------------------
// À appeler au lancement de l'app (App.tsx)
export async function initApiBase() {
  // 1) override via env (Expo/React Native)
  const envBase =
    (process.env.EXPO_PUBLIC_API_BASE as string) ||
    (process.env.REACT_NATIVE_API_BASE as string) ||
    (process.env.API_BASE as string) ||
    "";

  // En production mobile, on évite les tests locaux (trop lents) et on utilise directement la prod.
  // Le mode local auto-detect reste actif en développement.
  const isDev = typeof __DEV__ !== "undefined" && __DEV__;
  if (!isDev && !envBase) {
    API_BASE = PROD_BASE;
    API_URL = `${API_BASE}/api`;
    return;
  }

  // 2) Liste des candidats locaux (priorité émulateur Android puis localhost, loopback, LAN)
  const lanCandidates = LAN_IPS.map((ip) => `http://${ip}:${DEFAULT_PORT}`);
  const baseLocalOverride =
    (process.env.EXPO_PUBLIC_LOCAL_BASE as string) ||
    (process.env.REACT_NATIVE_LOCAL_BASE as string) ||
    "";
  const preferredLocal = baseLocalOverride
    ? String(baseLocalOverride).replace(/\/+$/, "")
    : Platform.OS === "android"
    ? LOCAL_ANDROID
    : LOCAL_LOCALHOST;

  const candidates = [
    preferredLocal,
    LOCAL_LOOPBACK,
    ...lanCandidates.filter((v, idx, arr) => v && arr.indexOf(v) === idx),
  ].filter(Boolean);

  let resolved = null as string | null;
  for (const candidate of candidates) {
    const ok = await testBackend(candidate);
    if (ok) {
      resolved = candidate.replace(/\/+$/, "");
      break;
    }
  }

  const fallbackBase = envBase ? envBase.replace(/\/+$/, "") : PROD_BASE;
  API_BASE = resolved || fallbackBase;
  API_URL = `${API_BASE}/api`;
  if (__DEV__) console.log("📡 API sélectionnée :", API_BASE);
}

export function getApiBase() {
  return API_BASE.replace(/\/+$/, "");
}

export function getApiUrl() {
  return `${getApiBase()}/api`;
}

// ============================================================
// 🌍 GOOGLE MAPS KEY (from env)
// ============================================================
const GOOGLE_MAPS_KEY_FALLBACK = "AIzaSyABd2koHf-EyzT8Nj9kTJp1fUWYizbjFNI";

export const GOOGLE_MAPS_API_KEY =
  (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY as string) ||
  (process.env.REACT_NATIVE_GOOGLE_MAPS_API_KEY as string) ||
  (process.env.GOOGLE_MAPS_API_KEY as string) ||
  GOOGLE_MAPS_KEY_FALLBACK;

// ============================================================
// Helpers de build
// ============================================================
export const buildApiPath = (endpoint = "") => {
  const base = getApiUrl();
  const path = String(endpoint || "");
  if (!path) return base;
  if (path.startsWith("http")) return path;
  return `${base}${path.startsWith("/") ? path : "/" + path}`;
};

export const buildBasePath = (endpoint = "") => {
  const base = getApiBase();
  const path = String(endpoint || "");
  if (!path) return base;
  if (path.startsWith("http")) return path;
  return `${base}${path.startsWith("/") ? path : "/" + path}`;
};

// ============================================================
// Debug (DEV only)
// ============================================================
if (__DEV__) {
  console.log("📡 Mode DEV (auto detect local → prod) ");
}
