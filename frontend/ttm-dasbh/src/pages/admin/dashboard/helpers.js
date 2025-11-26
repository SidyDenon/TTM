import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

export function getServiceIcon(serviceName, status) {
  const s = status?.toLowerCase()?.trim();

  let color = "#ef4444"; // 🔴 rouge (publiee)
  if (["acceptee", "assignee", "en_route", "sur_place", "en_cours"].includes(s)) color = "#facc15"; // 🟡 jaune
  else if (["terminee"].includes(s)) color = "#22c55e"; // 🟢 vert
  else if (["annulee", "annulee_admin", "annulee_client"].includes(s)) color = "#9ca3af"; // ⚪ gris

  // 🌟 Détection mission active (publiee)
  const pulse = s === "publiee";

  // ✅ SVG du pin
  const svgIcon = `
    <div class="pin-wrapper ${pulse ? "pulse-halo" : ""}">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
        <path fill="${color}" stroke="white" stroke-width="2"
          d="M16 0C10 0 5 5 5 11c0 6 6 13 10 21 4-8 10-15 10-21C25 5 22 0 16 0z"/>
        <circle cx="16" cy="11" r="4" fill="white"/>
      </svg>
    </div>
  `;

  return L.divIcon({
    className: "custom-pin",
    html: svgIcon,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -35],
  });
}

export function FitBounds({ requests }) {
  const map = useMap();
  const didFit = useRef(false);

  useEffect(() => {
    if (didFit.current) return;
    const coords = (requests || [])
      .filter(r => r.lat && r.lng)
      .map(r => [Number(r.lat), Number(r.lng)]);
    if (coords.length) {
      map.fitBounds(coords, { padding: [50, 50] });
      didFit.current = true;
    }
  }, [map, requests]);

  return null;
}
