import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native";
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { API_URL } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import { formatCurrency } from "../../utils/format";
import Loader from "../../components/Loader";
import * as Haptics from "expo-haptics";
import Toast from "react-native-toast-message";
import { useSocket } from "../../context/SocketContext";

type Transaction = {
  id: number;
  request_id?: number;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  type: "gain" | "retrait";
};

const RED = "#E53935";
const BG = "#F6F6F6";
const CARD = "#FFFFFF";
const SOFT = "#F2F2F2";
const MUTED = "#6B7280";
const GREEN = "#16A34A";
const ORANGE = "#F59E0B";
const DANGER = "#EF4444";

export default function WithdrawHistoryScreen() {
  const { token } = useAuth();
  const { socket } = useSocket();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWallet = async () => {
    try {
      const res = await fetch(`${API_URL}/operator/wallet`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        Alert.alert("Erreur", data.error || "Impossible de charger le wallet");
        return;
      }
      setTransactions(data.transactions || []);
    } catch (err) {
      console.error("❌ Erreur fetchWallet:", err);
      Alert.alert("Erreur", "Impossible de charger vos retraits");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
    const interval = setInterval(() => {
      fetchWallet();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socket) return;

    type WithdrawalEvent = {
      id?: number;
      amount?: number;
      status: "en_attente" | "approuvée" | "rejetée";
      message?: string;
      created_at?: string;
    };

    const handleCreated = (data: WithdrawalEvent) => {
      Toast.show({
        type: "info",
        text1: "📤 Retrait envoyé",
        text2: "Votre demande est en attente d’approbation",
        visibilityTime: 2500,
      });
      setTransactions((prev) => [
        {
          id: data.id || Date.now(),
          amount: data.amount || 0,
          currency: "FCFA",
          status: data.status || "en_attente",
          created_at: data.created_at || new Date().toISOString(),
          type: "retrait",
        },
        ...prev,
      ]);
    };

    const handleUpdated = (data: WithdrawalEvent) => {
      Haptics.notificationAsync(
        data.status === "approuvée"
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error
      );
      Toast.show({
        type: data.status === "approuvée" ? "success" : "error",
        text1:
          data.status === "approuvée"
            ? "💸 Retrait approuvé !"
            : "❌ Retrait rejeté",
        text2: data.message || "",
        visibilityTime: 3000,
      });
      setTransactions((prev) =>
        prev.map((t) =>
          t.type === "retrait" && t.id === data.id
            ? { ...t, status: data.status }
            : t
        )
      );
    };

    socket.on("withdrawal_created", handleCreated);
    socket.on("withdrawal_update", handleUpdated);

    return () => {
      socket.off("withdrawal_created", handleCreated);
      socket.off("withdrawal_update", handleUpdated);
    };
  }, [socket]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <Loader />
        <Text style={styles.loaderText}>Chargement...</Text>
      </View>
    );
  }

  const retraits = transactions.filter((t) => t.type === "retrait");

  const getStatusColor = (status: string) => {
    if (status === "approuvée") return GREEN;
    if (status === "en_attente") return ORANGE;
    if (status === "refusée" || status === "rejetée") return DANGER;
    return MUTED;
  };

  const getAmountPrefix = (status: string) => (status === "approuvée" ? "- " : "");

  return (
    <View style={styles.container}>
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>Historiques de rétrait</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.filterCard}>
          <View style={styles.filterLeft}>
            <MaterialIcons name="calendar-month" size={22} color="#1F6FEB" />
            <Text style={styles.filterLabel}>Aujourd’hui</Text>
          </View>
          <MaterialIcons name="keyboard-arrow-down" size={24} color="#111" />
        </View>

        <View style={styles.listCard}>
          {retraits.length === 0 ? (
            <Text style={styles.emptyText}>Aucun retrait enregistré</Text>
          ) : (
            retraits.map((item) => {
              const color = getStatusColor(item.status);
              return (
                <View key={`retrait-${item.id}`} style={styles.itemCard}>
                  <View style={styles.itemLeft}>
                    <MaterialCommunityIcons name="sack" size={28} color={GREEN} />
                    <View style={styles.itemText}>
                      <Text style={styles.itemTitle}>Retrait</Text>
                      <Text style={styles.itemMeta}>
                        {new Date(item.created_at).toLocaleDateString()}
                      </Text>
                      <Text style={[styles.itemStatus, { color }]}>
                        Statut : {item.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.itemAmount, { color }]}>
                    {getAmountPrefix(item.status)}
                    {formatCurrency(item.amount)}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  loader: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: BG },
  loaderText: { marginTop: 10, color: "#111", fontWeight: "700" },

  headerCard: {
    backgroundColor: RED,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingTop: 18,
    paddingBottom: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },

  content: { padding: 16, paddingBottom: 120 },
  filterCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    marginBottom: 12,
  },
  filterLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  filterLabel: { fontSize: 16, fontWeight: "800", color: "#111" },

  listCard: {
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  itemCard: {
    backgroundColor: SOFT,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  itemLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  itemText: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: "800", color: "#111" },
  itemMeta: { fontSize: 12, color: MUTED, marginTop: 2 },
  itemStatus: { fontSize: 12, marginTop: 4 },
  itemAmount: { fontSize: 14, fontWeight: "800" },
  emptyText: { fontSize: 13, color: "#9CA3AF", paddingVertical: 6, textAlign: "center" },
});
