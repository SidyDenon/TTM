import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  BackHandler,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { API_URL } from "../../utils/api";
import { MaterialIcons } from "@expo/vector-icons";
import LottieView from "../../components/Lottie";
import Loader from "../../components/Loader";

type MissionPayment = {
  id: number;
  service?: string | null;
  type?: string | null;
  address?: string | null;
  adresse?: string | null;
  estimated_price?: number | string | null;
};

type OperatorType = "orange" | "wave" | "moov";

export default function PaymentScreen() {
  const router = useRouter();
  const { missionId } = useLocalSearchParams<{ missionId?: string }>();
  const { token } = useAuth();

  const [loadingMission, setLoadingMission] = useState(true);
  const [mission, setMission] = useState<MissionPayment | null>(null);
  const [loading, setLoading] = useState(false);
  const [paid, setPaid] = useState(false);

  // 🔐 Modal paiement
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [phone, setPhone] = useState("");
  const [operator, setOperator] = useState<OperatorType | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // 🔙 Bloquer le retour tant que le paiement n'est pas confirmé
  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!paid) {
        Alert.alert(
          "Paiement requis",
          "Merci de confirmer ton paiement pour clôturer ta mission."
        );
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [paid]);

  // 📡 Charger la mission
  useEffect(() => {
    if (!missionId) {
      setLoadingMission(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API_URL}/requests/${missionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (cancelled) return;

        if (res.ok) {
          const m = data?.data || data;
          setMission({
            id: Number(m.id),
            service: m.service ?? m.type ?? null,
            type: m.type ?? null,
            address: m.address ?? m.adresse ?? null,
            adresse: m.adresse ?? null,
            estimated_price: m.estimated_price ?? null,
          });
        } else {
          Alert.alert("Erreur", data?.error || "Mission introuvable.");
          setMission(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("❌ Erreur fetch mission paiement:", err);
          Alert.alert("Erreur", "Impossible de charger la mission.");
        }
      } finally {
        if (!cancelled) setLoadingMission(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [missionId, token]);

  // 🔥 Validation + appel API
  const handleConfirmPayment = async () => {
  setFormError(null);

  if (!phone.trim() || phone.trim().length < 6) {
    setFormError("Entre un numéro de téléphone valide.");
    return;
  }
  if (!operator) {
    setFormError("Choisis ton opérateur de paiement.");
    return;
  }

  if (!missionId) {
    Alert.alert("❌ Erreur", "Mission inconnue.");
    return;
  }

  setLoading(true);
  try {
    const res = await fetch(
      `${API_URL}/requests/${missionId}/confirm-payment`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: phone.trim(),
          operator, // "orange" | "wave" | "moov"
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Impossible de confirmer le paiement.");
    }
    setPaid(true);
    setPayModalVisible(false);
    Alert.alert(
      "✅ Paiement transmis",
      "Ton paiement est envoyé. Il sera validé par notre équipe."
    );
  } catch (err: any) {
    Alert.alert(
      "❌ Erreur",
      err?.message || "Impossible d’effectuer le paiement."
    );
  } finally {
    setLoading(false);
  }
};


  /* ------- ÉTATS SIMPLES ------- */

  if (!missionId) {
    return (
      <SafeAreaView style={styles.center}>
        <MaterialIcons name="error-outline" size={48} color="#E53935" />
        <Text style={styles.errorTitle}>Mission inconnue</Text>
        <Text style={styles.errorText}>
          Impossible de préparer le paiement.
        </Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace("/user")}
        >
          <Text style={styles.backBtnText}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (loadingMission) {
    return (
      <SafeAreaView style={styles.center}>
        <Loader />
        <Text style={styles.errorText}>Chargement de la mission...</Text>
      </SafeAreaView>
    );
  }

  const displayPrice =
    mission?.estimated_price != null && mission.estimated_price !== ""
      ? `${Number(mission.estimated_price).toLocaleString()} FCFA`
      : "—";

  const serviceLabel =
    mission?.service || mission?.type || "Dépannage véhicule";

  const addressLabel =
    mission?.address || mission?.adresse || "Adresse non renseignée";

  return (
    <SafeAreaView style={styles.container}>
      {/* Header avec logo */}
      <View style={styles.header}>
        <Text style={styles.logo}>
          <Text style={{ color: "#E53935" }}>TT</Text>M
        </Text>
      </View>

      {/* Bannière + animation */}
      <View style={styles.banner}>
        <LottieView
          source={require("../../assets/animations/success.json")}
          autoPlay
          loop={false}
          style={styles.lottie}
        />
        <Text style={styles.bannerTitle}>
          {paid ? "Paiement confirmé ✅" : "Mission terminée 🎉"}
        </Text>
        <Text style={styles.bannerText}>
          {paid
            ? "Merci, ton paiement a bien été transmis. Tu peux maintenant nous laisser ton avis."
            : "Clique sur « Payer maintenant » pour régler par mobile money et finaliser la mission."}
        </Text>
      </View>

      {/* TICKET DE PAIEMENT */}
      {mission && (
        <View style={styles.ticketContainer}>
          <View style={styles.ticketSideDot} />
          <View style={styles.ticket}>
            <View style={styles.ticketHeaderRow}>
              <View style={styles.ticketIconCircle}>
                <MaterialIcons name="receipt-long" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.ticketTitle}>Mission #{mission.id}</Text>
                <Text style={styles.ticketSubtitle}>{serviceLabel}</Text>
              </View>
            </View>

            <View style={styles.ticketDividerContainer}>
              <View style={styles.ticketDivider} />
            </View>

            <View style={styles.ticketRow}>
              <MaterialIcons
                name="location-on"
                size={20}
                color="#E53935"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.ticketText} numberOfLines={2}>
                {addressLabel}
              </Text>
            </View>

            <View style={styles.amountBox}>
              <Text style={styles.amountLabel}>Montant à payer</Text>
              <Text style={styles.amountValue}>{displayPrice}</Text>
              <Text style={styles.amountHint}>
                Paiement via mobile money avec ton opérateur (Orange, Wave,
                Moov).
              </Text>
            </View>
          </View>
          <View style={styles.ticketSideDot} />
        </View>
      )}

      {/* CTA principal */}
      {!paid ? (
        <TouchableOpacity
          style={styles.btn}
          onPress={() => setPayModalVisible(true)}
        >
          <Text style={styles.btnText}>Payer maintenant</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: "#4CAF50" }]}
          onPress={() =>
            router.replace({
              pathname: "/user/FeedbackScreen",
              params: { missionId: missionId.toString() },
            })
          }
        >
          <Text style={styles.btnText}>Donner mon avis</Text>
        </TouchableOpacity>
      )}

      {!paid && (
        <Text style={styles.helper}>
          Vous ne pouvez pas quitter cette étape tant que le paiement n’est pas
          confirmé.
        </Text>
      )}

      {paid && (
        <TouchableOpacity onPress={() => router.replace("/user")}>
          <Text style={styles.link}>Retour à l’accueil</Text>
        </TouchableOpacity>
      )}

      {/* 🔐 MODAL DE PAIEMENT */}
      <Modal
        visible={payModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !loading && setPayModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Paiement mobile money</Text>
              <TouchableOpacity
                onPress={() => !loading && setPayModalVisible(false)}
              >
                <MaterialIcons name="close" size={22} color="#999" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalText}>
              Entre ton numéro de téléphone et choisis ton opérateur pour
              confirmer le paiement.
            </Text>

            <Text style={styles.modalLabel}>Numéro de téléphone</Text>
            <TextInput
              style={styles.input}
              keyboardType="phone-pad"
              placeholder="Ex : 77 12 34 56"
              value={phone}
              onChangeText={setPhone}
            />

            <Text style={[styles.modalLabel, { marginTop: 12 }]}>
              Opérateur
            </Text>
            <View style={styles.operatorRow}>
              <TouchableOpacity
                style={[
                  styles.operatorChip,
                  operator === "orange" && styles.operatorChipActiveOrange,
                ]}
                onPress={() => setOperator("orange")}
              >
                <Text
                  style={[
                    styles.operatorChipText,
                    operator === "orange" && styles.operatorChipTextActive,
                  ]}
                >
                  Orange Money
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.operatorChip,
                  operator === "wave" && styles.operatorChipActiveWave,
                ]}
                onPress={() => setOperator("wave")}
              >
                <Text
                  style={[
                    styles.operatorChipText,
                    operator === "wave" && styles.operatorChipTextActive,
                  ]}
                >
                  Wave
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.operatorChip,
                  operator === "moov" && styles.operatorChipActiveMoov,
                ]}
                onPress={() => setOperator("moov")}
              >
                <Text
                  style={[
                    styles.operatorChipText,
                    operator === "moov" && styles.operatorChipTextActive,
                  ]}
                >
                  Moov
                </Text>
              </TouchableOpacity>
            </View>

            {formError && (
              <Text style={styles.formError}>{formError}</Text>
            )}

            <TouchableOpacity
              style={[
                styles.modalBtn,
                loading && { opacity: 0.7 },
              ]}
              onPress={handleConfirmPayment}
              disabled={loading}
            >
              {loading ? (
                <Loader />
              ) : (
                <Text style={styles.modalBtnText}>Valider le paiement</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 20,
  },

  header: {
    marginBottom: 10,
  },
  logo: { fontSize: 20, fontWeight: "bold", color: "#000" },

  banner: {
    backgroundColor: "#FFF5F5",
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    alignItems: "center",
  },
  lottie: { width: 140, height: 140 },
  bannerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#E53935",
    marginTop: 4,
  },
  bannerText: {
    textAlign: "center",
    color: "#555",
    marginTop: 6,
    fontSize: 14,
  },

  // 🎟️ Ticket
  ticketContainer: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 28,
  },
  ticketSideDot: {
    width: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  ticket: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  ticketHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  ticketIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E53935",
    alignItems: "center",
    justifyContent: "center",
  },
  ticketTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
  },
  ticketSubtitle: {
    fontSize: 13,
    color: "#777",
    marginTop: 2,
  },

  ticketDividerContainer: {
    marginVertical: 10,
  },
  ticketDivider: {
    borderBottomWidth: 1,
    borderStyle: "dashed",
    borderColor: "#ddd",
  },

  ticketRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  ticketText: {
    fontSize: 14,
    color: "#444",
    flex: 1,
  },

  amountBox: {
    backgroundColor: "#FFF8E1",
    borderRadius: 12,
    padding: 12,
  },
  amountLabel: {
    fontSize: 12,
    color: "#A67C00",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#4CAF50",
    marginBottom: 4,
  },
  amountHint: {
    fontSize: 11,
    color: "#8D6E63",
  },

  btn: {
    backgroundColor: "#E53935",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },

  helper: {
    textAlign: "center",
    color: "#777",
    marginTop: 4,
    fontSize: 13,
  },

  errorTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#E53935",
    marginTop: 10,
  },
  errorText: { color: "#555", textAlign: "center", marginTop: 4 },

  backBtn: {
    marginTop: 18,
    backgroundColor: "#E53935",
    paddingHorizontal: 30,
    paddingVertical: 10,
    borderRadius: 20,
  },
  backBtnText: { color: "#fff", fontWeight: "bold" },

  link: {
    textAlign: "center",
    marginTop: 6,
    color: "#333",
    textDecorationLine: "underline",
    fontSize: 14,
  },

  // 🔐 Modal paiement
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#222",
  },
  modalText: {
    fontSize: 13,
    color: "#555",
    marginBottom: 14,
  },
  modalLabel: {
    fontSize: 13,
    color: "#444",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#222",
  },

  operatorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  operatorChip: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  operatorChipActiveOrange: {
    backgroundColor: "#FF9800",
    borderColor: "#FF9800",
  },
  operatorChipActiveWave: {
    backgroundColor: "#2196F3",
    borderColor: "#2196F3",
  },
  operatorChipActiveMoov: {
    backgroundColor: "#4CAF50",
    borderColor: "#4CAF50",
  },
  operatorChipText: {
    fontSize: 13,
    color: "#444",
    fontWeight: "500",
  },
  operatorChipTextActive: {
    color: "#fff",
  },

  formError: {
    color: "#E53935",
    fontSize: 12,
    marginTop: 6,
  },

  modalBtn: {
    marginTop: 14,
    backgroundColor: "#E53935",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  modalBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
