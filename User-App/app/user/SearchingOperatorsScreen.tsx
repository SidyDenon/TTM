// app/user/SearchingOperatorsScreen.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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
import Loader from "../../components/Loader";

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
  const { requestId, initialStatus } = useLocalSearchParams<{
    requestId: string;
    initialStatus?: string;
  }>();
  const { token } = useAuth();
  const { socket } = useSocket();
  const router = useRouter();

  const [status, setStatus] = useState<"pending" | "accepted" | "timeout">(
    initialStatus === "timeout" ? "timeout" : "pending"
  );
  const [operatorName, setOperatorName] = useState<string | null>(null);
  const [quote, setQuote] = useState<{ amount: number; currency?: string | null } | null>(null);
  const [service, setService] = useState<string | null>(null);
  const [totalKm, setTotalKm] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const cancellationNotifiedRef = useRef(false);
  const timeoutTriggeredRef = useRef(false);

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
  const UI_TIMEOUT_MS = 5 * 60 * 1000;

  useEffect(() => {
    if (!requestId) return;

    const timer = setTimeout(async () => {
      if (status !== "pending") return;
      if (timeoutTriggeredRef.current) return;
      timeoutTriggeredRef.current = true;
      setStatus("timeout");

      // Aligne backend : annule la mission pour retirer côté opérateur
      try {
        await fetch(`${API_URL}/requests/${requestId}/cancel`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // silencieux : si déjà acceptée/terminée, le socket mettra à jour
      }
    }, UI_TIMEOUT_MS); // 5 min

    return () => clearTimeout(timer);
  }, [requestId, status, token]);

  // ✅ Auto-redirect to tracking after acceptance
  useEffect(() => {
    if (status !== "accepted") return;
    const t = setTimeout(() => {
      goToTracking();
    }, 3500);
    return () => clearTimeout(t);
  }, [status]);

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

  const handleRetry = async () => {
    if (!requestId) return;
    try {
      setRetrying(true);
      const res = await fetch(`${API_URL}/requests/${requestId}/retry`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        Toast.show({
          type: "error",
          text1: "Impossible de réessayer",
          text2: data.error || "Réessaie dans quelques secondes.",
        });
        return;
      }

      const newId = data?.data?.id;
      if (!newId) {
        Toast.show({
          type: "error",
          text1: "Réessai échoué",
          text2: "Aucun identifiant retourné.",
        });
        return;
      }

      cancellationNotifiedRef.current = false;
      setStatus("pending");
      setOperatorName(null);
      setQuote(null);
      setService(null);
      setTotalKm(null);

      router.replace({
        pathname: "/user/SearchingOperatorsScreen",
        params: { requestId: String(newId) },
      });
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Erreur réseau",
        text2: "Impossible de relancer la mission.",
      });
    } finally {
      setRetrying(false);
    }
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
      {isAccepted && <View style={styles.acceptedFilter} />}

      {/* Header logo */}
      <View style={styles.header}>
        <Text style={styles.logo}>
          <Text style={{ color: "#E53935" }}>TT</Text>M
        </Text>
      </View>

      {/* Contenu principal */}
      <View style={styles.contentWrapper}>
        <View style={styles.topTextBlock}>
          <Text style={styles.title}>
            {isPending && "Nous cherchons un dépanneur"}
            {isAccepted &&
              (service && service.toLowerCase().includes("remorqu")
                ? "Un remorqueur arrive"
                : "Un dépanneur arrive")}
            {isTimeout && "Aucun dépanneur disponible"}
          </Text>
          <Text style={styles.subtitle}>
            {isPending &&
              "Les dépanneurs les plus proches reçoivent ta demande. Merci de patienter…"}
            {isAccepted &&
              (operatorName
                ? `${operatorName} a accepté ta mission. Redirection vers le suivi en direct.`
                : "Un dépanneur a accepté ta mission. Redirection vers le suivi…")}
            {isTimeout &&
              "Personne n’a pu accepter ta demande. Réessaie dans quelques minutes."}
          </Text>
        </View>

        {/* Radar */}
        <View style={styles.radarWrapper}>
          <View style={styles.radarRingOuter} />
          <View style={styles.radarRingMid} />
          <View style={styles.radarRingInner} />
          <Animated.View style={[styles.radarPulse, { transform: [{ scale }], opacity }]} />
          <View style={styles.radarCenter}>
            <Animated.Image
              source={require("../../assets/animations/find.gif")}
              style={{ width: 64, height: 64, borderRadius: 32 }}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Infos supplémentaires */}
        {isAccepted && (
          <AnimatedRe.View entering={FadeInUp.duration(300)} style={styles.infoCard}>
            <View style={styles.statusRow}>
              <View style={styles.statusChip}>
                <View style={[styles.statusDot, { backgroundColor: "#4CAF50" }]} />
                <Text style={styles.statusText}>Dépanneur trouvé</Text>
              </View>
              {numericId && (
                <View style={styles.refBadge}>
                  <MaterialIcons name="confirmation-number" size={14} color="#9CA3AF" />
                  <Text style={styles.refText}>#{numericId}</Text>
                </View>
              )}
            </View>
            <View style={styles.quoteCard}>
              <View style={styles.quoteHeaderRow}>
                <Text style={styles.quoteLabel}>Prix final</Text>
                {quote?.currency && <Text style={styles.quoteCurrency}>{quote.currency}</Text>}
              </View>
              <Text style={styles.quoteAmount}>
                {quote ? formatAmount(quote.amount, quote.currency) : "—"}
              </Text>
              {service && service.toLowerCase().includes("remorqu") && (
                <Text style={styles.quoteHint}>
                  Montant recalculé selon la distance réelle du remorquage.
                </Text>
              )}
              {service &&
                service.toLowerCase().includes("remorqu") &&
                typeof totalKm === "number" && (
                  <Text style={styles.quoteHint}>
                    Distance totale estimée : {totalKm.toFixed(1)} km
                  </Text>
                )}
            </View>
          </AnimatedRe.View>
        )}

        {/* Actions */}
        <View style={styles.buttons}>
          {isPending && (
            <TouchableOpacity
              style={[styles.primaryBtn, cancelling && { opacity: 0.6 }]}
              onPress={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? (
                <Loader />
              ) : (
                <>
                  <MaterialIcons name="cancel" size={20} color="#fff" />
                  <Text style={styles.primaryText}>Annuler</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {isTimeout && (
            <>
              <TouchableOpacity
                style={[styles.primaryBtn, retrying && { opacity: 0.6 }]}
                onPress={handleRetry}
                disabled={retrying}
              >
                <MaterialIcons name="refresh" size={20} color="#fff" />
                <Text style={styles.primaryText}>Réessayer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkBtn} onPress={() => router.replace("/user")}>
                <Text style={styles.linkBtnText}>Retour à l’accueil</Text>
              </TouchableOpacity>
            </>
          )}

          {isAccepted && (
            <TouchableOpacity style={styles.primaryBtnGreen} onPress={goToTracking}>
              <MaterialIcons name="navigation" size={20} color="#fff" />
              <Text style={styles.primaryText}>Suivre la mission</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.outlineBtn} onPress={callServiceClient}>
            <Ionicons name="call" size={18} color="#E53935" />
            <Text style={styles.outlineText}>Appeler le service client</Text>
          </TouchableOpacity>
        </View>
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
    backgroundColor: "rgba(0,0,0,0.35)", // plus lisible sur map
  },
  acceptedFilter: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(229,57,53,0.08)",
  },

  header: {
    position: "absolute",
    top: 20,
    left: 20,
    right: 20,
    zIndex: 5,
  },
  logo: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111",
    letterSpacing: 0.6,
  },

  contentWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  topTextBlock: {
    alignItems: "center",
    marginBottom: 18,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  // Radar
  radarWrapper: {
    width: 260,
    height: 260,
    alignItems: "center",
    justifyContent: "center",
  },
  radarRingOuter: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(229,57,53,0.12)",
  },
  radarRingMid: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "rgba(229,57,53,0.16)",
  },
  radarRingInner: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(229,57,53,0.22)",
  },
  radarPulse: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(229,57,53,0.35)",
  },
  radarCenter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },

  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#F1F1F1",
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
    color: "#111",
    fontWeight: "700",
  },
  refBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#F1F1F1",
  },
  refText: {
    fontSize: 11,
    color: "#aaa",
    marginLeft: 4,
  },

  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "#111",
    opacity: 0.7,
    marginBottom: 14,
    lineHeight: 17,
    textAlign: "center",
    maxWidth: 260,
  },
  infoCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F1F1F1",
    marginTop: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  quoteHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  quoteCard: {
    backgroundColor: "#F8F9FB",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EEF0F3",
    marginTop: 8,
  },
  quoteLabel: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  quoteCurrency: { color: "#6B7280", fontSize: 12, fontWeight: "600" },
  quoteAmount: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111",
    marginTop: 4,
  },
  quoteHint: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 4,
  },

  buttons: {
    marginTop: 16,
    width: "100%",
    alignItems: "center",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E53935",
    paddingVertical: 12,
    borderRadius: 20,
    paddingHorizontal: 26,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  primaryBtnGreen: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#16A34A",
    paddingVertical: 12,
    borderRadius: 20,
    paddingHorizontal: 26,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  primaryText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
    marginLeft: 8,
  },
  linkBtn: {
    alignItems: "center",
    paddingVertical: 4,
    marginBottom: 6,
  },
  linkBtnText: {
    color: "#6B7280",
    fontSize: 13,
    textDecorationLine: "underline",
  },
  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E53935",
    backgroundColor: "rgba(229,57,53,0.08)",
    marginTop: 4,
  },
  outlineText: {
    color: "#E53935",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 6,
  },
});
