import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Easing,
} from "react-native";
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { API_URL } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatCurrency } from "../../utils/format";
import * as Haptics from "expo-haptics";
import Toast from "react-native-toast-message";
import { useSocket } from "../../context/SocketContext";
import Loader from "../../components/Loader";

type Transaction = {
  id: number;
  request_id?: number;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  type: "gain" | "retrait";
};

const DEFAULT_COMMISSION = 12; // % aligné avec dashboard admin

export default function WalletScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const { socket } = useSocket();

  const [solde, setSolde] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [commissionPercent, setCommissionPercent] = useState<number>(DEFAULT_COMMISSION);

  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState("Orange Money");
  const [tab, setTab] = useState<"gains" | "retraits">("gains");

  // ---------------------- FETCH WALLET ----------------------
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

      if (data.commission_percent != null) {
        setCommissionPercent(Number(data.commission_percent));
      } else {
        setCommissionPercent((prev) =>
          Number.isFinite(prev) ? prev : DEFAULT_COMMISSION
        );
      }
      if (data.is_internal) {
        setCommissionPercent(0);
      }
      setSolde(data.solde || 0);
      setTransactions(data.transactions || []);
    } catch (err) {
      console.error("❌ Erreur fetchWallet:", err);
      Alert.alert("Erreur", "Impossible de charger vos gains");
    } finally {
      setLoading(false);
    }
  };

  const netAmount = useCallback(
    (amount: number) =>
      Math.max(0, Number(amount) * (1 - commissionPercent / 100)),
    [commissionPercent]
  );

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
      if (data?.commission_percent != null) {
        setCommissionPercent(Number(data.commission_percent));
      }
      Toast.show({
        type: "info",
        text1: "🚗 Mission terminée",
        text2: `Nouveau gain : ${formatCurrency(netAmount(data.amount))}`,
        visibilityTime: 2500,
      });
      setSolde((s) => s + netAmount(data.amount));
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
        <Loader />
        <Text style={{ marginTop: 10 }}>Chargement du wallet...</Text>
      </SafeAreaView>
    );
  }

  const gains = transactions.filter((t) => t.type === "gain");
  const retraits = transactions.filter((t) => t.type === "retrait");

  const renderLine = (item: Transaction) => {
    const isGain = item.type === "gain";
    const color = isGain ? "#2E7D32" : "#D84315";
    const icon = isGain ? "trending-up" : "trending-down";
    const amountValue =
      item.type === "gain" ? netAmount(item.amount) : item.amount;
    return (
      <View style={styles.transactionCard}>
        <View style={styles.transactionLeft}>
          <View style={[styles.transIcon, { backgroundColor: `${color}20` }]}>
            <MaterialIcons name={icon as any} size={18} color={color} />
          </View>
          <View>
            <Text style={styles.transactionTitle}>
              {isGain ? "Gain mission" : "Retrait"}
            </Text>
            <Text style={styles.transactionDate}>
              {new Date(item.created_at).toLocaleDateString()}{" "}
              {item.request_id ? `• Mission #${item.request_id}` : ""}
            </Text>
            <Text style={[styles.transactionStatus, { color }]}>
              Statut : {item.status}
            </Text>
          </View>
        </View>
        <Text style={[styles.transactionAmount, { color }]}>
          {formatCurrency(amountValue)}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header façon carte */}
      <View style={styles.header}>
        <View style={styles.profileRow}>
          <View style={styles.profileAvatar}>
            <MaterialIcons name="person" size={30} color="#E53935" />
          </View>
          <View>
            <Text style={styles.profileHello}>Bienvenue</Text>
            <Text style={styles.profileName}>{user?.name || "Opérateur"}</Text>
          </View>
        </View>
      </View>

      {commissionPercent === 0 ? (
        <View style={styles.hiddenBox}>
          <MaterialIcons name="info-outline" size={26} color="#E53935" />
          <Text style={styles.hiddenTitle}>Wallet désactivé</Text>
          <Text style={styles.hiddenSubtitle}>
            Les opérateurs internes ne sont pas soumis à commission et n’utilisent pas le wallet.
          </Text>
        </View>
      ) : (
        <>
          {/* Solde */}
          <LinearGradient
            colors={["#E53935", "#F86A65"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.heroCard, { marginBottom: 18 }]}
          >
            <View style={styles.heroCardTop}>
              <Text style={styles.heroLabel}>Solde actuel</Text>
              <TouchableOpacity style={styles.currencyTag} onPress={() => fetchWallet()}>
                <MaterialIcons name="refresh" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.heroAmount}>{formatCurrency(solde)}</Text>
            <Text style={styles.heroSub}>
              {commissionPercent === 0
                ? "Commission TTM : 0%"
                : `Après commission ${commissionPercent}%`}
            </Text>
          </LinearGradient>

          {/* Bouton retrait */}
          <TouchableOpacity
            style={styles.withdrawBtn}
            onPress={() => setShowModal(true)}
          >
            <MaterialCommunityIcons name="wallet-plus" size={20} color="#fff" />
            <Text style={styles.withdrawText}>Demander un retrait</Text>
          </TouchableOpacity>

          {/* Historique avec switch */}
          <Text style={styles.sectionTitle}>Historique des transactions</Text>
          <View style={styles.switchRow}>
            <TouchableOpacity
              style={[styles.switchBtn, tab === "gains" && styles.switchActive]}
              onPress={() => setTab("gains")}
            >
              <Text style={[styles.switchText, tab === "gains" && styles.switchTextActive]}>
                Entrées
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.switchBtn, tab === "retraits" && styles.switchActive]}
              onPress={() => setTab("retraits")}
            >
              <Text style={[styles.switchText, tab === "retraits" && styles.switchTextActive]}>
                Sorties
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionCard}>
            <ScrollView>
              {tab === "gains" &&
                (gains.length === 0 ? (
                  <Text style={styles.emptyText}>Aucun gain enregistré</Text>
                ) : (
                  gains.map((item) => (
                    <View key={`gain-${item.id}`} style={styles.lineWrapper}>
                      {renderLine(item)}
                    </View>
                  ))
                ))}

              {tab === "retraits" &&
                (retraits.length === 0 ? (
                  <Text style={styles.emptyText}>Aucun retrait enregistré</Text>
                ) : (
                  retraits.map((item) => (
                    <View key={`retrait-${item.id}`} style={styles.lineWrapper}>
                      {renderLine(item)}
                    </View>
                  ))
                ))}
            </ScrollView>
          </View>
        </>
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
              <Text style={styles.modalTitle}> Demande de retrait</Text>

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
                <Text style={styles.confirmText}> Confirmer</Text>
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
    marginBottom: 30,
    paddingHorizontal: 2,
  },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  profileAvatar: {
    width: 50,
    height: 50,
    borderRadius: "50%",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderColor:"#E53935",
    borderWidth:2,
    marginTop:4,
  },
  profileHello: { fontSize: 12, color: "#666" },
  profileName: { fontSize: 16, fontWeight: "700", color: "#111" },
  refreshCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  balanceCard: {
    backgroundColor: "#f8f8f8",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: "center",
  },
  heroTop: { marginBottom: 18 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#E53935",
    alignItems: "center",
    justifyContent: "center",
  },
  welcome: { fontSize: 12, color: "#666" },
  userName: { fontSize: 16, fontWeight: "700", color: "#111" },
  heroActions: { flexDirection: "row", marginLeft: "auto", gap: 8 },
  heroIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#f1f1f1",
    alignItems: "center",
    justifyContent: "center",
  },
  heroCard: {
    borderRadius: 16,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    minHeight: 180,
    justifyContent: "space-between",
  },
  heroCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  heroLabel: { color: "#ffe8e8", fontSize: 13, fontWeight: "600" },
  currencyTag: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  currencyText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  heroAmount: { color: "#fff", fontSize: 28, fontWeight: "800", marginTop: -40 },
  heroSub: { color: "#ffe8e8", fontSize: 13 },
  hiddenBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eee",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  hiddenTitle: { fontSize: 16, fontWeight: "700", color: "#111", marginTop: 8 },
  hiddenSubtitle: { fontSize: 13, color: "#666", textAlign: "center", marginTop: 4 },
  withdrawBtn: {
    backgroundColor: "#E53935",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 20,
  },
  withdrawText: { color: "#fff", fontWeight: "bold", fontSize: 16 ,},
  sectionTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 18 },
  switchRow: {
    flexDirection: "row",
    backgroundColor: "#f2f2f2",
    borderRadius: 10,
    padding: 4,
    marginBottom: 10,
  },
  switchBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  switchActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  switchText: { fontSize: 14, color: "#666", fontWeight: "600" },
  switchTextActive: { color: "#E53935" },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eee",
    padding: 12,
    marginBottom: 14,
    maxHeight: 450,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionLabel: { fontSize: 14, fontWeight: "700", color: "#222", marginBottom: 10 },
  emptyText: { fontSize: 13, color: "#888", paddingVertical: 4 },
  lineWrapper: { marginBottom: 8 },
  transactionCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#fafafa",
  },
  transactionLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  transIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  transactionTitle: { fontSize: 14, fontWeight: "700", color: "#111" },
  transactionDate: { fontSize: 12, color: "#666", marginTop: 2 },
  transactionStatus: { fontSize: 12, color: "#666", marginTop: 2 },
  transactionAmount: { fontSize: 15, fontWeight: "800" },
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
