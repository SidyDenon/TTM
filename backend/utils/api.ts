import { Platform } from "react-native";

// ============================================================
// 🌍 CONFIG LOCAL
// ============================================================

// 👉 ton IP locale (valide pour iPhone + Android réel)
const LOCAL_IP = "192.168.11.164";
const LOCAL_PORT = 5000;

// Android Emulator → utilise obligatoirement 10.0.2.2
const ANDROID_LOCAL_URL = `http://10.0.2.2:${LOCAL_PORT}/api`;

// iOS + Android physiquement connectés → ton IP locale
const LOCAL_URL = `http://${LOCAL_IP}:${LOCAL_PORT}/api`;

// ============================================================
// 🌐 CONFIG PROD (APK / EAS Build)
// ============================================================
const PROD_URL = "https://ttm-production-d022.up.railway.app/api";

// ============================================================
// 🧠 Sélection automatique de l’URL backend
// ============================================================
export const API_URL = __DEV__
  ? Platform.OS === "android"
    ? ANDROID_LOCAL_URL // Android emulator
    : LOCAL_URL // iOS simulator + Android device
  : PROD_URL; // APK en prod

// Timeout par défaut (10 sec)
const DEFAULT_TIMEOUT = 10000;

export async function fetchWithTimeout(
  resource: string,
  options: RequestInit = {},
  timeout: number = DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

// ⚡ Appel API générique
export async function apiRequest<T>(
  endpoint: string,
  method: string = "GET",
  body?: any,
  token?: string
): Promise<T> {
  try {
    const res = await fetchWithTimeout(`${API_URL}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || data.message || "Erreur serveur");
    }

    return data as T;
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error("⏳ Temps de réponse dépassé");
    }
    throw err;
  }
}

// Debug console en DEV
if (__DEV__) {
  console.log("📡 API_URL utilisée :", API_URL);
}
