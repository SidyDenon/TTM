// SuiviMissionLogic.ts
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Linking, Platform, Vibration } from "react-native";
import MapView from "react-native-maps";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { useRouter } from "expo-router";
import { API_URL } from "../../utils/api";
import {
  canUseNotifications as notificationsAvailable,
  requestNotificationPermission,
  setupNotificationChannel,
  showLocalNotification,
} from "../lib/notifications";

/* ---------- Config ---------- */
// 👉 À adapter avec ton vrai numéro de support
const SUPPORT_PHONE = "+22300000000";

/* ---------- Types ---------- */

export type MissionStatus =
  | "en_attente"
  | "publiee"
  | "acceptee"
  | "en_route"
  | "sur_place"
  | "remorquage"
  | "terminee"
  | "annulee_admin"
  | "annulee_client";

export type Mission = {
  id: number;
  address?: string | null;
  lat: number;
  lng: number;
  status?: MissionStatus | null;
  operatorName?: string | null;
  operator_phone?: string | null;
  service?: string | null;
  destination?: string | null;
  dest_lat?: number | null;
  dest_lng?: number | null;
};

type OperatorPositionUpdate = {
  requestId: number | string;
  operatorId?: number | string;
  lat: number | string;
  lng: number | string;
  timestamp?: number;
};

/* ---------- Helpers ---------- */

// Construit l’URL backend /directions
const buildDirectionsUrl = (
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
  mode: "driving" | "walking" | "bicycling" = "driving"
) =>
  `${API_URL}/directions?origin=${origin.lat},${origin.lng}&destination=${dest.lat},${dest.lng}&mode=${mode}`;

