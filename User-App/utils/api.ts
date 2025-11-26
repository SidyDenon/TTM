import { API_URL, API_BASE, buildApiPath } from "../config/urls";

export { API_URL, API_BASE } from "../config/urls";

// Helper fetch avec gestion d'erreurs
export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const isFormData = options.body instanceof FormData;
  const target = buildApiPath(endpoint);

  const res = await fetch(target, {
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await res.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    console.error("❌ Réponse non-JSON:", text);
    throw new Error("Réponse invalide du serveur");
  }

  if (!res.ok) {
    throw new Error(data.error || data.message || "Erreur serveur");
  }

  return data;
}

// 🔰 Directions via backend proxy (Google → fallback OSRM)
export async function fetchDirections(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  mode: "driving" | "walking" | "bicycling" | "transit" = "driving",
  provider?: "google" | "osrm"
) {
  const params = new URLSearchParams({
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    mode,
  });
  if (provider) params.set("provider", provider);
  const url = buildApiPath(`/directions?${params.toString()}`);
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || "Erreur directions");
  return json; // format Google-like (routes[0].overview_polyline.points, legs[0].distance/duration)
}
