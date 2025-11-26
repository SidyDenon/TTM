import { API_URL } from "./api";

type LocationPayload = {
  lat: number;
  lng: number;
  ville?: string;
  quartier?: string;
};

async function requestJson(url: string, options: RequestInit) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    throw new Error(data?.error || "Impossible de synchroniser le profil opérateur");
  }
  return data;
}

export async function syncOperatorLocation(
  token: string | null | undefined,
  payload: LocationPayload
) {
  if (!token) return null;
  const body = JSON.stringify({
    lat: payload.lat,
    lng: payload.lng,
    ...(payload.ville !== undefined ? { ville: payload.ville } : {}),
    ...(payload.quartier !== undefined ? { quartier: payload.quartier } : {}),
  });
  return requestJson(`${API_URL}/operator/profile/location`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body,
  });
}
