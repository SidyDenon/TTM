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
  destination?: string | null;
  dest_lat?: number | null;
  dest_lng?: number | null;
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
  const [commissionPercent, setCommissionPercent] = useState<number>(10);
  const [currency, setCurrency] = useState<string>("FCFA");

  const [operatorLocation, setOperatorLocation] = useState<OperatorLocation | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [isFallbackRoute, setIsFallbackRoute] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [isFullMap, setIsFullMap] = useState(false); // fullscreen state
  const [menuVisible, setMenuVisible] = useState(false);
  const menuSlideAnim = useRef(new Animated.Value(Dimensions.get("window").width)).current;
  const menuFadeAnim = useRef(new Animated.Value(0)).current;

  const mapRef = useRef<MapView>(null);
  const [arrivalTime, setArrivalTime] = useState<Date | null>(null);

  const rotation = useRef(new Animated.Value(0)).current;
  const previousPos = useRef<OperatorLocation | null>(null);
  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const initialLocationSynced = useRef(false);

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
      return false;
    });

    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (mission && mission.status !== "terminee") {
        e.preventDefault();
        Toast.show({
          type: "info",
          text1: "Mission en cours",
          text2: "Vous devez terminer la mission avant de quitter.",
        });
      }
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
          estimated_price: m.estimated_price != null ? Number(m.estimated_price) : undefined,
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
        Toast.show({ type: "error", text1: "Permission GPS refusée" });
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
    const destLat = headingToDestination
      ? Number(mission.dest_lat)
      : Number(mission?.lat);
    const destLng = headingToDestination
      ? Number(mission.dest_lng)
      : Number(mission?.lng);
    if (!operatorLocation || !Number.isFinite(destLat) || !Number.isFinite(destLng)) return;

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

  // 🕒 Heure d’arrivée estimée
  useEffect(() => {
    if (eta) {
      const now = new Date();
      const arrival = new Date(now.getTime() + eta * 60 * 1000);
      setArrivalTime(arrival);
    }
  }, [eta]);

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

  const isTowingMission =
    typeof mission.type === "string" &&
    mission.type.toLowerCase().includes("remorqu");

  const timelineSteps = isTowingMission
    ? STATUSES
    : STATUSES.filter((step) => step.key !== "remorquage");

  const statusIndex = Math.max(
    0,
    timelineSteps.findIndex((s) => s.key === mission.status)
  );

  const hasDestinationCoords =
    typeof mission.dest_lat === "number" &&
    !Number.isNaN(mission.dest_lat) &&
    typeof mission.dest_lng === "number" &&
    !Number.isNaN(mission.dest_lng);

  const headingToDestination =
    isTowingMission &&
    hasDestinationCoords &&
    mission.status === "remorquage";

  return (
    <>
      <Stack.Screen
        options={{
          headerBackVisible: mission?.status === "terminee",
          gestureEnabled: mission?.status === "terminee",
        }}
      />

      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <View style={styles.topBar}>
          <Text style={styles.logo}>
            <Text style={{ color: "#E53935" }}>TT</Text>M
          </Text>
          <TouchableOpacity onPress={openMenu} style={styles.profileBtn}>
            <MaterialIcons name="person-outline" size={26} color="#000" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 140 }}>
          {typeof mission.lat === "number" && typeof mission.lng === "number" && (
            <View style={{ position: "relative" }}>
              <MapView
                ref={mapRef}
                style={isFullMap ? styles.mapFull : styles.map}
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
                  <Marker coordinate={operatorLocation} title="🚚 Vous">
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

              <View style={styles.card}>
                {mission.status !== "publiee" && (
                  <>
                    <Text style={styles.info}>👤 Client : {mission.user_name}</Text>
                    <Text style={styles.info}>📞 {mission.user_phone}</Text>
                  </>
                )}
              </View>

              {/* 💰 Gain net (après commission) */}
              {typeof mission.estimated_price === "number" && (
                <View style={styles.netBox}>
                  <Text style={styles.netTitle}>
                    Gain net {mission.status === "terminee" ? "obtenu" : "estimé"}
                  </Text>
                  <Text style={styles.netValue}>
                    {formatCurrency(
                      Math.max(0, Number(mission.estimated_price) * (1 - commissionPercent / 100))
                    )}{" "}
                    {currency}
                  </Text>
                  <Text style={styles.netHint}>Commission admin: {commissionPercent}%</Text>
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
              <Text style={styles.title}>🚨 Mission #{mission.id}</Text>
              <Text style={styles.subtitle}>{mission.type}</Text>

              {isTowingMission && hasDestinationCoords && (
                <Text style={styles.info}>
                  🎯 Destination :{" "}
                  {mission.destination
                    ? mission.destination
                    : `${Number(mission.dest_lat).toFixed(4)}, ${Number(mission.dest_lng).toFixed(4)}`}
                </Text>
              )}

              {eta && distance && (
                <Text style={styles.info}>
                  ⏱️ {Math.round(eta)} min · {distance.toFixed(1)} km
                </Text>
              )}

              {/* Timeline statut */}
              <View style={styles.timeline}>
                {timelineSteps.map((step, index) => {
                  const isActive = index === statusIndex;
                  const isDone = index < statusIndex;

                  return (
                    <View key={step.key} style={styles.timelineItem}>
                      <View
                        style={[
                          styles.line,
                          (isDone || isActive) && { backgroundColor: "#E53935" },
                        ]}
                      />
                      <View
                        style={[
                          styles.circle,
                          isDone && { backgroundColor: "#E53935", borderColor: "#E53935" },
                          isActive && {
                            backgroundColor: "#fff",
                            borderColor: "#E53935",
                            borderWidth: 3,
                          },
                        ]}
                      >
                        <MaterialIcons
                          name={step.icon as any}
                          size={14}
                          color={isActive ? "#E53935" : isDone ? "#fff" : "#bbb"}
                        />
                      </View>
                      <Text
                        style={[
                          styles.stepText,
                          isActive && { color: "#E53935", fontWeight: "bold" },
                          isDone && { color: "#666" },
                        ]}
                      >
                        {step.label}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Photos mission */}
              {mission?.photos && mission.photos.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.info}>📸 Photos fournies :</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {mission.photos.slice(0, 3).map((url, index) => {
                      const fullUrl = url.startsWith("http") ? url : `${API_URL}${url}`;
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
                    images={mission.photos.slice(0, 3).map((url) => ({
                      uri: url.startsWith("http") ? url : `${API_URL}${url}`,
                    }))}
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
            {mission.status === "acceptee" && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#E53935" }]}
                onPress={async () => {
                  await updateStatus("en_route");
                }}
              >
                <MaterialIcons name="directions-car" size={22} color="#fff" />
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
    </>
  );
}

const { height, width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },

  map: {
    height: 250,
    borderRadius: 12,
    marginBottom: 15,
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

  title: { fontSize: 20, fontWeight: "bold", color: "#E53935" },
  subtitle: { fontSize: 14, color: "#555", marginBottom: 5 },
  info: { fontSize: 14, marginBottom: 15, color: "#333" },

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
  timeline: {
    marginVertical: 20,
    marginLeft: 20,
    borderLeftWidth: 2,
    borderLeftColor: "#ddd",
  },
  timelineItem: {
    position: "relative",
    paddingVertical: 15,
    paddingLeft: 35,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ddd",
    position: "absolute",
    left: -13,
    top: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  line: {
    position: "absolute",
    left: -2,
    top: 38,
    width: 2,
    height: "100%",
    backgroundColor: "#ddd",
  },
  stepText: { fontSize: 14, color: "#555" },

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
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
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
  topBar: {
    position: "absolute",
    top: 50,
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
