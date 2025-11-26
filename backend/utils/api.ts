import { Platform } from "react-native"

export const API_URL =
  Platform.OS === "android"
    ? "http://10.0.2.2:5000/api"
    : "http://192.168.11.174:5000/api";

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
