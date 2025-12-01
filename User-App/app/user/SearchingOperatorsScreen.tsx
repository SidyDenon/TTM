// app/user/SearchingOperatorsScreen.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { API_URL } from "../../utils/api";
import AnimatedRe, { FadeInUp } from "react-native-reanimated";
import Toast from "react-native-toast-message";
import MapView, { PROVIDER_GOOGLE, Region } from "react-native-maps";
import * as Location from "expo-location";

const SERVICE_CLIENT_NUMBER = "+22300000000"; // 👉 remplace par ton vrai numéro

type MissionUpdatePayload = {
  id: number | string;
  status: string;
  operator_name?: string;
  message?: string;
  final_price?: number | null;
  estimated_price?: number | null;
  currency?: string | null;
  service?: string | null;
  total_km?: number | null;
};

const DEFAULT_REGION: Region = {
  latitude: 12.6392, // Bamako par défaut, à adapter si tu veux
  longitude: -8.0029,
  latitudeDelta: 0.2,
  longitudeDelta: 0.2,
};

export default function SearchingOperatorsScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const { token } = useAuth();
  const { socket } = useSocket();
  const router = useRouter();

  const [status, setStatus] = useState<"pending" | "accepted" | "timeout">(
    "pending"
  );
  const [operatorName, setOperatorName] = useState<string | null>(null);
  const [quote, setQuote] = useState<{ amount: number; currency?: string | null } | null>(null);
  const [service, setService] = useState<string | null>(null);
  const [totalKm, setTotalKm] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const cancellationNotifiedRef = useRef(false);

  const [region, setRegion] = useState<Region | null>(null);

  const pulseAnim = useRef(new Animated.Value(0)).current;
  const numericId = requestId ? Number(requestId) : null;

  const formatAmount = (amount: number, currency?: string | null) => {
    if (!Number.isFinite(amount)) return "—";
    const formatted = new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
    return `${formatted} ${currency || "FCFA"}`;
  };

  const goToTracking = () => {
    router.replace("/user/SuiviMissionScreen");
  };

  /* ------- MAP / LOCALISATION (juste pour le fond) ------- */
  useEffect(() => {
    (async () => {
      try {
        const { status } =
          await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          // On garde juste la région par défaut
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        setRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      } catch (e) {
        // Pas bloquant : on reste sur la région par défaut
        console.log("⚠️ Erreur localisation searching screen:", e);
      }
    })();
  }, []);

  // 🔁 Animation radar (loop)
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  // ⏱️ Timeout soft UI
  useEffect(() => {
    if (!requestId) return;

    const timer = setTimeout(() => {
      if (status === "pending") setStatus("timeout");
    }, 60000); // 60s

    return () => clearTimeout(timer);
  }, [requestId, status]);

  // 🔌 Socket : updates mission
  useEffect(() => {
    if (!socket || !token || !requestId) return;

    const idNum = Number(requestId);

    const onConnect = () => {
      socket.emit("register", { token });
      socket.emit("join_request", { requestId: idNum });
    };

    const onMissionUpdate = (data: MissionUpdatePayload) => {
      if (Number(data.id) !== idNum) return;

      if (data.status === "acceptee") {
        const name = data.operator_name ?? "Un dépanneur";
        const amount =
          typeof data.final_price === "number"
            ? data.final_price
            : typeof data.estimated_price === "number"
          ? data.estimated_price
          : null;
        if (data.service) setService(data.service);
        if (typeof data.total_km === "number") setTotalKm(data.total_km);

        Toast.show({
          type: "success",
          text1: "Mission acceptée",
          text2: `${name} a accepté ta mission et se dirige vers toi.`,
        });

        setStatus("accepted");
        setOperatorName(data.operator_name ?? null);
        if (amount !== null) {
          setQuote({ amount, currency: data.currency || "FCFA" });
        }
      } else if (data.status === "terminee") {
        router.replace({
          pathname: "/user/PaymentScreen",
          params: { missionId: String(data.id) },
        });
        return;
      } else if (
        data.status === "annulee_admin" ||
        data.status === "annulee_client"
      ) {
        if (!cancellationNotifiedRef.current) {
          cancellationNotifiedRef.current = true;
          Toast.show({
            type: "error",
            text1: "Mission annulée",
            text2: data.message || "Ta mission a été annulée par l’administrateur.",
            visibilityTime: 3000,
            position: "top",
            topOffset: 55,
            onHide: () => router.replace("/user"),
          });
          setStatus("timeout");
        }
      }
    };

    const onMissionDeleted = (payload: { id?: number | string }) => {
      if (Number(payload?.id) !== idNum) return;
      if (!cancellationNotifiedRef.current) {
        cancellationNotifiedRef.current = true;
        Toast.show({
          type: "error",
          text1: "Mission supprimée",
          text2: "Ta mission a été retirée.",
          visibilityTime: 3000,
          position: "top",
          topOffset: 55,
          onHide: () => router.replace("/user"),
        });
        setStatus("timeout");
      }
    };

    socket.on("connect", onConnect);
    socket.on("mission:updated", onMissionUpdate);
    socket.on("mission:status_changed", onMissionUpdate);
    socket.on("mission:deleted", onMissionDeleted);

    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("mission:updated", onMissionUpdate);
      socket.off("mission:status_changed", onMissionUpdate);
      socket.off("mission:deleted", onMissionDeleted);
    };
  }, [socket, token, requestId, router]);

  // ❌ Annuler la mission tant qu’elle n’est pas acceptée
  const handleCancel = () => {
    if (!requestId) return;
    if (status === "accepted") return;

    Alert.alert(
      "Annuler la mission ?",
      "Es-tu sûr de vouloir annuler ta demande de dépannage ?",
      [
        { text: "Non", style: "cancel" },
        {
          text: "Oui, annuler",
          style: "destructive",
          onPress: async () => {
            try {
              setCancelling(true);
              const res = await fetch(
                `${API_URL}/requests/${requestId}/cancel`,
                {
                  method: "POST",
                  headers: { Authorization: `Bearer ${token}` },
                }
              );
              if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(
                  j.error || "Impossible d’annuler la mission."
                );
              }
              router.replace("/user");
            } catch (e: any) {
              Alert.alert(
                "Erreur",
                e.message || "Erreur lors de l’annulation."
              );
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  const scale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.35],
  });

  const opacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0],
  });

  const callServiceClient = () => {
    Linking.openURL(`tel:${SERVICE_CLIENT_NUMBER}`);
  };

  const isPending = status === "pending";
  const isAccepted = status === "accepted";
  const isTimeout = status === "timeout";

  return (
    <SafeAreaView style={styles.container}>
      {/* 🗺️ MAP EN FOND */}
      <MapView
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        mapType="standard"
        showsUserLocation
        initialRegion={region || DEFAULT_REGION}
      />

      {/* Overlay sombre pour lisibilité */}
      <View style={styles.mapOverlay} />

      {/* Header logo */}
      <View style={styles.header}>
        <Text style={styles.logo}>
          <Text style={{ color: "#E53935" }}>TT</Text>M
        </Text>
      </View>

      {/* Contenu principal */}
      <View style={styles.contentWrapper}>
        {/* Radar */}
        <View style={styles.radarWrapper}>
          <Animated.View
            style={[
              styles.radarPulse,
              { transform: [{ scale }], opacity },
            ]}
          />
         <View style={styles.radarCenter}>
  <Animated.Image
    source={require("../../assets/animations/find.gif")}
    style={{ width: 70, height: 70, borderRadius: 35 }}
    resizeMode="contain"
  />
</View>

        </View>

        {/* Bottom sheet */}
        <AnimatedRe.View
          entering={FadeInUp.duration(400)}
          style={styles.bottomSheet}
        >
          <View style={styles.sheetHandle} />

          {/* Chip d’état + ref */}
          <View style={styles.statusRow}>
            <View style={styles.statusChip}>
              <View
                style={[
                  styles.statusDot,
                  isPending && { backgroundColor: "#FFC107" },
                  isAccepted && { backgroundColor: "#4CAF50" },
                  isTimeout && { backgroundColor: "#FF5252" },
                ]}
              />
              <Text style={styles.statusText}>
                {isPending && "Recherche en cours"}
                {isAccepted && "Dépanneur trouvé"}
                {isTimeout && "Aucun dépanneur disponible"}
              </Text>
            </View>

            {numericId && (
              <View style={styles.refBadge}>
                <MaterialIcons
                  name="confirmation-number"
                  size={14}
                  color="#aaa"
                />
                <Text style={styles.refText}>#{numericId}</Text>
              </View>
            )}
          </View>

          {/* Textes */}
          {isPending && (
            <>
              <Text style={styles.title}>
                Nous cherchons un dépanneur…
              </Text>
              <Text style={styles.subtitle}>
                Les dépanneurs les plus proches reçoivent ta demande. Cela peut
                prendre jusqu’à une minute.
              </Text>
            </>
          )}

          {isAccepted && (
            <>
              <Text style={styles.title}>
                {service && service.toLowerCase().includes("remorqu")
                  ? "Un remorqueur arrive 🚚"
                  : "Un dépanneur arrive 🚚"}
              </Text>
              <Text style={styles.subtitle}>
                {operatorName
                  ? `${operatorName} a accepté ta mission. Tu vas être redirigé vers le suivi en direct.`
                  : "Un dépanneur a accepté ta mission. Redirection vers le suivi…"}
              </Text>
              <View style={styles.quoteCard}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={styles.quoteLabel}>Prix final</Text>
                  {quote?.currency && (
                    <Text style={styles.quoteCurrency}>{quote.currency}</Text>
                  )}
                </View>
                <Text style={styles.quoteAmount}>
                  {quote ? formatAmount(quote.amount, quote.currency) : "—"}
                </Text>
                <Text style={styles.quoteHint}>
                  Montant recalculé selon la distance réelle du remorquage.
                </Text>
                {typeof totalKm === "number" && (
                  <Text style={styles.quoteHint}>
                    Distance totale estimée : {totalKm.toFixed(1)} km
                  </Text>
                )}
              </View>
            </>
          )}

          {isTimeout && (
            <>
              <Text style={styles.title}>
                Pas de dépanneur pour le moment
              </Text>
              <Text style={styles.subtitle}>
                Aucun dépanneur n’a pu accepter ta demande. Tu peux réessayer
                dans quelques instants ou appeler le service client.
              </Text>
            </>
          )}

          {/* Boutons */}
          <View style={styles.buttons}>
            {isPending && (
              <TouchableOpacity
                style={[styles.primaryBtn, cancelling && { opacity: 0.6 }]}
                onPress={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MaterialIcons
                      name="cancel"
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.primaryText}>
                      Annuler la mission
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {isTimeout && (
              <>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => setStatus("pending")}
                >
                  <MaterialIcons
                    name="refresh"
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.primaryText}>Réessayer</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.linkBtn}
                  onPress={() => router.replace("/user")}
                >
                  <Text style={styles.linkBtnText}>
                    Retour à l’accueil
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {isAccepted && (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: "#4CAF50" }]}
                onPress={goToTracking}
              >
                <MaterialIcons name="navigation" size={20} color="#fff" />
                <Text style={styles.primaryText}>Suivre la mission</Text>
              </TouchableOpacity>
            )}

            {/* Service client */}
            <TouchableOpacity
              style={styles.outlineBtn}
              onPress={callServiceClient}
            >
              <Ionicons name="call" size={18} color="#E53935" />
              <Text style={styles.outlineText}>
                Appeler le service client
              </Text>
            </TouchableOpacity>
          </View>
        </AnimatedRe.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)", // assombrit la map
  },

  header: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    zIndex: 5,
  },
  logo: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },

  contentWrapper: {
    flex: 1,
    justifyContent: "space-between",
  },

  // Radar
  radarWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  radarPulse: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "red",
  },
  radarCenter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#ffffff50",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
    borderColor: "#fffff20",
  },

  // Bottom sheet
  bottomSheet: {
    width: "100%",
    backgroundColor: "#101218",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#333",
    marginBottom: 10,
  },

  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#181A20",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFC107",
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: "#eee",
    fontWeight: "500",
  },
  refBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#181A20",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  refText: {
    fontSize: 11,
    color: "#aaa",
    marginLeft: 4,
  },

  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#B0B3C0",
    marginBottom: 16,
  },
  quoteCard: {
    backgroundColor: "#181A20",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#24262f",
    marginBottom: 12,
  },
  quoteLabel: {
    color: "#9fa4b6",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  quoteCurrency: { color: "#9fa4b6", fontSize: 12, fontWeight: "600" },
  quoteAmount: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    marginTop: 4,
  },
  quoteHint: {
    color: "#8c93a9",
    fontSize: 12,
    marginTop: 4,
  },

  buttons: {
    marginTop: 4,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E53935",
    paddingVertical: 13,
    borderRadius: 12,
    marginBottom: 10,
  },
  primaryText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
    marginLeft: 8,
  },
  linkBtn: {
    alignItems: "center",
    paddingVertical: 4,
    marginBottom: 6,
  },
  linkBtnText: {
    color: "#B0B3C0",
    fontSize: 13,
    textDecorationLine: "underline",
  },
  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E53935",
    marginTop: 4,
  },
  outlineText: {
    color: "#E53935",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 6,
  },
});
