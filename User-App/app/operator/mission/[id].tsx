// app/operator/mission/[id].tsx
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Linking,
  BackHandler,
  Image,
  Animated,
} from "react-native";
import { useLocalSearchParams, useRouter, useNavigation, Stack } from "expo-router";
import MapView, { Marker, Polyline } from "react-native-maps";
import * as Location from "expo-location";
import { API_URL } from "../../../utils/api";
import { formatCurrency } from "../../../utils/format";
import { useAuth } from "../../../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import ImageViewing from "react-native-image-viewing";
import { useSocket } from "../../../context/SocketContext";
import polyline from "@mapbox/polyline";
import { startBackgroundLocation, stopBackgroundLocation } from "../../../utils/backgroundLocation";
import { syncOperatorLocation } from "../../../utils/operatorProfile";
import { OPERATOR_MISSION_RADIUS_KM } from "../../../constants/operator";
import { SupportModal } from "../../../components/SupportModal";

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

type Mission = {
  id: number;
  type: string;
  adresse: string;
  description?: string;
  ville: string;
  lat?: number;
  lng?: number;
  user_name?: string;
  user_phone?: string;
  status: string;
  photos?: string[];
  estimated_price?: number; // ✅ ajouté pour TS
  preview_final_price?: number | null;
  preview_total_km?: number | null;
  destination?: string | null;
  dest_lat?: number | null;
  dest_lng?: number | null;
  operator_id?: number | null;
};

type Event = {
  id: number;
  type: string;
  created_at: string;
};

type OperatorLocation = { latitude: number; longitude: number };

const STATUSES = [
  { key: "acceptee", label: "Acceptée", icon: "done" },
  { key: "en_route", label: "En route", icon: "directions-car" },
  { key: "sur_place", label: "Arrivé", icon: "place" },
  { key: "remorquage", label: "Remorquage", icon: "build-circle" },
  { key: "terminee", label: "Terminée", icon: "flag" },
];

