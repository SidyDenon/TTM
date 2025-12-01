// app/operator/index.tsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Dimensions,
  Animated,
  PanResponder,
  Platform,
  Alert,
  LayoutAnimation,
  UIManager,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useRouter, useFocusEffect } from "expo-router";
import * as Location from "expo-location";
import { API_URL } from "../../utils/api";
import { formatCurrency } from "../../utils/format";
import { useAuth } from "../../context/AuthContext";
import { MaterialIcons } from "@expo/vector-icons";
import { useSocket } from "../../context/SocketContext";
import { SupportModal } from "../../components/SupportModal";
import { syncOperatorLocation } from "../../utils/operatorProfile";
import { OPERATOR_MISSION_RADIUS_KM } from "../../constants/operator";
import Toast from "react-native-toast-message";


type Mission = {
  id: number;
  ville: string;
  lat: number;
  lng: number;
  type: string;
  address: string;
  description?: string;
  estimated_price?: number;
  photos?: string[];
  user_name?: string;
  user_phone?: string;
  distance?: number;
  status?: string;
  operatorId?: number | null;
};

// Arrondi visuel au plus proche multiple de 50 pour éviter les montants "bizarres"
const roundTo50 = (n: number) => Math.round(n / 50) * 50;

// Active les animations de layout sur Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const normalizeMissionPayload = (mission: any): Mission | null => {
  if (!mission || mission.id == null) return null;
  const cleanNumber = (value: any, fallback = 0) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  };
  const photos = Array.isArray(mission.photos)
    ? mission.photos
    : mission.photos
    ? [mission.photos].flat().filter(Boolean)
    : [];
  return {
    id: cleanNumber(mission.id),
    ville: mission.ville || mission.zone || mission.city || "Ville inconnue",
    lat: cleanNumber(mission.lat),
    lng: cleanNumber(mission.lng),
    type: mission.service || mission.type || "Service",
    address: mission.address || mission.adresse || "Adresse non précisée",
    description: mission.description || "",
    estimated_price:
      mission.estimated_price != null ? cleanNumber(mission.estimated_price) : undefined,
    photos,
    user_name: mission.user_name || mission.client_name || mission.user || "",
    user_phone: mission.user_phone || mission.client_phone || mission.phone || "",
    distance:
      mission.distance != null
        ? cleanNumber(mission.distance)
        : mission.totalKm != null
        ? cleanNumber(mission.totalKm)
        : undefined,
    status: mission.status || "publiee",
    operatorId:
      mission.operator_id != null
        ? cleanNumber(mission.operator_id)
        : mission.operatorId != null
        ? cleanNumber(mission.operatorId)
        : null,
  };
};

const { height } = Dimensions.get("window");
const SNAP_TOP = 0; // panneau calé en haut par défaut
const SNAP_BOTTOM = height * 0.90;

export default function OperatorScreen() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("Tous");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activeMissionId, setActiveMissionId] = useState<number | null>(null);
  const [checkingActiveMission, setCheckingActiveMission] = useState(true);

  const router = useRouter();
  const { token, logout, user } = useAuth();
  const mapRef = useRef<MapView>(null);
  const animateList = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, []);

  // Nouveau state pour menu
const [menuVisible, setMenuVisible] = useState(false);
const [supportVisible, setSupportVisible] = useState(false);

  // Animation panneau
  const translateY = useRef(new Animated.Value(SNAP_TOP)).current;
  const offsetY = useRef(SNAP_TOP);
  const isScrolling = useRef(false);

// --- états animations ---
const slideAnim = useRef(new Animated.Value(Dimensions.get("window").width)).current; // menu à droite
const fadeAnim = useRef(new Animated.Value(0)).current; // overlay invisible
const { socket, isConnected } = useSocket();
const lastProfileSyncRef = useRef(0);
const cancellationNotifiedRef = useRef(false);
// --- ouvrir menu ---
const openMenu = () => {
  setMenuVisible(true);
  Animated.parallel([
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }),
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }),
  ]).start();
};

