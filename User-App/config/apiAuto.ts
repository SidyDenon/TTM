import { Platform } from "react-native";

const LOCAL_IP = "192.168.11.178";
const LOCAL_PORT = 5000;

const LOCAL_ANDROID = `http://10.0.2.2:${LOCAL_PORT}`;
const LOCAL_DEVICE = `http://${LOCAL_IP}:${LOCAL_PORT}`;

const PROD = "https://ttm-production-d022.up.railway.app";

// ---------------------- ping test ----------------------
async function testLocalBackend(url: string) {
  try {
    const res = await fetch(url + "/api/ping", { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

let API_BASE = PROD;

// ---------------------- auto-init ----------------------
export async function initApiBase() {
  const localBase =
    Platform.OS === "android" ? LOCAL_ANDROID : LOCAL_DEVICE;

  const ok = await testLocalBackend(localBase);
  API_BASE = ok ? localBase : PROD;

  console.log("🔧 API sélectionnée :", API_BASE);
}

// ---------------------- getters ----------------------
export function getApiBase() {
  return API_BASE;
}

export function getApiUrl() {
  return API_BASE + "/api";
}