export default function MissionSuivi() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user, logout } = useAuth();
  const { socket } = useSocket();
  const router = useRouter();
  const navigation = useNavigation();

  const [mission, setMission] = useState<Mission | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [commissionPercent, setCommissionPercent] = useState<number>(12); // default aligné admin
  const [currency, setCurrency] = useState<string>("FCFA");

  const [operatorLocation, setOperatorLocation] = useState<OperatorLocation | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [isFallbackRoute, setIsFallbackRoute] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [totalKm, setTotalKm] = useState<number | null>(null);
  const [operatorOrigin, setOperatorOrigin] = useState<{ lat: number; lng: number } | null>(null);

  const [isFullMap, setIsFullMap] = useState(false); // fullscreen state
  const [mapType, setMapType] = useState<"standard" | "hybrid">("hybrid");
  const [menuVisible, setMenuVisible] = useState(false);
  const [followOperator, setFollowOperator] = useState(true);
  const [supportVisible, setSupportVisible] = useState(false);
  const menuSlideAnim = useRef(new Animated.Value(Dimensions.get("window").width)).current;
  const menuFadeAnim = useRef(new Animated.Value(0)).current;

  const mapRef = useRef<MapView>(null);
  const [arrivalTime, setArrivalTime] = useState<Date | null>(null);

  const rotation = useRef(new Animated.Value(0)).current;
  const previousPos = useRef<OperatorLocation | null>(null);
  const bearingRef = useRef<number>(0);
  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const initialLocationSynced = useRef(false);

  const isTowingMission =
    typeof mission?.type === "string" &&
    mission.type.toLowerCase().includes("remorqu");

  const hasDestinationCoords =
    typeof mission?.dest_lat === "number" &&
    !Number.isNaN(mission.dest_lat) &&
    typeof mission?.dest_lng === "number" &&
    !Number.isNaN(mission.dest_lng);

  const headingToDestination =
    isTowingMission &&
    hasDestinationCoords &&
    mission?.status === "remorquage";

  const commissionRate = Number.isFinite(commissionPercent) ? commissionPercent : 0;
  const grossAmount =
    typeof mission?.estimated_price === "number"
      ? Math.max(
          0,
          Number(mission.estimated_price) /
            (commissionRate >= 100 ? 1 : 1 - commissionRate / 100)
        )
      : null;

  // ⚙️ Config publique (commission, currency)
  useEffect(() => {
    (async () => {
      try {
        const base = API_URL.replace(/\/+api$/, "");
        const res = await fetch(`${base}/config/public`);
        const data = await res.json();
        if (res.ok) {
          if (data.commission_percent != null) setCommissionPercent(Number(data.commission_percent));
          if (data.currency) setCurrency(String(data.currency));
        }
      } catch {
        // silent fail → valeurs par défaut
      }
    })();
  }, []);

  // Profil opérateur (origine) pour calcul total km
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/operator/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.data?.lat != null && data?.data?.lng != null) {
          setOperatorOrigin({
            lat: Number(data.data.lat),
            lng: Number(data.data.lng),
          });
        }
      } catch {
        // silencieux
      }
    })();
  }, [token]);

  // 🎯 Background location dédié (service natif)
  useEffect(() => {
    if (mission?.status === "en_route" && user?.id && id) {
      startBackgroundLocation(user.id, Number(id));
    }

    return () => {
      stopBackgroundLocation();
    };
  }, [mission?.status, user?.id, id]);

  const openMenu = () => {
    setMenuVisible(true);
    Animated.parallel([
      Animated.timing(menuSlideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(menuFadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const closeMenu = () => {
    Animated.parallel([
      Animated.timing(menuSlideAnim, {
        toValue: Dimensions.get("window").width,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(menuFadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setMenuVisible(false));
  };

  // ⛔ Bloquer le retour tant que mission non terminée
  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (mission && mission.status !== "terminee") {
        Toast.show({
          type: "info",
          text1: "⛔ Action bloquée",
          text2: "Vous devez terminer la mission avant de quitter",
        });
        return true;
      }
      if (navigation.canGoBack()) {
        return false; // laisser la navigation gérer
      }
      return false; // laisser Android fermer l'app s'il n'y a rien à revenir
    });

    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (mission && mission.status !== "terminee") {
        e.preventDefault();
        Toast.show({
          type: "info",
          text1: "Mission en cours",
          text2: "Vous devez terminer la mission avant de quitter.",
        });
        return;
      }
      // sinon on laisse la navigation gérer
    });

    return () => {
      backHandler.remove();
      unsubscribe();
    };
  }, [navigation, mission]);

  // 🔄 Charger mission + events
  useEffect(() => {
    const fetchMission = async () => {
      setFetchError(null);
      try {
        const res = await fetch(
          `${API_URL}/operator/requests/${id}?radius=${OPERATOR_MISSION_RADIUS_KM}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const text = await res.text();
        let data: any;
        try {
          data = JSON.parse(text);
        } catch {
          console.error("❌ Réponse non JSON — probablement du HTML");
          throw new Error(text.slice(0, 200));
        }

        if (!res.ok) {
          const message =
            (data && typeof data === "object" && "error" in data && data.error) ||
            `Erreur serveur (${res.status})`;
          throw new Error(String(message));
        }
        const m = data?.data;
        if (!m) {
          throw new Error("Mission introuvable dans la réponse API");
        }
        setMission({
          id: m.id,
          ville: m.ville,
          lat: Number(m.lat),
          lng: Number(m.lng),
          adresse: m.address,
          type: m.service,
          description: m.description,
          user_name: m.client_name,
          user_phone: m.client_phone,
          status: m.status,
          photos: m.photos || [],
          operator_id: m.operator_id ?? null,
          estimated_price: m.estimated_price != null ? Number(m.estimated_price) : undefined,
          preview_final_price:
            m.preview_final_price != null ? Number(m.preview_final_price) : null,
          preview_total_km:
            m.preview_total_km != null ? Number(m.preview_total_km) : null,
          destination: m.destination || null,
          dest_lat: m.dest_lat != null ? Number(m.dest_lat) : null,
          dest_lng: m.dest_lng != null ? Number(m.dest_lng) : null,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur inconnue";
        setFetchError(message);
        console.warn("❌ Erreur fetch mission:", message);
        Toast.show({
          type: "error",
          text1: "Mission indisponible",
          text2: message.slice(0, 120),
        });
        setMission(null);
      } finally {
        setLoading(false);
      }
    };

    const fetchEvents = async () => {
      try {
        const res = await fetch(`${API_URL}/operator/requests/${id}/events`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setEvents(data.data || []);
      } catch (err) {
        console.error("❌ Erreur fetch events:", err);
      }
    };

    fetchMission();
    fetchEvents();
  }, [id, token]);

  // Calcul kilométrage total (opérateur -> client -> destination)
  useEffect(() => {
    if (!mission || !operatorOrigin) return;
    if (mission.lat == null || mission.lng == null) return;

    const clientLat = Number(mission.lat);
    const clientLng = Number(mission.lng);
    const opLat = operatorOrigin.lat;
    const opLng = operatorOrigin.lng;

    let total = haversineKm(opLat, opLng, clientLat, clientLng);

    const isTow =
      typeof mission.type === "string" &&
      mission.type.toLowerCase().includes("remorqu");

    if (isTow && mission.dest_lat != null && mission.dest_lng != null) {
      total += haversineKm(
        clientLat,
        clientLng,
        Number(mission.dest_lat),
        Number(mission.dest_lng)
      );
    }
    setTotalKm(total);
  }, [mission, operatorOrigin]);

  // 🔌 Socket : register + join room mission
  useEffect(() => {
    if (!socket || !mission?.id || !token) return;

    const doRegister = () => socket.emit("register", { token } as { token: string });
    const joinRoom = () =>
      socket.emit("join_request", { requestId: Number(mission.id) } as { requestId: number });

    const onConnect = () => {
      console.log("✅ [SOCKET] connect:", socket.id);
      doRegister();
      joinRoom();
    };

    if (!socket.connected) {
      socket.connect();
    }

    socket.on("connect", onConnect);

    // si déjà connecté (retour d'écran)
    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off("connect", onConnect);
    };
  }, [socket, mission?.id, token]);

  // 🛰️ Suivi GPS opérateur (en foreground) quand "en_route"
  useEffect(() => {
    const startTracking = async () => {
      if (mission?.status !== "en_route") return;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Toast.show({
          type: "error",
          position: "top",
          text1: "Localisation refusée",
          text2: "Active la localisation pour suivre la mission.",
          visibilityTime: 3000,
          topOffset: 55,
        });
        return;
      }

      // Évite plusieurs watchers
      if (locationSub.current) {
        console.log("⏸️ GPS déjà actif");
        return;
      }

      console.log("🚗 Démarrage du suivi GPS...");
      locationSub.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Highest,
          distanceInterval: 5,
          timeInterval: 3000,
        },
        (loc: Location.LocationObject) => {
          const coords: OperatorLocation = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };

          setOperatorLocation(coords);

          // Rotation TowTruck
          if (previousPos.current) {
            const prev = previousPos.current;
            const angle =
              (Math.atan2(
                coords.longitude - prev.longitude,
                coords.latitude - prev.latitude
              ) *
                180) /
              Math.PI;

            Animated.timing(rotation, {
              toValue: angle,
              duration: 800,
              useNativeDriver: false,
            }).start();
            bearingRef.current = (angle + 360) % 360;
          }
          previousPos.current = coords;

          // Émission socket temps réel
          if (!socket?.connected) return;
          socket.emit("operator_location", {
            operatorId: user?.id,
            requestId: mission.id,
            lat: coords.latitude,
            lng: coords.longitude,
          });
        }
      );
    };

    if (mission?.status === "en_route") {
      startTracking();
    }

    return () => {
      if (locationSub.current) {
        console.log("🛑 Arrêt du suivi GPS");
        locationSub.current.remove();
        locationSub.current = null;
      }
    };
  }, [mission?.status, socket, user?.id]);

  // 📍 Calculer route (proxy /api/directions)
  useEffect(() => {
    const destLat = headingToDestination && mission?.dest_lat != null
      ? Number(mission.dest_lat)
      : mission?.lat != null
      ? Number(mission.lat)
      : NaN;
    const destLng = headingToDestination && mission?.dest_lng != null
      ? Number(mission.dest_lng)
      : mission?.lng != null
      ? Number(mission.lng)
      : NaN;

    if (!mission || !operatorLocation || !Number.isFinite(destLat) || !Number.isFinite(destLng)) return;

    const handler = setTimeout(async () => {
      try {
        const url = `${API_URL}/directions?origin=${operatorLocation.latitude},${operatorLocation.longitude}&destination=${destLat},${destLng}&mode=driving`;
        const res = await fetch(url);
        const json = await res.json();

        if (!json.routes?.length) {
          setRouteCoords([
            { latitude: operatorLocation.latitude, longitude: operatorLocation.longitude },
            { latitude: destLat, longitude: destLng },
          ]);
          setIsFallbackRoute(true);
          return;
        }

        const route = json.routes[0];
        const leg = route.legs[0];

        const points = polyline.decode(route.overview_polyline.points).map(([lat, lng]: [number, number]) => ({
          latitude: lat,
          longitude: lng,
        }));

        setRouteCoords(points);
        setEta(leg.duration.value / 60);
        setDistance(leg.distance.value / 1000);
        setIsFallbackRoute(false);

        mapRef.current?.fitToCoordinates(points, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      } catch (err) {
        console.error("❌ Erreur Google Directions:", err);
      }
    }, 1500);

    return () => clearTimeout(handler);
  }, [operatorLocation, mission, headingToDestination]);

  // 🎯 Suivi caméra façon navigation (centre sur le véhicule)
  useEffect(() => {
    if (!operatorLocation || !mapRef.current) return;
    if (!followOperator) return;

    const camera = {
      center: operatorLocation,
      heading: bearingRef.current || 0,
      pitch: 45,
      zoom: 17,
    } as const;
    mapRef.current.animateCamera(camera, { duration: 800 });
  }, [operatorLocation, followOperator]);

  // 🕒 Heure d’arrivée estimée
  useEffect(() => {
    if (eta) {
      const now = new Date();
      const arrival = new Date(now.getTime() + eta * 60 * 1000);
      setArrivalTime(arrival);
    }
  }, [eta]);

  const toggleMapType = () => {
    setMapType((prev) => (prev === "hybrid" ? "standard" : "hybrid"));
  };

  // 🔄 Mettre à jour le statut
  const updateStatus = async (action: string) => {
    try {
      const res = await fetch(`${API_URL}/operator/requests/${id}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        Toast.show({
          type: "error",
          text1: "Erreur",
          text2: data.error || "Impossible de mettre à jour",
        });
        return;
      }

      Toast.show({
        type: "success",
        text1: "✅ Succès",
        text2: `Mission ${action}`,
      });

      setMission((prev) => (prev ? { ...prev, status: action } : prev));

      // 🚩 Fin de mission → stop background + retour liste
      if (action === "terminee") {
        await stopBackgroundLocation();
        setTimeout(() => router.replace("/operator"), 1500);
      }
    } catch (err) {
      console.error("❌ Erreur update statut:", err);
    }
  };

  // ☎️ Appeler le client
  const callClient = () => {
    if (mission?.user_phone) {
      Linking.openURL(`tel:${mission.user_phone}`);
    } else {
      Toast.show({
        type: "info",
        text1: "ℹ️ Info",
        text2: "Numéro de téléphone indisponible",
      });
    }
  };

  const acceptAssigned = async () => {
    try {
      const res = await fetch(`${API_URL}/operator/requests/${mission?.id}/accepter`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        Toast.show({ type: "error", text1: "Erreur", text2: data.error || "Impossible d'accepter" });
        return;
      }
      setMission((prev) => (prev ? { ...prev, status: "acceptee" } : prev));
      Toast.show({ type: "success", text1: "Mission acceptée" });
      if (mission?.id) {
        router.replace(`/operator/mission/${mission.id}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const refuseAssigned = async () => {
    try {
      const res = await fetch(`${API_URL}/operator/requests/${mission?.id}/refuser`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        Toast.show({ type: "error", text1: "Erreur", text2: data.error || "Impossible de refuser" });
        return;
      }
      Toast.show({ type: "info", text1: "Mission refusée" });
      router.replace("/operator");
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#E53935" />
        <Text>Chargement mission...</Text>
      </View>
    );
  }

  if (!mission) {
    const needsProfile = fetchError?.toLowerCase().includes("profil opérateur");
    return (
      <View style={styles.loader}>
        <Text style={styles.emptyTitle}>❌ Mission introuvable</Text>
        <Text style={styles.emptyText}>
          {fetchError || "La mission demandée est introuvable ou n’est plus disponible."}
        </Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => {
            if (navigation.canGoBack()) {
              router.back();
            } else {
              router.replace("/operator");
            }
          }}
        >
          <Text style={styles.retryText}>Retour</Text>
        </TouchableOpacity>
        {needsProfile && (
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: "#1e88e5" }]}
            onPress={() => router.push("/operator/profile")}
          >
            <Text style={styles.retryText}>Compléter mon profil</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const timelineSteps = isTowingMission
    ? STATUSES
    : STATUSES.filter((step) => step.key !== "remorquage");

  const statusIndex = Math.max(
    0,
    timelineSteps.findIndex((s) => s.key === mission.status)
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerBackVisible: mission?.status === "terminee",
          gestureEnabled: mission?.status === "terminee",
        }}
      />

      <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff90" }}>
        <View style={styles.topBar}>
          <Text style={styles.logo}>
            <Text style={{ color: "#E53935" }}>TT</Text>M
          </Text>
          <TouchableOpacity onPress={openMenu} style={styles.profileBtn}>
            <MaterialIcons name="person-outline" size={26} color="#000" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={[styles.container, isFullMap && styles.fullContainer]}
          contentContainerStyle={{ paddingBottom: isFullMap ? 0 : 140 }}
        >
            {typeof mission.lat === "number" && typeof mission.lng === "number" && (
              <View style={{ position: "relative" }}>
              <MapView
                ref={mapRef}
                style={isFullMap ? styles.mapFull : styles.map}
                mapType={mapType}
                initialRegion={{
                  latitude: mission.lat,
                  longitude: mission.lng,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
              >
                {/* Client */}
                <Marker coordinate={{ latitude: mission.lat, longitude: mission.lng }} title={`Mission #${mission.id}`} />

                {/* Destination finale */}
                {hasDestinationCoords && (
                  <Marker
                    coordinate={{ latitude: Number(mission.dest_lat), longitude: Number(mission.dest_lng) }}
                    pinColor="#1B5E20"
                    title="Destination finale"
                    description={mission.destination || "Adresse finale"}
                  />
                )}

                {/* TowTruck opérateur */}
                {operatorLocation && (
                  <Marker coordinate={operatorLocation} title="Moi">
                    <Animated.View
                      style={{
                        position: "absolute",
                        width: 60,
                        height: 60,
                        borderRadius: 30,
                        backgroundColor: "rgba(255,0,0,0.2)",
                        alignItems: "center",
                        justifyContent: "center",
                        transform: [
                          {
                            scale: rotation.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 1.5],
                            }),
                          },
                        ],
                        opacity: 0.6,
                      }}
                    />

                    <Animated.Image
                      source={require("../../../assets/images/towtruck.png")}
                      style={{
                        width: 45,
                        height: 45,
                        transform: [
                          {
                            rotate: rotation.interpolate({
                              inputRange: [-180, 180],
                              outputRange: ["-180deg", "180deg"],
                            }),
                          },
                        ],
                      }}
                      resizeMode="contain"
                    />
                  </Marker>
                )}

                {/* Itinéraire */}
                {routeCoords.length > 0 && (
                  <Polyline
                    coordinates={routeCoords}
                    strokeWidth={4}
                    strokeColor={isFallbackRoute ? "#9E9E9E" : "#E53935"}
                  />
                )}
              </MapView>

              {/* Bouton type de vue */}
              <TouchableOpacity
                style={styles.viewToggleBtn}
                onPress={toggleMapType}
              >
                <MaterialIcons
                  name={mapType === "hybrid" ? "visibility" : "visibility-off"}
                  size={22}
                  color="#fff"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.focusBtn}
                onPress={() => {
                  if (!operatorLocation || !mapRef.current) return;
                  setFollowOperator(true);
                  mapRef.current.animateCamera(
                    {
                      center: operatorLocation,
                      heading: bearingRef.current || 0,
                      pitch: 45,
                      zoom: 17,
                    },
                    { duration: 600 }
                  );
                }}
              >
                <MaterialIcons name="my-location" size={22} color="#fff" />
              </TouchableOpacity>

              {mission.status !== "publiee" && (
                <View style={styles.fusedCard}>
                  <View style={styles.fusedRow}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.fusedLine}>
                        <MaterialIcons name="person" size={18} color="#1565C0" />
                        <Text style={styles.fusedName}>{mission.user_name || "Client"}</Text>
                      </View>
                      <View style={[styles.fusedLine, { marginTop: 4 }]}>
                        <MaterialIcons name="phone" size={18} color="#000" />
                        <Text style={styles.fusedPhone}>{mission.user_phone || "—"}</Text>
                      </View>
                    </View>

                    {typeof mission.estimated_price === "number" && (
                      <View style={styles.fusedRight}>
                        <Text style={styles.fusedAmount}>
                          {formatCurrency(
                            Math.max(
                              0,
                              Number(
                                mission.preview_final_price ??
                                  mission.estimated_price ??
                                  0
                              )
                            )
                          )}
                        </Text>
                        <Text style={styles.fusedCommission}>
                          Commission TTM : {commissionPercent}%
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Fullscreen toggle */}
              <TouchableOpacity style={styles.fullscreenBtn} onPress={() => setIsFullMap(!isFullMap)}>
                <MaterialIcons name={isFullMap ? "fullscreen-exit" : "fullscreen"} size={26} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {/* ⛔ Cache détails si fullscreen */}
          {!isFullMap && (
            <>
              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <MaterialIcons name="assignment" size={18} color="#E53935" />
                  <Text style={styles.sectionTitle}>Mission #{mission.id}</Text>
                </View>
                <View style={styles.infoRow}>
                  <MaterialIcons name="build" size={18} color="#E53935" style={styles.rowIcon} />
                  <Text style={styles.rowText}>
                    <Text style={styles.rowLabel}>Type :</Text> {mission.type}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <MaterialIcons name="place" size={18} color="#E53935" style={styles.rowIcon} />
                  <Text style={styles.rowText}>
                    <Text style={styles.rowLabel}>Adresse :</Text> {mission.adresse}
                  </Text>
                </View>
                {isTowingMission && hasDestinationCoords && (
                  <View style={styles.infoRow}>
                    <MaterialIcons name="flag" size={18} color="#E53935" style={styles.rowIcon} />
                    <Text style={styles.rowText}>
                      <Text style={styles.rowLabel}>Destination :</Text>{" "}
                      {mission.destination
                        ? mission.destination
                        : `${Number(mission.dest_lat).toFixed(4)}, ${Number(mission.dest_lng).toFixed(4)}`}
                    </Text>
                  </View>
                )}
                {eta && distance && (
                  <View style={styles.infoRow}>
                    <MaterialIcons name="schedule" size={18} color="#E53935" style={styles.rowIcon} />
                    <Text style={styles.rowText}>
                      {Math.round(eta)} min · {distance.toFixed(1)} km
                    </Text>
                  </View>
                )}
                {(typeof mission.preview_total_km === "number" ||
                  typeof totalKm === "number") && (
                  <View style={styles.infoRow}>
                    <MaterialIcons name="alt-route" size={18} color="#E53935" style={styles.rowIcon} />
                    <Text style={styles.rowText}>
                      <Text style={styles.rowLabel}>Distance totale :</Text>{" "}
                      {(mission.preview_total_km ?? totalKm)?.toFixed(1)} km
                    </Text>
                  </View>
                )}
              </View>

              {/* Timeline statut (horizontal) */}
              <View style={[styles.card, { paddingHorizontal: 10 }]}>
                <View style={styles.sectionHeader}>
                  <MaterialIcons name="route" size={18} color="#E53935" />
                  <Text style={styles.sectionTitle}>Suivi de mission</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.timelineWrapper}>
                    <View style={styles.timelineHorizontal}>
                      {timelineSteps.map((step, index) => {
                        const isActive = index === statusIndex;
                        const isDone = index < statusIndex;
                        const isLast = index === timelineSteps.length - 1;
                        const circleBorder = isDone || isActive ? "#E53935" : "#bbb";
                        const circleFill = isDone ? "#E53935" : isActive ? "#fff" : "#f6f6f6";
                        const iconColor = isActive ? "#E53935" : isDone ? "#fff" : "#999";
                        const labelColor = isActive ? "#E53935" : isDone ? "#666" : "#999";
                        const lineColor = isDone || isActive ? "#E53935" : "#ddd";
                        return (
                          <View key={step.key} style={styles.timelineStep}>
                            <View style={styles.timelineRow}>
                              {index > 0 && (
                                <View
                                  style={[
                                    styles.hLine,
                                    { backgroundColor: index <= statusIndex ? "#E53935" : "#ddd" },
                                  ]}
                                />
                              )}
                              <View
                                style={[
                                  styles.hCircle,
                                  { borderColor: circleBorder, backgroundColor: circleFill },
                                ]}
                              >
                                <MaterialIcons name={step.icon as any} size={16} color={iconColor} />
                              </View>
                              {!isLast && (
                                <View style={[styles.hLine, { backgroundColor: lineColor }]} />
                              )}
                            </View>
                            <Text style={[styles.hLabel, { color: labelColor }]} numberOfLines={1}>
                              {step.label}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </ScrollView>
              </View>

              {/* Photos mission */}
              {mission?.photos && mission.photos.length > 0 && (
                <View style={styles.card}>
                  <View style={styles.sectionHeader}>
                    <MaterialIcons name="photo-camera" size={18} color="#E53935" />
                    <Text style={styles.sectionTitle}>Photos</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {mission.photos.slice(0, 3).map((url, index) => {
                      const baseHost = API_URL.replace(/\/api$/, "");
                      const normalize = (u: string) => {
                        if (!u) return "";
                        if (u.startsWith("http")) {
                          try {
                            const api = new URL(baseHost);
                            const current = new URL(u);
                            if (current.origin !== api.origin && current.pathname.startsWith("/uploads/")) {
                              return `${api.origin}${current.pathname}`;
                            }
                            return u;
                          } catch {
                            return u;
                          }
                        }
                        return `${baseHost}${u.startsWith("/") ? u : `/${u}`}`;
                      };
                      const fullUrl = normalize(url);
                      return (
                        <TouchableOpacity
                          key={index}
                          onPress={() => {
                            setCurrentIndex(index);
                            setIsViewerVisible(true);
                          }}
                        >
                          <Image source={{ uri: fullUrl }} style={styles.missionPhoto} />
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <ImageViewing
                    images={mission.photos.slice(0, 3).map((url) => {
                      const baseHost = API_URL.replace(/\/api$/, "");
                      const normalize = (u: string) => {
                        if (!u) return "";
                        if (u.startsWith("http")) {
                          try {
                            const api = new URL(baseHost);
                            const current = new URL(u);
                            if (current.origin !== api.origin && current.pathname.startsWith("/uploads/")) {
                              return `${api.origin}${current.pathname}`;
                            }
                            return u;
                          } catch {
                            return u;
                          }
                        }
                        return `${baseHost}${u.startsWith("/") ? u : `/${u}`}`;
                      };
                      return { uri: normalize(url) };
                    })}
                    imageIndex={currentIndex}
                    visible={isViewerVisible}
                    onRequestClose={() => setIsViewerVisible(false)}
                  />
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* Box flottante en fullscreen */}
        {isFullMap && mission.status === "en_route" && !headingToDestination && (
          <View style={styles.floatingBox}>
            <Text style={styles.floatingTitle}>En route</Text>
            <Text style={styles.floatingAddress}>{mission.adresse}</Text>
            {eta && (
              <>
                <Text style={styles.floatingEta}>Arrivé dans {Math.round(eta)} min</Text>
                {arrivalTime && (
                  <Text style={styles.floatingEta}>
                    Heure estimée : {arrivalTime.getHours()}h
                    {arrivalTime.getMinutes().toString().padStart(2, "0")}
                  </Text>
                )}
              </>
            )}

            <TouchableOpacity style={styles.arrivedBtn} onPress={() => updateStatus("sur_place")}>
              <Text style={styles.arrivedBtnText}>JE SUIS ARRIVÉ</Text>
            </TouchableOpacity>
          </View>
        )}

        {isFullMap && headingToDestination && (
          <View style={styles.floatingBox}>
            <Text style={styles.floatingTitle}>Vers la destination</Text>
            <Text style={styles.floatingAddress}>
              {mission.destination
                ? mission.destination
                : hasDestinationCoords
                ? `${Number(mission.dest_lat).toFixed(4)}, ${Number(mission.dest_lng).toFixed(4)}`
                : "Destination finale"}
            </Text>
            {eta && (
              <>
                <Text style={styles.floatingEta}>Arrivée prévue dans {Math.round(eta)} min</Text>
                {arrivalTime && (
                  <Text style={styles.floatingEta}>
                    Heure estimée : {arrivalTime.getHours()}h
                    {arrivalTime.getMinutes().toString().padStart(2, "0")}
                  </Text>
                )}
              </>
            )}
          </View>
        )}

        {/* Boutons actions */}
        {!isFullMap && (
          <View style={styles.stickyBtn}>
            {mission.status === "publiee" && mission.operator_id === user?.id && (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: "#2EAD55" }]}
                  onPress={acceptAssigned}
                >
                  <Text style={styles.btnText}>Accepter</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: "#9E9E9E" }]}
                  onPress={refuseAssigned}
                >
                  <Text style={styles.btnText}>Refuser</Text>
                </TouchableOpacity>
              </View>
            )}

            {mission.status === "acceptee" && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#E53935" }]}
                onPress={async () => {
                  await updateStatus("en_route");
                }}
              >
                <Text style={styles.btnText}>Démarrer</Text>
              </TouchableOpacity>
            )}

            {mission.status === "en_route" && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#2196F3" }]}
                onPress={async () => {
                  await updateStatus("sur_place");
                  Toast.show({
                    type: "info",
                    text1: "✅ Statut mis à jour",
                    text2: "Vous êtes arrivé sur le lieu d’intervention",
                  });
                }}
              >
                <MaterialIcons name="place" size={22} color="#fff" />
                <Text style={styles.btnText}>Je suis arrivé</Text>
              </TouchableOpacity>
            )}

            {mission.status === "sur_place" && isTowingMission && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#FB8C00" }]}
                onPress={() => updateStatus("remorquage")}
              >
                <MaterialIcons name="build-circle" size={22} color="#fff" />
                <Text style={styles.btnText}>Voiture remorquée</Text>
              </TouchableOpacity>
            )}

            {((mission.status === "remorquage" && isTowingMission) ||
              (mission.status === "sur_place" && !isTowingMission)) && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#4CAF50" }]}
                onPress={() => updateStatus("terminee")}
              >
                <MaterialIcons name="flag" size={22} color="#fff" />
                <Text style={styles.btnText}>Terminer mission</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Bouton téléphone */}
        {!isFullMap && mission.status !== "publiee" && mission.user_phone && (
          <TouchableOpacity style={styles.fab} onPress={callClient}>
            <MaterialIcons name="phone" size={28} color="#fff" />
          </TouchableOpacity>
        )}
      </SafeAreaView>

      {menuVisible && (
        <Animated.View style={[styles.menuOverlay, { opacity: menuFadeAnim }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeMenu}>
            <Animated.View
              style={[styles.menuContainer, { transform: [{ translateX: menuSlideAnim }] }]}
              onStartShouldSetResponder={() => true}
            >
              <TouchableOpacity style={styles.menuClose} onPress={closeMenu}>
                <MaterialIcons name="close" size={26} color="#E53935" />
              </TouchableOpacity>

              <View style={styles.menuHeader}>
                <MaterialIcons name="person" size={50} color="#999" />
                <Text style={styles.menuName}>{user?.name || "Opérateur"}</Text>
                <Text style={{ color: "#666", fontSize: 13 }}>{user?.phone}</Text>
              </View>

              <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    closeMenu();
                    router.push("/operator/parametre");
                  }}
                >
                  <MaterialIcons name="edit" size={22} color="#E53935" />
                  <Text style={styles.menuText}>Paramètres</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    closeMenu();
                    setSupportVisible(true);
                  }}
                >
                  <MaterialIcons name="support-agent" size={22} color="#E53935" />
                  <Text style={styles.menuText}>Service client</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    closeMenu();
                    router.push("/operator/history");
                  }}
                >
                  <MaterialIcons name="history" size={22} color="#E53935" />
                  <Text style={styles.menuText}>Historique</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    closeMenu();
                    router.push("/operator/wallet");
                  }}
                >
                  <MaterialIcons name="account-balance-wallet" size={22} color="#E53935" />
                  <Text style={styles.menuText}>Mes gains</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.menuItem, { marginTop: 30 }]}
                  onPress={() => {
                    closeMenu();
                    logout();
                  }}
                >
                  <MaterialIcons name="logout" size={22} color="#E53935" />
                  <Text style={[styles.menuText, { color: "#E53935" }]}>Déconnexion</Text>
                </TouchableOpacity>
              </ScrollView>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      )}
      <SupportModal visible={supportVisible} onClose={() => setSupportVisible(false)} />
    </>
  );
}