// Décodage polyline Google
function decodePolyline(encoded: string) {
  const points: { latitude: number; longitude: number }[] = [];
  let index = 0,
    lat = 0,
    lng = 0;

  while (index < encoded.length) {
    let b: number,
      shift = 0,
      result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

// Bearing en degrés [-180,180]
const bearingBetween = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const toDeg = (v: number) => (v * 180) / Math.PI;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  let θ = toDeg(Math.atan2(y, x));
  if (θ > 180) θ -= 360;
  if (θ < -180) θ += 360;
  return θ;
};

const notificationsReady = notificationsAvailable;

export function useSuiviMissionLogic() {
  const { token } = useAuth();
  const { socket } = useSocket();
  const router = useRouter();

  const [mission, setMission] = useState<Mission | null>(null);
  const [loading, setLoading] = useState(true);

  const [operatorLocation, setOperatorLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [isFallbackRoute, setIsFallbackRoute] = useState(false);
  const [eta, setEta] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [operatorPhone, setOperatorPhone] = useState<string | null>(null);

  // animations + perf Android
  const rotation = useRef(new Animated.Value(0)).current;
  const previousPos = useRef<{ latitude: number; longitude: number } | null>(null);
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  // toasts in-app
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [notification, setNotification] = useState<string | null>(null);
  const lastNotificationTime = useRef(0);

  const mapRef = useRef<MapView | null>(null);
  const lastRouteUpdateRef = useRef(0);

  /* ------ Notifications : permission + channel ------ */
  useEffect(() => {
    if (!notificationsReady || Platform.OS === "web") return;
    (async () => {
      try {
        const { granted } = await requestNotificationPermission();
        if (!granted) {
          console.warn("❌ Permission notification refusée");
          return;
        }
        await setupNotificationChannel();
        console.log("✅ Notifications autorisées");
      } catch (err) {
        console.warn("⚠️ Impossible de vérifier les notifications:", err);
      }
    })();
  }, []);

  /* ------ Fetch mission active ------ */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/requests/active`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!cancelled && res.ok) {
          const m = json.data;

          if (!m || (Array.isArray(m) && m.length === 0)) {
            console.log("🚫 Aucune mission active détectée — retour à l'accueil");
            setMission(null);
            router.replace("/user");
            return;
          }

          setMission({
            id: Number(m.id),
            address: m.address ?? null,
            lat: Number(m.lat),
            lng: Number(m.lng),
            status: (m.status as MissionStatus) ?? null,
            operatorName: m.operator_name ?? null,
            operator_phone: m.operator_phone ?? null,
            service: m.service ?? null,
            destination: m.destination ?? null,
            dest_lat: m.dest_lat != null ? Number(m.dest_lat) : null,
            dest_lng: m.dest_lng != null ? Number(m.dest_lng) : null,
          });
          if (m.operator_phone) setOperatorPhone(String(m.operator_phone));
        }
      } catch (e) {
        console.error("❌ Erreur fetch mission active:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  /* ------ Notifications locales (toast + notif système) ------ */
  const showNotificationInApp = async (message: string) => {
    const now = Date.now();
    if (now - lastNotificationTime.current < 6000) return;
    lastNotificationTime.current = now;

    setNotification(message);
    Vibration.vibrate(200);
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2400),
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();

    try {
      if (Platform.OS !== "web" && notificationsReady) {
        await showLocalNotification("TowTruck Mali", message);
      }
    } catch {
      // Ignorer en dev
    }
  };

  /* ------ Animation camion ------ */
  const animateMarker = (lat: number, lng: number) => {
    if (!operatorLocation) {
      setOperatorLocation({ latitude: lat, longitude: lng });
      previousPos.current = { latitude: lat, longitude: lng };
      setTracksViewChanges(true);
      setTimeout(() => setTracksViewChanges(false), 100);
      return;
    }

    const prev = previousPos.current || operatorLocation;
    const angle = bearingBetween(prev.latitude, prev.longitude, lat, lng);

    Animated.timing(rotation, {
      toValue: angle,
      duration: 300,
      useNativeDriver: false,
    }).start();

    setOperatorLocation({ latitude: lat, longitude: lng });
    previousPos.current = { latitude: lat, longitude: lng };
    setTracksViewChanges(true);
    setTimeout(() => setTracksViewChanges(false), 120);
  };

  /* ------ Gestion Socket ------ */
   useEffect(() => {
    if (!socket || !mission?.id || !token) return;

    const doRegister = () => socket.emit("register", { token });
    const joinRoom = () => {
      console.log("🟢 [SOCKET] Join room mission_", mission.id);
      socket.emit("join_request", { requestId: mission.id });
    };

    const onConnect = () => {
      console.log("✅ [SOCKET] Connecté:", socket.id);
      doRegister();
      joinRoom();
    };

    const onReconnect = () => {
      console.log("🔄 [SOCKET] Reconnect");
      doRegister();
      joinRoom();
    };

    const recalcRoute = async (
      originLat: number,
      originLng: number,
      target: { lat: number; lng: number },
      force = false
    ) => {
      try {
        if (!Number.isFinite(originLat) || !Number.isFinite(originLng)) return;
        if (!Number.isFinite(target.lat) || !Number.isFinite(target.lng)) return;

        const now = Date.now();
        if (!force && now - lastRouteUpdateRef.current < 2500) return;
        lastRouteUpdateRef.current = now;

        const url = buildDirectionsUrl(
          { lat: originLat, lng: originLng },
          target,
          "driving"
        );
        const res = await fetch(url);
        const json = await res.json();

        if (json?.routes?.length) {
          const route = json.routes[0];
          const leg = route.legs?.[0];
          const pts = decodePolyline(route.overview_polyline.points);
          if (Array.isArray(pts) && pts.length) setRouteCoords(pts);
          if (leg?.duration?.value) setEta(leg.duration.value / 60);
          if (leg?.distance?.value) setDistance(leg.distance.value / 1000);
          mapRef.current?.fitToCoordinates(pts, {
            edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
            animated: true,
          });
          setIsFallbackRoute(false);
        } else {
          setRouteCoords([
            { latitude: originLat, longitude: originLng },
            { latitude: target.lat, longitude: target.lng },
          ]);
          setIsFallbackRoute(true);
        }
      } catch (e) {
        console.warn("⚠️ recalcul itinéraire:", (e as Error)?.message || e);
      }
    };

    const onOpPos = async (data: OperatorPositionUpdate) => {
      if (!mission?.id || Number(data.requestId) !== Number(mission.id)) return;
      const latNum = Number(data.lat);
      const lngNum = Number(data.lng);
      if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return;
      animateMarker(latNum, lngNum);

      const isTowingMission =
        typeof mission.service === "string" &&
        mission.service.toLowerCase().includes("remorqu");
      const hasDestinationCoords =
        typeof mission.dest_lat === "number" &&
        !Number.isNaN(mission.dest_lat ?? NaN) &&
        typeof mission.dest_lng === "number" &&
        !Number.isNaN(mission.dest_lng ?? NaN);
      const headingToDestination =
        isTowingMission &&
        hasDestinationCoords &&
        mission.status === "remorquage";

      const dest = headingToDestination
        ? { lat: Number(mission.dest_lat), lng: Number(mission.dest_lng) }
        : { lat: Number(mission.lat), lng: Number(mission.lng) };

      recalcRoute(latNum, lngNum, dest);
    };

    const onStatusUpdate = async (data: {
      id: number | string;
      status: MissionStatus;
      operator_name?: string | null;
      operator_phone?: string | null;
      message?: string | null;
    }) => {
      if (!mission?.id || Number(data.id) !== Number(mission.id)) return;

      setMission((prev) =>
        prev
          ? {
              ...prev,
              status: data.status || prev.status,
              operatorName: data.operator_name ?? prev.operatorName,
              operator_phone: data.operator_phone ?? prev.operator_phone,
            }
          : prev
      );

      if (data.operator_phone) setOperatorPhone(String(data.operator_phone));

      const statusMessage = (() => {
        switch (data.status) {
          case "acceptee":
            return data.operator_name
              ? `${data.operator_name} a accepté ta mission`
              : "Ta mission a été acceptée ✅";
          case "en_route":
            return "Ton dépanneur est en route 🚗";
          case "sur_place":
            return "Ton dépanneur est arrivé ✅";
          case "remorquage":
            return "Le véhicule est en cours de remorquage 🚚";
          case "terminee":
            return "Mission terminée, merci pour ta confiance 🙌";
          case "annulee_admin":
          case "annulee_client":
            return data.message || "Mission annulée.";
          default:
            return data.message || "Mise à jour de la mission.";
        }
      })();

      showNotificationInApp(statusMessage);

      if (data.status === "remorquage") {
        const hasDestinationCoords =
          typeof mission?.dest_lat === "number" &&
          !Number.isNaN(mission.dest_lat ?? NaN) &&
          typeof mission?.dest_lng === "number" &&
          !Number.isNaN(mission.dest_lng ?? NaN);
        if (operatorLocation && hasDestinationCoords) {
          recalcRoute(
            operatorLocation.latitude,
            operatorLocation.longitude,
            { lat: Number(mission!.dest_lat), lng: Number(mission!.dest_lng) },
            true
          );
        }
      }

      if (data.status === "terminee") {
        const missionId = mission?.id || data.id;
        setTimeout(() => {
          if (missionId) {
            router.replace({ pathname: "/user/PaymentScreen", params: { missionId: String(missionId) } });
          } else {
            router.replace("/user");
          }
        }, 2000);
      } else if (data.status === "annulee_admin" || data.status === "annulee_client") {
        setTimeout(() => {
          router.replace("/user");
        }, 2000);
      }
    };

    const onMissionDeleted = (data: { id?: number | string }) => {
      const missionId = typeof data === "object" ? data?.id : data;
      if (!mission?.id || Number(missionId) !== Number(mission.id)) return;
      showNotificationInApp("Mission supprimée par l’équipe.");
      setTimeout(() => router.replace("/user"), 1500);
    };

    socket.on("connect", onConnect);
    socket.io.on("reconnect", onReconnect);
    socket.on("register_success", (p: any) => console.log("🆗 register_success", p));
    socket.on("operator_position_update", onOpPos);
    socket.on("mission:updated", onStatusUpdate);
    socket.on("mission:status_changed", onStatusUpdate);
    socket.on("mission:deleted", onMissionDeleted);

    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.io.off("reconnect", onReconnect);
      socket.off("register_success");
      socket.off("operator_position_update", onOpPos);
      socket.off("mission:updated", onStatusUpdate);
      socket.off("mission:status_changed", onStatusUpdate);
      socket.off("mission:deleted", onMissionDeleted);
    };
  }, [socket, mission?.id, token, router, mission?.lat, mission?.lng, mission?.dest_lat, mission?.dest_lng, mission?.status]);

  const heureArrivee = useMemo(
    () =>
      eta
        ? new Date(Date.now() + eta * 60000).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : null,
    [eta]
  );

  const statusText = useMemo(() => {
  switch (mission?.status) {
    case "en_attente":
    case "publiee":
      return "En attente d’un dépanneur";
    case "acceptee":
      return "Acceptée par";
    case "en_route":
      return "En route";
    case "sur_place":
      return "Arrivé";
    case "remorquage":
      return "Remorquage en cours";
    case "terminee":
      return "Mission terminée";
    case "annulee_admin":
      return "Mission annulée par l’administration";
    case "annulee_client":
      return "Mission annulée";
    default:
      return "En attente d’acceptation";
  }
}, [mission?.status]);

  // 👉 Annulation possible seulement si la mission n’est pas encore acceptée
  const canCancel = useMemo(() => {
    const s = mission?.status;
    if (!s) return true; // au tout début
    return s === "en_attente" || s === "publiee";
  }, [mission?.status]);

  /* ------ Actions : annulation & appels ------ */
  const cancelMission = () => {
    if (!mission || !canCancel) return;

    Alert.alert("Annuler la mission", "Es-tu sûr de vouloir annuler ta demande ?", [
      { text: "Non", style: "cancel" },
      {
        text: "Oui, annuler",
        style: "destructive",
        onPress: async () => {
          try {
            const res = await fetch(`${API_URL}/requests/${mission.id}/cancel`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            if (!res.ok) {
              showNotificationInApp(json.error || "Impossible d’annuler la mission.");
              return;
            }
            showNotificationInApp("✅ Ta mission a bien été annulée.");
            setTimeout(() => {
              router.replace("/user");
            }, 1200);
          } catch (err) {
            console.error("❌ Erreur annulation mission:", err);
            showNotificationInApp("Erreur lors de l’annulation.");
          }
        },
      },
    ]);
  };

  const callOperator = () => {
    if (!operatorPhone) return;
    Linking.openURL(`tel:${operatorPhone}`);
  };

  const callSupport = () => {
    if (!SUPPORT_PHONE) return;
    Linking.openURL(`tel:${SUPPORT_PHONE}`);
  };

  const hasSupportPhone = Boolean(SUPPORT_PHONE);

  return {
    // data
    mission,
    loading,
    operatorLocation,
    routeCoords,
    isFallbackRoute,
    eta,
    distance,
    operatorPhone,
    // ui helpers
    statusText,
    canCancel,
    heureArrivee,
    notification,
    fadeAnim,
    rotation,
    tracksViewChanges,
    mapRef,
    hasSupportPhone,
    // actions
    cancelMission,
    callOperator,
    callSupport,
  };
}
