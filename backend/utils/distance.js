// Utilitaires de distance et tarification

// Rayon de la Terre en kilomètres
const EARTH_RADIUS_KM = 6371;

// Calcule la distance haversine entre deux points (en km)
export function calculateDistance(lat1, lng1, lat2, lng2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const km = EARTH_RADIUS_KM * c;
  return Number(km.toFixed(2));
}

// Retourne base et coût par km suivant le service
function getPricingForService(service) {
  const s = String(service || "").toLowerCase();
  switch (s) {
    case "remorquage":
      return { base: 3000, perKm: 350 };
    case "depannage":
      return { base: 2500, perKm: 300 };
    case "livraison":
      return { base: 1500, perKm: 250 };
    default:
      return { base: 1500, perKm: 300 };
  }
}

// Calcule prix estimé à partir d'un service et de coordonnées
export function calculatePrice(service, lat, lng, operatorLat, operatorLng) {
  const { base, perKm } = getPricingForService(service);
  const distance = calculateDistance(lat, lng, operatorLat, operatorLng);
  const price = Math.max(0, Math.round(base + perKm * distance));
  return { distance, price };
}