// --- fermer menu ---
const closeMenu = () => {
  Animated.parallel([
    Animated.timing(slideAnim, {
      toValue: Dimensions.get("window").width,
      duration: 300,
      useNativeDriver: true,
    }),
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }),
  ]).start(() => setMenuVisible(false));
};


  // ✅ Vérifie mission active à chaque focus
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      const checkActiveMission = async () => {
        try {
          setCheckingActiveMission(true);
          const res = await fetch(`${API_URL}/operator/active`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();

          const activeMission = data?.activeMission || data?.data || null;

          if (
            activeMission &&
            activeMission.id &&
            ["assignee", "acceptee", "en_route", "sur_place"].includes(activeMission.status)
          ) {
            setActiveMissionId(Number(activeMission.id));
            router.replace(`/operator/mission/${activeMission.id}`);
            return;
          }
          if (!cancelled) setActiveMissionId(null);
        } catch (err) {
          console.error("❌ Erreur check active mission:", err);
        } finally {
          if (!cancelled) setCheckingActiveMission(false);
        }
      };

      checkActiveMission();
      return () => {
        cancelled = true;
      };
    }, [token, router])
  );

  useEffect(() => {
    const id = translateY.addListener(({ value }) => {
      offsetY.current = value;
    });
    return () => {
      translateY.removeListener(id);
    };
  }, [translateY]);
// 🔗 Connexion socket.io
useEffect(() => {
  if (isConnected && user) {
    console.log("🧠 Socket déjà connecté via contexte :", socket?.id);
    socket?.emit("register", { userId: user.id, role: "operator" });
  }
}, [isConnected, user]);

