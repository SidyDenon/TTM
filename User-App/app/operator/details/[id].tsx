import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import MapView, { Marker } from "react-native-maps";
import { API_URL } from "../../../utils/api";
import { formatCurrency } from "../../../utils/format";
import { useAuth } from "../../../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { useSocket } from "../../../context/SocketContext";
import * as Haptics from "expo-haptics";
import Loader from "../../../components/Loader";
import {
  canUseNotifications as notificationsAvailable,
  showLocalNotification,
} from "../../lib/notifications";
import { OPERATOR_MISSION_RADIUS_KM } from "../../../constants/operator";

const canUseNotifications = notificationsAvailable;

type Mission = {
  id: number;
  ville?: string;
  lat: number;
  lng: number;
  type: string;
  adresse: string;
  description?: string;
  user_name?: string;
  user_phone?: string;
  estimated_price?: number;
  preview_final_price?: number | null;
  preview_total_km?: number | null;
  photos?: string[];
  status: string;
  destination?: string | null;
  dest_lat?: number | null;
  dest_lng?: number | null;
  distance?: number | null;
};

export default function MissionDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const { socket } = useSocket();

  const [mission, setMission] = useState<Mission | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // 🔹 Charger les détails de mission
  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await fetch(
          `${API_URL}/operator/requests/${id}?radius=${OPERATOR_MISSION_RADIUS_KM}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await res.json();
        const m = data.data;

        const lat = parseFloat(m.lat);
        const lng = parseFloat(m.lng);
        const distance =
          m.preview_total_km != null
            ? Number(m.preview_total_km)
            : m.distance != null
            ? Number(m.distance)
            : m.totalKm != null
            ? Number(m.totalKm)
            : null;

        setMission({
          id: m.id,
          ville: m.ville || m.zone || "Non précisée",
          lat: isNaN(lat) ? 0 : lat,
          lng: isNaN(lng) ? 0 : lng,
          adresse: m.address || "Adresse non précisée",
          type: m.service || "Service inconnu",
          description: m.description,
          estimated_price: m.estimated_price,
          preview_final_price:
            m.preview_final_price != null ? Number(m.preview_final_price) : null,
          preview_total_km:
            m.preview_total_km != null ? Number(m.preview_total_km) : null,
          status: m.status,
          photos: m.photos || [],
          user_name: m.client_name,
          user_phone: m.client_phone,
          destination: m.destination || null,
          dest_lat: m.dest_lat != null ? Number(m.dest_lat) : null,
          dest_lng: m.dest_lng != null ? Number(m.dest_lng) : null,
          distance: Number.isFinite(distance) ? distance : null,
        });
      } catch (err) {
        console.error("❌ Erreur détail mission:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id, token]);

  // 📡 Temps réel : écoute des mises à jour
useEffect(() => {
  if (!socket) return;

  console.log("📡 [Socket] Écoute mission events sur l’écran détail");

  // ✅ Fonction utilitaire (avec types)
  const triggerNotification = async (title: string, body: string) => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (!canUseNotifications) return;
      await showLocalNotification(title, body);
    } catch (err) {
      console.error("❌ Erreur triggerNotification:", err);
    }
  };

  // 🔁 Typage du payload reçu
  type MissionUpdatePayload = {
    id: number | string;
    status: string;
    message?: string;
  };

  const handleMissionUpdate = (data: MissionUpdatePayload) => {
    const { id: missionId, status, message } = data;

    if (Number(missionId) === Number(id)) {
      setMission((prev) => (prev ? { ...prev, status } : prev));

      Toast.show({
        type: "info",
        text1: "Mise à jour en direct",
        text2: message || `Mission ${status}`,
      });

      triggerNotification("📡 Mise à jour de la mission", message || `Statut : ${status}`);

      if (status === "terminee") {
        setTimeout(() => router.replace("/operator"), 1500);
      }
    }
  };

  const handleMissionDeleted = (payload: { id?: number } | number) => {
    const missionId = typeof payload === "object" ? payload?.id : payload;
    if (Number(missionId) !== Number(id)) return;
    Toast.show({
      type: "info",
      text1: "Mission retirée",
      text2: `La mission #${missionId} n'est plus disponible.`,
    });
    setTimeout(() => router.back(), 1200);
  };

  socket.on("mission:updated", handleMissionUpdate);
  socket.on("mission:status_changed", handleMissionUpdate);
  socket.on("mission:deleted", handleMissionDeleted);

  return () => {
    socket.off("mission:updated", handleMissionUpdate);
    socket.off("mission:status_changed", handleMissionUpdate);
    socket.off("mission:deleted", handleMissionDeleted);
  };
}, [socket, id, router]);
  // ✅ Accepter mission
  const accepterMission = async () => {
    try {
      const res = await fetch(`${API_URL}/operator/requests/${id}/accepter`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        Toast.show({
          type: "error",
          text1: "Erreur",
          text2: data.error || "Impossible d’accepter la mission",
        });
        return;
      }

      Toast.show({
        type: "success",
        text1: "✅ Mission acceptee",
        text2: "Redirection en cours...",
      });

      setTimeout(() => {
        router.replace(`/operator/mission/${id}`);
      }, 1200);
    } catch (err) {
      console.error("❌ Erreur acceptation:", err);
      Toast.show({
        type: "error",
        text1: "Erreur",
        text2: "Un problème est survenu",
      });
    }
  };

  // 🕐 Loading
  if (loading) {
    return (
      <View style={styles.loader}>
        <Loader />
        <Text>Chargement mission...</Text>
      </View>
    );
  }

  if (!mission) {
    return (
      <View style={styles.loader}>
        <Text>❌ Mission introuvable</Text>
      </View>
    );
  }

  // 🚧 Protection lat/lng
  const validCoords =
    !isNaN(Number(mission.lat)) &&
    !isNaN(Number(mission.lng)) &&
    mission.lat !== 0 &&
    mission.lng !== 0;

  const isRemorquage =
    typeof mission.type === "string" &&
    mission.type.toLowerCase().includes("remorqu");

  const hasDestinationCoords =
    typeof mission.dest_lat === "number" &&
    !Number.isNaN(mission.dest_lat ?? NaN) &&
    typeof mission.dest_lng === "number" &&
    !Number.isNaN(mission.dest_lng ?? NaN);

  const displayPrice =
    mission.preview_final_price != null && Number.isFinite(mission.preview_final_price)
      ? mission.preview_final_price
      : mission.estimated_price != null && Number.isFinite(mission.estimated_price)
      ? mission.estimated_price
      : null;

  const displayDistance =
    mission.preview_total_km != null && Number.isFinite(mission.preview_total_km)
      ? mission.preview_total_km
      : mission.distance != null && Number.isFinite(mission.distance) && mission.distance > 0
      ? mission.distance
      : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView style={styles.container}>
        {/* ✅ Carte */}
        {validCoords && (
          <View style={styles.mapWrapper}>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: Number(mission.lat),
                longitude: Number(mission.lng),
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
            >
              <Marker
                coordinate={{
                  latitude: Number(mission.lat),
                  longitude: Number(mission.lng),
                }}
                title={`Mission #${mission.id}`}
                description={mission.adresse}
              />

              {isRemorquage && hasDestinationCoords && (
                <Marker
                  coordinate={{
                    latitude: Number(mission.dest_lat),
                    longitude: Number(mission.dest_lng),
                  }}
                  pinColor="#1B5E20"
                  title="Destination finale"
                  description={
                    mission.destination ||
                    `${Number(mission.dest_lat).toFixed(4)}, ${Number(mission.dest_lng).toFixed(4)}`
                  }
                />
              )}
            </MapView>
          </View>
        )}

        {/* 📋 Détails mission */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Détails de la mission</Text>
          <InfoLine icon="location-city" label="Ville" value={mission.ville} />
          <InfoLine icon="place" label="Adresse" value={mission.adresse} />
          <InfoLine icon="build" label="Type" value={mission.type} />
          {isRemorquage && (
            <InfoLine
              icon="flag"
              label="Destination"
              value={
                mission.destination
                  ? mission.destination
                  : hasDestinationCoords
                  ? `${Number(mission.dest_lat).toFixed(4)}, ${Number(mission.dest_lng).toFixed(4)}`
                  : "Non définie"
              }
            />
          )}
          <InfoLine
            icon="attach-money"
            label="Prix estimé"
            value={
              displayPrice != null ? formatCurrency(displayPrice) : "Non défini"
            }
          />
          <InfoLine
            icon="description"
            label="Description"
            value={mission.description || "Aucune description"}
          />
          {displayDistance != null && (
            <InfoLine
              icon="straighten"
              label="Distance estimée"
              value={`${Number(displayDistance).toFixed(1)} km`}
            />
          )}
        </View>

        {/* Photos */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Photos</Text>
          {mission.photos && mission.photos.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {mission.photos.map((url, index) => {
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
                const norm = normalize(url);
                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => setSelectedPhoto(norm)}
                  >
                    <Image source={{ uri: norm }} style={styles.photo} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={styles.info}>Aucune photo disponible</Text>
          )}
        </View>

        {/* ✅ Boutons */}
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.btnRefuser]}
            onPress={() => router.back()}
          >
            <Text style={styles.btnText}>Refuser</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.btnAccepter]}
            onPress={accepterMission}
          >
            <Text style={styles.btnText}>Accepter</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 🖼️ Modal photo agrandie */}
      <Modal visible={!!selectedPhoto} transparent>
        <View style={styles.modalWrapper}>
          <TouchableOpacity
            style={styles.modalClose}
            onPress={() => setSelectedPhoto(null)}
          >
            <Text style={{ color: "#fff", fontSize: 18 }}>✖</Text>
          </TouchableOpacity>
          {selectedPhoto && (
            <Image source={{ uri: selectedPhoto }} style={styles.fullPhoto} />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function InfoLine({
  icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.iconBadge}>
        <MaterialIcons name={icon} size={16} color="#E53935" />
      </View>
      <Text style={styles.rowText}>
        <Text style={styles.rowLabel}>{label} : </Text>
        {value ?? "—"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  mapWrapper: {
    position: "relative",
    height: 240,
    borderRadius: 15,
    overflow: "hidden",
    marginBottom: 15,
  },
  map: { flex: 1 },
  card: {
    marginBottom: 15,
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
    color: "#222",
    letterSpacing: 0.2,
  },
  info: { fontSize: 14, marginBottom: 6, color: "#444" },
  photo: { width: 120, height: 120, borderRadius: 12, marginRight: 10 },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  iconBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#FDECEC",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  rowText: { fontSize: 14, color: "#444", flexShrink: 1 },
  rowLabel: { fontWeight: "700", color: "#222" },
  btnRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 30,
    gap: 12,
  },
  actionBtn: {
    minWidth: 150,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnRefuser: { backgroundColor: "#9E9E9E" },
  btnAccepter: { backgroundColor: "#E53935" },
  btnText: { color: "#fff", fontWeight: "700", letterSpacing: 0.2 },
  modalWrapper: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalClose: { position: "absolute", top: 40, right: 20, zIndex: 10 },
  fullPhoto: { width: "90%", height: "70%", resizeMode: "contain" },
});
