import React, { useEffect, useMemo, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { API_URL } from "../../utils/api";

const COLORS = {
  primary: "#E53935",
  bg: "#FAFAFA",
  card: "#FFFFFF",
  text: "#111111",
  muted: "#666666",
  border: "#EEEEEE",
};

const getFirst = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v ?? "");

export default function ServiceRequestSentScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { socket } = useSocket();
  const params = useLocalSearchParams<{ requestId?: string | string[]; serviceLabel?: string | string[] }>();
  const requestId = getFirst(params.requestId);
  const serviceLabel = getFirst(params.serviceLabel) || "Service à Domicile";

  const [watching, setWatching] = useState(true);
  const redirectedRef = useRef(false);
  const numericRequestId = useMemo(() => Number(requestId), [requestId]);

  const canRedirectToTracking = (status: string | null | undefined) => {
    const s = String(status || "").toLowerCase();
    return ["acceptee", "en_route", "sur_place", "remorquage"].includes(s);
  };

  const goToTracking = () => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    setWatching(false);
    router.replace("/user/SuiviMissionScreen");
  };

  useEffect(() => {
    if (!requestId || !token) return;

    let cancelled = false;
    const checkMissionStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/requests/${requestId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) return;
        const status = data?.data?.status;
        if (!cancelled && canRedirectToTracking(status)) {
          goToTracking();
        }
      } catch {
        // keep silent: next poll/socket event will retry
      }
    };

    checkMissionStatus();
    const interval = setInterval(checkMissionStatus, 6000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [requestId, token]);

  useEffect(() => {
    if (!socket || !token || !Number.isFinite(numericRequestId)) return;

    const onConnect = () => {
      socket.emit("register", { token });
      socket.emit("join_request", { requestId: numericRequestId });
    };

    const onMissionUpdate = (payload: any) => {
      if (Number(payload?.id) !== numericRequestId) return;
      if (canRedirectToTracking(payload?.status)) {
        goToTracking();
      }
    };

    socket.on("connect", onConnect);
    socket.on("mission:updated", onMissionUpdate);
    socket.on("mission:status_changed", onMissionUpdate);

    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("mission:updated", onMissionUpdate);
      socket.off("mission:status_changed", onMissionUpdate);
    };
  }, [socket, token, numericRequestId]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.content}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>OK</Text>
        </View>

        <Text style={styles.title}>Demande envoyée</Text>

        <View style={styles.card}>
          <Text style={styles.message}>
            Votre demande de {serviceLabel} a été envoyée à notre équipe.
          </Text>
          <Text style={styles.message}>
            Nous allons vous contacter très rapidement pour la prise en charge.
          </Text>
          {watching ? (
            <Text style={styles.waiting}>En attente d’acceptation opérateur... redirection automatique dès confirmation.</Text>
          ) : null}
          {requestId ? <Text style={styles.ref}>Référence: #{requestId}</Text> : null}
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace("/user")}>
          <Text style={styles.primaryBtnText}>Retour à l’accueil</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace("/user/history/index")}> 
          <Text style={styles.secondaryBtnText}>Voir mes demandes</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#E8F8ED",
    borderWidth: 2,
    borderColor: "#30B45A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  badgeText: {
    color: "#1D9E48",
    fontWeight: "800",
    fontSize: 22,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.primary,
    marginBottom: 18,
    textAlign: "center",
  },
  card: {
    width: "100%",
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 22,
  },
  message: {
    fontSize: 16,
    lineHeight: 23,
    color: COLORS.text,
    textAlign: "center",
    marginBottom: 8,
  },
  ref: {
    marginTop: 6,
    color: COLORS.muted,
    textAlign: "center",
    fontWeight: "600",
  },
  waiting: {
    marginTop: 6,
    marginBottom: 2,
    color: "#1D9E48",
    textAlign: "center",
    fontWeight: "600",
    fontSize: 13,
  },
  primaryBtn: {
    width: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryBtn: {
    width: "100%",
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryBtnText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: "700",
  },
});