// 🧠 Écoute des updates en temps réel
useEffect(() => {
  if (!socket) return;

  console.log("📡 [Socket] Écoute mission events sur l’écran opérateur");
  const removalStatuses = new Set([
    "acceptee",
    "assignee",
    "en_route",
    "sur_place",
    "terminee",
    "annulee_admin",
    "annulee_client",
  ]);

  const notify = (
    title: string,
    message: string,
    type: "success" | "info" | "error" = "info",
    position: "top" | "bottom" = "bottom"
  ) => {
    Toast.show({
      type,
      text1: title,
      text2: message,
      visibilityTime: 3000,
      position,
      topOffset: position === "top" ? 55 : undefined,
    });
  };

    const handleMissionCreated = (mission: any) => {
      const normalized = normalizeMissionPayload(mission);
      if (!normalized) return;
      console.log("📩 mission:created", normalized.id);
      setMissions((prev) => {
        if (prev.some((m) => m.id === normalized.id)) return prev;
        animateList();
        return [normalized, ...prev];
      });
      notify("🚨 Nouvelle mission", `Mission #${normalized.id} disponible`);
    };

  const handleMissionUpdated = (mission: any) => {
    if (!mission?.id) return;
    const normalized = normalizeMissionPayload(mission);
    const statusKey = String(mission.status || normalized?.status || "").toLowerCase();
    console.log("📩 mission:updated", mission.id, statusKey);
    if (removalStatuses.has(statusKey)) {
      setMissions((prev) => {
        const next = prev.filter((m) => m.id !== Number(mission.id));
        if (next !== prev) animateList();
        return next;
      });
      if (!cancellationNotifiedRef.current) {
        cancellationNotifiedRef.current = true;
        notify(
          "Mission annulée",
          mission.message || `Mission #${mission.id} indisponible`,
          "error",
          "top"
        );
      }
      return;
    }
    if (!normalized) return;
    setMissions((prev) => {
      const idx = prev.findIndex((m) => m.id === normalized.id);
      if (idx === -1) {
        return [normalized, ...prev];
      }
      const next = [...prev];
      next[idx] = { ...next[idx], ...normalized };
      return next;
    });
  };

  const handleMissionStatusChanged = (payload: { id: number | string; status?: string }) => {
    const missionId = payload?.id;
    if (!missionId) return;
    const statusKey = payload.status ? String(payload.status).toLowerCase() : "";
    console.log("📩 mission:status_changed", missionId, payload.status);
    if (removalStatuses.has(statusKey)) {
      setMissions((prev) => {
        const next = prev.filter((m) => m.id !== Number(missionId));
        if (next !== prev) animateList();
        return next;
      });
      if (!cancellationNotifiedRef.current) {
        cancellationNotifiedRef.current = true;
        notify("Mission annulée", `Mission #${missionId} indisponible`, "error", "top");
      }
      return;
    }
    setMissions((prev) => {
      const idx = prev.findIndex((m) => m.id === Number(missionId));
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], status: payload.status || next[idx].status };
      return next;
    });
  };

  const handleMissionDeleted = (data: any) => {
    const id = typeof data === "object" ? data?.id : data;
    if (!id) return;
    console.log("📩 mission:deleted", id);
    setMissions((prev) => {
      const next = prev.filter((m) => m.id !== Number(id));
      if (next !== prev) animateList();
      return next;
    });
    if (!cancellationNotifiedRef.current) {
      cancellationNotifiedRef.current = true;
      notify("Mission supprimée", `Mission #${id} retirée`, "error", "top");
    }
  };

  socket.on("mission:created", handleMissionCreated);
  socket.on("mission:updated", handleMissionUpdated);
  socket.on("mission:status_changed", handleMissionStatusChanged);
  socket.on("mission:deleted", handleMissionDeleted);

  return () => {
    socket.off("mission:created", handleMissionCreated);
    socket.off("mission:updated", handleMissionUpdated);
    socket.off("mission:status_changed", handleMissionStatusChanged);
    socket.off("mission:deleted", handleMissionDeleted);
  };
}, [socket]);


  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => {
        if (isScrolling.current) return false; // ✅ désactive pendant scroll
        return Math.abs(gesture.dy) > 5;
      },
      onPanResponderMove: (_, gesture) => {
        let newY = offsetY.current + gesture.dy;
        if (newY < SNAP_TOP) newY = SNAP_TOP;
        if (newY > SNAP_BOTTOM) newY = SNAP_BOTTOM;
        translateY.setValue(newY);
      },
      onPanResponderRelease: (_, gesture) => {
        const shouldOpen = gesture.dy < 0;
        Animated.spring(translateY, {
          toValue: shouldOpen ? SNAP_TOP : SNAP_BOTTOM,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

 const recentrerCarte = () => {
  if (!mapRef.current) return;

  const coords = filteredMissions
    .map((m) => ({
      latitude: Number(m.lat),
      longitude: Number(m.lng),
    }))
    .filter(
      (c) =>
        !isNaN(c.latitude) &&
        !isNaN(c.longitude) &&
        c.latitude !== 0 &&
        c.longitude !== 0
    );

  if (location) {
    coords.push({
      latitude: Number(location.lat),
      longitude: Number(location.lng),
    });
  }

  if (coords.length === 0) return; // 🧠 sécurité

  if (coords.length === 1) {
    mapRef.current.animateToRegion({
      latitude: coords[0].latitude,
      longitude: coords[0].longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    });
  } else {
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
      animated: true,
    });
  }
};


  // 📌 Charger les missions
  useEffect(() => {
    let interval: number;

    const fetchMissions = async () => {
      try {
        const res = await fetch(
          `${API_URL}/operator/requests?radius=${OPERATOR_MISSION_RADIUS_KM}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await res.json();

        const missionsNormalisées: Mission[] = (data.data || [])
          .map((m: any) => normalizeMissionPayload(m))
          .filter(Boolean) as Mission[];

        const filtered = missionsNormalisées.filter(
          (mission) => mission.status === "publiee" || (mission.operatorId && user?.id === mission.operatorId)
        );

        animateList();
        setMissions(filtered);
      } catch (err) {
        console.error("❌ Erreur chargement missions", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMissions();
    interval = setInterval(fetchMissions, 10000);

    return () => clearInterval(interval);
  }, [token, user?.id]);

useEffect(() => {
  (async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Toast.show({
          type: "error",
          position: "top",
          text1: "Localisation refusée",
          text2: "Active la localisation pour voir les missions.",
          visibilityTime: 3000,
          topOffset: 55,
        });
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      const coords = {
        lat: Number(loc.coords.latitude),
        lng: Number(loc.coords.longitude),
      };
      setLocation(coords);
      pushProfileLocation(coords);
    } catch (err: any) {
      console.error("❌ Erreur localisation initiale:", err?.message || err);
      Toast.show({
        type: "error",
        position: "top",
        text1: "Localisation indisponible",
        text2: "Vérifie les permissions dans les réglages.",
        visibilityTime: 3000,
        topOffset: 55,
      });
    }
  })();
}, [pushProfileLocation]);


// 🛰️ Suivi GPS continu (mise à jour + envoi socket)
useEffect(() => {
  if (!user) return;
  let watcher: Location.LocationSubscription;

  (async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Toast.show({
          type: "error",
          position: "top",
          text1: "Localisation refusée",
          text2: "Active la localisation pour le suivi en temps réel.",
          visibilityTime: 3000,
          topOffset: 55,
        });
        return;
      }

      watcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,   // toutes les 3 secondes
          distanceInterval: 5,  // ou tous les 5 mètres
        },
        (loc) => {
          const coords = {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          };

          setLocation(coords);
          pushProfileLocation(coords);

          if (activeMissionId && socket) {
            socket.emit("operator_location", {
              operatorId: user.id,
              requestId: activeMissionId,
              ...coords,
            });
          }


          // 👉 et on anime la carte sur la position
          if (mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: coords.lat,
              longitude: coords.lng,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
          }
        }
      );
    } catch (err: any) {
      console.error("❌ Erreur watchPosition:", err?.message || err);
      Toast.show({
        type: "error",
        position: "top",
        text1: "Localisation indisponible",
        text2: "Impossible d’activer le suivi GPS.",
        visibilityTime: 3000,
        topOffset: 55,
      });
    }
  })();

  return () => watcher && watcher.remove();
}, [user, activeMissionId]);

// 📌 Auto recentrage sécurisé
useEffect(() => {
  if (!mapRef.current) return;

  // Conversion en nombres + filtrage des coordonnées invalides
  const coords = filteredMissions
    .map((m) => ({
      latitude: Number(m.lat),
      longitude: Number(m.lng),
    }))
    .filter(
      (c) =>
        !isNaN(c.latitude) &&
        !isNaN(c.longitude) &&
        c.latitude !== 0 &&
        c.longitude !== 0
    );

  if (location) {
    coords.push({
      latitude: Number(location.lat),
      longitude: Number(location.lng),
    });
  }

  if (coords.length === 0) return;

  if (coords.length === 1) {
    mapRef.current.animateToRegion(
      {
        latitude: coords[0].latitude,
        longitude: coords[0].longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      1000
    );
  } else {
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
      animated: true,
    });
  }
}, [missions, location]);

  const types = ["Tous", ...new Set(missions.map((m) => m.type).filter(Boolean))];

const filteredMissions = missions.filter((m) => {
  const matchType = typeFilter === "Tous" || m.type === typeFilter;
  return matchType;
});

  const pushProfileLocation = useCallback(
    async (coords: { lat: number; lng: number }) => {
      if (!token) return;
      const now = Date.now();
      if (now - lastProfileSyncRef.current < 30000) return;
      lastProfileSyncRef.current = now;
      try {
        await syncOperatorLocation(token, coords);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("⚠️ Sync profil opérateur:", msg);
      }
    },
    [token]
  );

  const accepterMission = (id: number) => {
    Alert.alert("Confirmation", "Voulez-vous accepter cette mission ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Accepter",
          onPress: async () => {
    try {
      const res = await fetch(`${API_URL}/operator/requests/${id}/accepter`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Erreur", data.error || "Impossible d’accepter la mission");
        return;
      }

      if (Platform.OS === "android") {
        ToastAndroid.show("✅ Mission acceptee !", ToastAndroid.SHORT);
      } else {
        Alert.alert("✅ Mission acceptee !");
      }

      // ✅ Activation du tracking
      setActiveMissionId(id);

      // ✅ Mise à jour locale
      setMissions((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...data.mission, status: "active" } : m))
      );

      // ✅ Redirection vers la page de mission
      router.replace(`/operator/mission/${id}`);
    } catch (err) {
      console.error("❌ Erreur acceptation mission:", err);
      Alert.alert("Erreur", "Impossible d’accepter la mission");
    }
          },

      },
    ]);
  };

  if (loading || checkingActiveMission) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#E53935" />
        <Text style={{ marginTop: 8 }}>Chargement des missions...</Text>
      </View>
    );
  }

  if (!location || isNaN(location.lat) || isNaN(location.lng)) {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" color="#E53935" />
      <Text>Chargement de la carte...</Text>
    </View>
  );
}

  return (
  <View style={styles.container}>
    {/* ✅ Barre top avec logo + icône profil */}
    <View style={styles.topBar}>
      <Text style={styles.logo}>
        <Text style={{ color: "#E53935" }}>TT</Text>
        <Text style={{ color: "#000" }}>M</Text>
      </Text>

      <TouchableOpacity onPress={() => openMenu()} style={styles.profileBtn}>
        <MaterialIcons name="person-outline" size={26} color="#000" />
      </TouchableOpacity>
    </View>

<MapView
  ref={mapRef}
  style={styles.map}
  provider={PROVIDER_GOOGLE}
  mapType="standard"
  initialRegion={{
    latitude: Number(location?.lat) || 12.6392,
    longitude: Number(location?.lng) || -8.0029,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  }}
>

  {/* 🔵 Position de l’opérateur */}
  {location && (
  <Marker
    coordinate={{
      latitude: Number(location.lat),
      longitude: Number(location.lng),
    }}
    title="Vous êtes ici"
    pinColor="blue"
  />
)}

{/* 📍 Marqueurs des missions disponibles */}
{filteredMissions.map((mission) => (
  <Marker
    key={mission.id}
    coordinate={{
      latitude: Number(mission.lat),
      longitude: Number(mission.lng),
    }}
    title={`Mission #${mission.id}`}
    description={mission.address || "Adresse non précisée"}
  >
    <View
      style={{
        backgroundColor: "#E53935",
        padding: 6,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: "#fff",
      }}
    >
      <MaterialIcons name="location-on" size={26} color="#fff" />
    </View>
  </Marker>
))}


</MapView>



    {/* ✅ Panneau des missions */}
    <Animated.View style={styles.panel}>
      <View style={styles.headerCard}>
        <Text style={styles.headerText}>
          {filteredMissions.length} missions disponibles
        </Text>
        <TouchableOpacity onPress={recentrerCarte} style={styles.recenterBtn}>
          <MaterialIcons name="my-location" size={22} color="#E53935" />
        </TouchableOpacity>
      </View>

      {/* Filtres type */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        {types.map((t, index) => (
          <TouchableOpacity
            key={`type-${index}`}
            style={[styles.filterBtn, typeFilter === t && styles.filterActive]}
            onPress={() => setTypeFilter(t)}
          >
            <Text
              style={
                typeFilter === t ? styles.filterTextActive : styles.filterText
              }
            >
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Liste des missions */}
      {filteredMissions.length === 0 ? (
        <View style={styles.noMissionContainer}>
          <Text style={styles.noMissionText}>⚠️ Aucune mission trouvée</Text>
        </View>
      ) : (
        <FlatList
          data={filteredMissions}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 16 }}
          showsVerticalScrollIndicator
          renderItem={({ item }) => (
            <View style={styles.missionCard}>
              <View style={styles.photoBadge}>
                <MaterialIcons name="photo-library" size={16} color="#fff" />
                <Text style={styles.photoBadgeText}>{item.photos?.length || 0}</Text>
              </View>

              <View style={styles.missionHeader}>
                <Text style={styles.missionTitle}>
                  Mission #{item.id} {item.type || "Inconnu"}
                </Text>
              </View>
              <View style={styles.rowInfo}>
                <MaterialIcons name="place" size={16} color="#777" />
                <Text style={styles.missionInfoText} numberOfLines={1}>
                  {item.address || "Adresse non précisée"}
                </Text>
              </View>

              {item.distance != null && Number.isFinite(item.distance) && (
                <View style={styles.rowInfo}>
                  <MaterialIcons name="straighten" size={16} color="#777" />
                  <Text style={styles.missionInfoText}>
                    {Number(item.distance).toFixed(1)} km
                  </Text>
                </View>
              )}
              {item.estimated_price !== undefined && (
                <View style={styles.rowInfo}>
                  <MaterialIcons name="payments" size={16} color="#777" />
                  <Text style={styles.missionInfoText}>
                    {formatCurrency(roundTo50(item.estimated_price))}
                  </Text>
                </View>
              )}

              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={styles.acceptBtn}
                  onPress={() => accepterMission(item.id)}
                >
                  <Text style={styles.buttonText}>Accepter</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.detailsBtn}
                  onPress={() => router.push(`/operator/details/${item.id}`)}
                >
                  <Text style={[styles.buttonText, { color: "#444" }]}>Voir détails</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </Animated.View>

    {/* ✅ Menu latéral */}
    {menuVisible && (
      <Animated.View
        style={[styles.menuOverlay, { opacity: fadeAnim }]} // overlay fade in/out
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={closeMenu}
        >
          <Animated.View
            style={[
              styles.menuContainer,
              { transform: [{ translateX: slideAnim }] }, // slide du menu
            ]}
            onStartShouldSetResponder={() => true} // bloque clics intérieurs
          >
            {/* Bouton fermer */}
            <TouchableOpacity style={styles.menuClose} onPress={closeMenu}>
              <MaterialIcons name="close" size={26} color="#E53935" />
            </TouchableOpacity>

            <View style={styles.menuHeader}>
              <MaterialIcons name="person" size={50} color="#999" />
              <Text style={styles.menuName}>{user?.name || "Opérateur"}</Text>
              <Text style={{ color: "#666", fontSize: 13 }}>{user?.phone}</Text>
            </View>

            {/* Items scrollables */}
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
            <MaterialIcons
              name="account-balance-wallet"
              size={22}
              color="#E53935"
            />
            <Text style={styles.menuText}>Mes gains</Text>
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

          {/* Déconnexion */}
          <TouchableOpacity
            style={[styles.menuItem, { marginTop: 30 }]}
            onPress={() => {
                  closeMenu();
                  logout();
                }}
              >
                <MaterialIcons name="logout" size={22} color="#E53935" />
                <Text style={[styles.menuText, { color: "#E53935" }]}>
                  Déconnexion
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    )}
      <SupportModal visible={supportVisible} onClose={() => setSupportVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  map: { height: 0, width: "100%" },

  // ✅ Top bar
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    padding: 20,
    paddingTop: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  logo: { fontSize: 22, fontWeight: "bold" },
  profileBtn: {
    backgroundColor: "#fff",
    padding: 6,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },

  panel: {
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  handle: {
    width: 60,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#ccc",
    alignSelf: "center",
    marginBottom: 8,
  },
  headerCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#eee",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#eee",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  headerText: { fontSize: 13, fontWeight: "600", color: "#E53935" },
  recenterBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },

  filterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#f2f2f2",
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 0,
    height: 30,
  },
  filterActive: { backgroundColor: "#E53935" },
  filterText: { color: "#333" },
  filterTextActive: { color: "#fff", fontWeight: "bold" },

  missionCard: {
    position: "relative",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 18, // espace badge + boutons colonne
    paddingBottom: 12,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: "#eee",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    minHeight: 120,
  },
  missionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  missionTitle: { fontWeight: "bold", fontSize: 15, marginLeft: 6, color: "#111", marginRight: 120 },
  rowInfo: { flexDirection: "row", alignItems: "center", marginBottom: 4, gap: 6, marginRight: 120 },
  missionInfoText: { fontSize: 13, color: "#444", flexShrink: 1 },
  btnRow: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "column",
    gap: 8,
    alignItems: "stretch",
  },
  acceptBtn: {
    backgroundColor: "#4CAF50",
    paddingVertical: 10,
    borderRadius: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    minWidth: 120,
  },
  detailsBtn: {
    backgroundColor: "#e5e5e5",
    paddingVertical: 10,
    borderRadius: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    minWidth: 120,
  },
  buttonText: { color: "#fff", fontWeight: "bold" },
  noMissionContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  noMissionText: {
    fontSize: 14,
    color: "#999",
    fontStyle: "italic",
  },
  photoBadge: {
    position: "absolute",
    top: -6,
    left: -6,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E53935",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  photoBadgeText: {
    color: "#fff",
    fontSize: 12,
    marginLeft: 3,
    fontWeight: "bold",
  },

 menuOverlay: {
  position: "absolute",
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
  backgroundColor: "rgba(0,0,0,0.3)", // devient animé via fadeAnim
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
  shadowColor: "#000",
  shadowOpacity: 0.2,
  shadowRadius: 8,
  elevation: 5,
  paddingTop: 20,
},

menuClose: { alignSelf: "flex-end", marginBottom: 10, },
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

});
