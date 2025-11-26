import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Easing,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { API_URL } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatCurrency } from "../../utils/format";
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

export default function WalletScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { socket } = useSocket();

  const [solde, setSolde] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState("Orange Money");

  // 🔄 Animation du bouton refresh
  const [refreshing, setRefreshing] = useState(false);
  const spinAnim = useRef(new Animated.Value(0)).current;

  const startRefreshAnimation = () => {
    spinAnim.setValue(0);
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  };

  // ---------------------- FETCH WALLET ----------------------
  const fetchWallet = async () => {
    try {
      setRefreshing(true);
      startRefreshAnimation();
      const res = await fetch(`${API_URL}/operator/wallet`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        Alert.alert("Erreur", data.error || "Impossible de charger le wallet");
        return;
      }

      setSolde(data.solde || 0);
      setTransactions(data.transactions || []);
    } catch (err) {
      console.error("❌ Erreur fetchWallet:", err);
      Alert.alert("Erreur", "Impossible de charger vos gains");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  // ---------------------- CONFIRMER RETRAIT ----------------------
  const confirmerRetrait = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert("Erreur", "Veuillez saisir un montant valide");
      return;
    }
    if (!phone) {
      Alert.alert("Erreur", "Veuillez saisir un numéro de téléphone");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/operator/wallet/withdraw`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: parseFloat(amount), phone, method }),
      });

      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Erreur", data.error || "Impossible de demander un retrait");
        return;
      }

      Alert.alert("✅ Succès", "Votre demande de retrait a été envoyée");
      setShowModal(false);
      setAmount("");
      setPhone("");
      setMethod("Orange Money");
      fetchWallet();
    } catch (err) {
      console.error("❌ Erreur retrait:", err);
      Alert.alert("Erreur", "Impossible de demander un retrait");
    }
  };

  // ---------------------- AUTO REFRESH (5s) ----------------------
  useEffect(() => {
    fetchWallet();
    const interval = setInterval(() => {
      fetchWallet();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // ---------------------- SOCKET EVENTS ----------------------
  useEffect(() => {
    if (!socket) return;

    type WithdrawalEvent = {
      id?: number;
      operator_id?: number;
      amount?: number;
      method?: string;
      phone?: string;
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

    const handleNewTransaction = (data: any) => {
      Toast.show({
        type: "info",
        text1: "🚗 Mission terminée",
        text2: `Nouveau gain : ${formatCurrency(data.amount)}`,
        visibilityTime: 2500,
      });
      setSolde((s) => s + data.amount * 0.9);
      setTransactions((prev) => [
        {
          id: data.id || Date.now(),
          request_id: data.request_id,
          amount: data.amount,
          currency: data.currency || "FCFA",
          status: "confirmée",
          created_at: new Date().toISOString(),
          type: "gain",
        },
        ...prev,
      ]);
    };

    socket.on("withdrawal_created", handleCreated);
    socket.on("withdrawal_update", handleUpdated);
    socket.on("transaction_confirmed", handleNewTransaction);

    return () => {
      socket.off("withdrawal_created", handleCreated);
      socket.off("withdrawal_update", handleUpdated);
      socket.off("transaction_confirmed", handleNewTransaction);
    };
  }, [socket]);

  // ---------------------- RENDER ----------------------
  if (loading) {
    return (
      <SafeAreaView style={styles.loader}>
        <ActivityIndicator size="large" color="#E53935" />
        <Text style={{ marginTop: 10 }}>Chargement du wallet...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack?.()) {
              router.back();
            } else {
              router.replace("/operator");
            }
          }}
          style={styles.backBtn}
        >
          <MaterialIcons name="arrow-back" size={24} color="#E53935" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>💰 Mes gains</Text>

        {/* 🔄 Bouton refresh animé */}
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            fetchWallet();
          }}
          style={styles.refreshBtn}
          disabled={refreshing}
        >
          <Animated.View
            style={{
              transform: [
                {
                  rotate: spinAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", "360deg"],
                  }),
                },
              ],
            }}
          >
            <MaterialIcons
              name="refresh"
              size={26}
              color={refreshing ? "#999" : "#E53935"}
            />
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* Solde */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Solde actuel</Text>
        <Text style={styles.balanceAmount}>{formatCurrency(solde)}</Text>
      </View>

      {/* Bouton retrait */}
      <TouchableOpacity
        style={styles.withdrawBtn}
        onPress={() => setShowModal(true)}
      >
        <Text style={styles.withdrawText}>📤 Demander un retrait</Text>
      </TouchableOpacity>

      {/* Liste des transactions */}
      <Text style={styles.sectionTitle}>Historique des transactions</Text>
      {transactions.length === 0 ? (
        <Text style={{ textAlign: "center", marginTop: 20, color: "#666" }}>
          Aucun historique disponible
        </Text>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          renderItem={({ item }) => (
            <View
              style={[
                styles.transactionCard,
                {
                  borderLeftColor:
                    item.type === "gain" ? "#4CAF50" : "#FF9800",
                },
              ]}
            >
              <View>
                <Text style={styles.transactionDate}>
                  {new Date(item.created_at).toLocaleDateString()}{" "}
                  {item.request_id ? `• Mission #${item.request_id}` : ""}
                </Text>
                <Text
                  style={[
                    styles.transactionStatus,
                    { color: item.type === "gain" ? "#4CAF50" : "#FF9800" },
                  ]}
                >
                  {item.type === "gain" ? "Gain" : "Retrait"} — Statut:{" "}
                  {item.status}
                </Text>
              </View>
              <Text
                style={[
                  styles.transactionAmount,
                  { color: item.type === "gain" ? "#4CAF50" : "#FF9800" },
                ]}
              >
                {formatCurrency(item.amount)}
              </Text>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}

      {/* Modal retrait */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlayCenter}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalBox}>
            <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
              <Text style={styles.modalTitle}>📤 Demande de retrait</Text>

              <TextInput
                style={styles.input}
                placeholder="Montant"
                placeholderTextColor="#888"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />

              <TextInput
                style={styles.input}
                placeholder="Numéro de téléphone"
                placeholderTextColor="#888"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />

              <View style={styles.methodsRow}>
                {["Orange Money", "Moov Money", "Wave"].map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.methodBtn,
                      method === m && styles.methodActive,
                    ]}
                    onPress={() => setMethod(m)}
                  >
                    <Text
                      style={
                        method === m
                          ? styles.methodTextActive
                          : styles.methodText
                      }
                    >
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={confirmerRetrait}
              >
                <Text style={styles.confirmText}>✅ Confirmer</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowModal(false)}
                style={{ marginTop: 12 }}
              >
                <Text
                  style={{
                    color: "#E53935",
                    fontWeight: "bold",
                    textAlign: "center",
                  }}
                >
                  ❌ Annuler
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backBtn: { marginRight: 10 },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#E53935" },
  refreshBtn: {
    padding: 8,
    borderRadius: 30,
    backgroundColor: "#f7f7f7",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  balanceCard: {
    backgroundColor: "#f8f8f8",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: "center",
  },
  balanceLabel: { fontSize: 14, color: "#666" },
  balanceAmount: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#000",
    marginTop: 5,
  },
  withdrawBtn: {
    backgroundColor: "#E53935",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
  },
  withdrawText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 10 },
  transactionCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 15,
    borderRadius: 10,
    backgroundColor: "#fafafa",
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  transactionDate: { fontSize: 14, fontWeight: "500" },
  transactionStatus: { fontSize: 12, color: "#666", marginTop: 2 },
  transactionAmount: { fontSize: 16, fontWeight: "bold" },
  modalOverlayCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalBox: {
    width: "90%",
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#E53935",
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    color: "#000",
  },
  methodsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginBottom: 15,
  },
  methodBtn: {
    flexGrow: 1,
    minWidth: "28%",
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  methodActive: { backgroundColor: "#E53935", borderColor: "#E53935" },
  methodText: { color: "#333" },
  methodTextActive: { color: "#fff", fontWeight: "bold" },
  confirmBtn: {
    backgroundColor: "#4CAF50",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 5,
  },
  confirmText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