const { height, width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, paddingTop: 75 },
  fullContainer: { padding: 0, paddingTop: 0 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },

  map: {
    height: 320,
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
  },
  mapFull: {
    height: height,
    width: width,
    borderRadius: 0,
    padding: 0,
  },
  fullscreenBtn: {
    position: "absolute",
    top: 15,
    right: 15,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 8,
    borderRadius: 30,
    zIndex: 10,
  },
  focusBtn: {
    position: "absolute",
    top: 60,
    right: 15,
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 10,
    borderRadius: 30,
    zIndex: 10,
  },
  viewToggleBtn: {
    position: "absolute",
    top: 105,
    right: 15,
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 10,
    borderRadius: 30,
    zIndex: 10,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#222", marginLeft: 8 },
  infoRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  rowIcon: { marginRight: 8 },
  rowText: { fontSize: 14, color: "#444", flexShrink: 1 },
  rowLabel: { fontWeight: "700", color: "#222" },
  timelineWrapper: { position: "relative", paddingVertical: 6 },
  timelineHorizontal: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingHorizontal: 0,
    gap: 0,
  },
  timelineStep: {
    flexDirection: "column",
    alignItems: "center",
    flexShrink: 0,
    minWidth: 70,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  hCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#bbb",
    alignItems: "center",
    justifyContent: "center",
  },
  hLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#ddd",
    borderRadius: 3,
  },
  hLabel: { fontSize: 12, color: "#777", maxWidth: 70, marginTop: 4, textAlign: "center" },

  fusedCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#eee",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  fusedRow: { flexDirection: "row", alignItems: "flex-start" },
  fusedLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  fusedName: { fontSize: 15, fontWeight: "700", color: "#222" },
  fusedPhone: { fontSize: 14, color: "#333", fontWeight: "600", marginTop: 2 },
  fusedRight: { alignItems: "flex-end" },
  fusedAmount: { fontSize: 16, fontWeight: "800", color: "#2EAD55", alignSelf: "flex-start" },
  fusedCommission: { marginTop: 4, fontSize: 12, color: "#777" },

  stickyBtn: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    paddingHorizontal: 30,
  },
  actionBtn: {
    width: "100%",
    paddingVertical: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 16, marginLeft: 6 },

  netBox: {
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#eee",
  },
  netTitle: { fontWeight: "bold", color: "#333", marginBottom: 4 },
  netValue: { fontSize: 16, fontWeight: "bold", color: "#1b5e20" },
  netHint: { fontSize: 12, color: "#666", marginTop: 2 },

  fab: {
    position: "absolute",
    bottom: 90,
    right: 25,
    backgroundColor: "#999",
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
  },

  floatingBox: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: "#111111c0",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  floatingTitle: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 5,
  },
  floatingAddress: {
    color: "#fff",
    fontSize: 14,
    marginBottom: 4,
  },
  floatingEta: {
    color: "#bbb",
    fontSize: 12,
    marginBottom: 10,
  },
  arrivedBtn: {
    backgroundColor: "#E53935",
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
  },
  arrivedBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },

  missionPhoto: {
    width: 100,
    height: 100,
    borderRadius: 10,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#eee",
  },
  info: { fontSize: 14, color: "#444", marginBottom: 4 },
  topBar: {
    position: "absolute",
    top: 40,
    left: 20,
    right: 20,
    zIndex: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: { fontSize: 22, fontWeight: "bold" },
  profileBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  menuOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
    zIndex: 50,
  },
  menuContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: "75%",
    backgroundColor: "#fff",
    padding: 20,
    paddingTop: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  menuClose: { alignSelf: "flex-end", marginBottom: 10 },
  menuHeader: { alignItems: "center", marginBottom: 20 },
  menuName: { fontSize: 18, fontWeight: "bold", marginTop: 8 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  menuText: { fontSize: 15, marginLeft: 12, color: "#333" },
  emptyTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 8, textAlign: "center" },
  emptyText: { fontSize: 14, color: "#555", marginHorizontal: 20, marginBottom: 16, textAlign: "center" },
  retryBtn: {
    marginTop: 6,
    backgroundColor: "#E53935",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryText: { color: "#fff", fontWeight: "bold", textAlign: "center" },
});
