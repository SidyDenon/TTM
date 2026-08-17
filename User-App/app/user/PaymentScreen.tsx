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
  ScrollView,
  KeyboardAvoidingView,
  useWindowDimensions,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { API_URL } from "../../utils/api";
import { MaterialIcons } from "@expo/vector-icons";
import LottieView from "../../components/Lottie";
import Toast from "react-native-toast-message";
import Loader from "../../components/Loader";

type MissionPayment = {
  id: number;
  service?: string | null;
  type?: string | null;
  address?: string | null;
  adresse?: string | null;
  estimated_price?: number | string | null;
  payment_status?: string | null;
  payment_method?: PaymentMethod | null;
  cash_received_by_operator?: boolean;
};

type OperatorType = "orange" | "wave" | "moov";
type PaymentMethod = "mobile_money" | "cash";

const isConfirmedPaymentStatus = (status: unknown) => {
  const normalizedStatus = String(status || "").toLowerCase();
  return normalizedStatus === "confirmée" || normalizedStatus === "confirmee";
};

export default function PaymentScreen() {
  const router = useRouter();
  const { missionId, cashConfirmed } = useLocalSearchParams<{ missionId?: string; cashConfirmed?: string }>();
  const { token } = useAuth();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const isCompact = screenHeight < 760 || screenWidth < 370;

  const [loadingMission, setLoadingMission] = useState(true);
  const [mission, setMission] = useState<MissionPayment | null>(null);
  const [loading, setLoading] = useState(false);
  const [paid, setPaid] = useState(false);
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const [cashPaymentConfirmed, setCashPaymentConfirmed] = useState(cashConfirmed === "1");
  const [cashPending, setCashPending] = useState(false);

  //  Modal paiement
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [phone, setPhone] = useState("");
  const [operator, setOperator] = useState<OperatorType | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mobile_money");
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

  useEffect(() => {
    if (cashConfirmed === "1") {
      setPaymentSubmitted(true);
      setCashPaymentConfirmed(true);
      setCashPending(false);
      setPaid(true);
    }
  }, [cashConfirmed]);

  //  Charger la mission
  useEffect(() => {
    if (!missionId) {
      setLoadingMission(false);
      return;
    }

    let cancelled = false;

    const loadMission = async () => {
      try {
        const res = await fetch(`${API_URL}/requests/${missionId}?refresh=${Date.now()}`, {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
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
            payment_status: m.payment_status ?? null,
            payment_method: m.payment_method ?? null,
            cash_received_by_operator: Boolean(m.cash_received_by_operator),
          });
          const method = String(m.payment_method || "").toLowerCase();
          const cashReceived =
            m.cash_received_by_operator === true ||
            Number(m.cash_received_by_operator) === 1;
          if (isConfirmedPaymentStatus(m.payment_status)) {
            setPaymentSubmitted(true);
            setCashPending(false);
            setCashPaymentConfirmed(method === "cash" && cashReceived);
            setPaid(true);
            setPayModalVisible(false);
          } else if (method === "cash") {
            setPaymentSubmitted(true);
            setCashPending(!cashReceived);
            setCashPaymentConfirmed(cashReceived);
            setPaid(cashReceived);
          } else if (method === "mobile_money") {
            setPaymentSubmitted(true);
            setCashPending(false);
            setPaid(false);
          }
        } else {
          Alert.alert("Erreur", data?.error || "Mission introuvable.");
          setMission(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(" Erreur fetch mission paiement:", err);
          Alert.alert("Erreur", "Impossible de charger la mission.");
        }
      } finally {
        if (!cancelled) setLoadingMission(false);
      }
    };

    loadMission();
    const interval = setInterval(loadMission, 4000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [missionId, token]);

  // 🔥 Validation + appel API
  const handleConfirmPayment = async () => {
  setFormError(null);

  if (paymentMethod === "mobile_money") {
    if (!phone.trim() || phone.trim().length < 6) {
      setFormError("Entre un numéro de téléphone valide.");
      return;
    }
    if (!operator) {
      setFormError("Choisis ton opérateur de paiement.");
      return;
    }
  }

  if (!missionId) {
    Alert.alert(" Erreur", "Mission inconnue.");
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
          payment_method: paymentMethod,
          ...(paymentMethod === "mobile_money"
            ? {
                phone: phone.trim(),
                operator,
              }
            : {}),
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Impossible de confirmer le paiement.");
    }
    if (isConfirmedPaymentStatus(data?.data?.status)) {
      setPaymentSubmitted(true);
      setCashPending(false);
      setPaid(true);
      setPayModalVisible(false);
      return;
    }
    if (paymentMethod === "cash") {
      setPaymentSubmitted(true);
      setCashPending(true);
      setPaid(false);
    } else {
      setPaymentSubmitted(true);
      setPaid(false);
    }
    setPayModalVisible(false);
    Toast.show({
      type: "success",
      text1: "Paiement espèces enregistré",
      text2: "En attente de la confirmation de l’opérateur.",
      visibilityTime: 3500,
    });
  } catch (err: any) {
    Alert.alert(
      " Erreur",
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
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
        <Text style={[styles.bannerTitle, { fontSize: isCompact ? 18 : 20 }]}>
          {paid ? "Paiement confirmé " : paymentSubmitted ? "Confirmation en attente" : "Mission terminée 🎉"}
        </Text>
        <Text style={[
          styles.bannerText,
          paid && cashPaymentConfirmed ? styles.bannerTextSuccess : null,
        ]}>
          {paid
            ? cashPaymentConfirmed
              ? "La réception de votre paiement en espèces a été confirmée. Vous pouvez maintenant laisser votre avis."
              : "Merci, ton paiement a bien été transmis. Tu peux maintenant nous laisser ton avis."
            : paymentSubmitted
            ? cashPending
              ? "Paiement espèces déclaré. Attends la confirmation de l'opérateur."
              : "Paiement transmis. Il reste en attente de validation par l’administration."
            : "Choisis ton mode de paiement pour finaliser la mission."}
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
                Paiement possible via mobile money ou en espèces.
              </Text>
            </View>
          </View>
          <View style={styles.ticketSideDot} />
        </View>
      )}

      {/* CTA principal */}
      {!paid ? (
        paymentSubmitted ? (
          <View style={[styles.btn, { backgroundColor: "#607D8B" }]}>
            <Text style={styles.btnText}>
              {cashPending ? "En attente confirmation opérateur" : "Paiement en cours de validation"}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.btn}
            onPress={() => setPayModalVisible(true)}
          >
            <Text style={styles.btnText}>Choisir le paiement</Text>
          </TouchableOpacity>
        )
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
      </ScrollView>

      {/*  MODAL DE PAIEMENT */}
      <Modal
        visible={payModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !loading && setPayModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={styles.modalKeyboard}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
          <View style={[styles.modalContent, { maxHeight: screenHeight * 0.82 }]}>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Choix du paiement</Text>
              <TouchableOpacity
                onPress={() => !loading && setPayModalVisible(false)}
              >
                <MaterialIcons name="close" size={22} color="#999" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalText}>
              Choisis le mode de paiement, puis confirme.
            </Text>

            <Text style={styles.modalLabel}>Mode de paiement</Text>
            <View style={styles.operatorRow}>
              <TouchableOpacity
                style={[
                  styles.operatorChip,
                  paymentMethod === "mobile_money" && styles.operatorChipActiveWave,
                ]}
                onPress={() => setPaymentMethod("mobile_money")}
              >
                <Text
                  style={[
                    styles.operatorChipText,
                    paymentMethod === "mobile_money" && styles.operatorChipTextActive,
                  ]}
                >
                  Mobile money
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.operatorChip,
                  paymentMethod === "cash" && styles.operatorChipActiveMoov,
                ]}
                onPress={() => setPaymentMethod("cash")}
              >
                <Text
                  style={[
                    styles.operatorChipText,
                    paymentMethod === "cash" && styles.operatorChipTextActive,
                  ]}
                >
                  Espèces
                </Text>
              </TouchableOpacity>
            </View>

            {paymentMethod === "cash" && (
              <View style={styles.cashInfoBox}>
                <Text style={styles.cashInfoText}>
                  Paiement en espèces à la livraison/service terminé. L’opérateur confirmera ensuite la réception.
                </Text>
              </View>
            )}

            {paymentMethod === "mobile_money" && (
              <>
                <Text style={styles.modalLabel}>Numéro de téléphone</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="phone-pad"
                  placeholder="Ex : 77 12 34 56"
                  value={phone}
                  onChangeText={setPhone}
                />

                <Text style={[styles.modalLabel, { marginTop: 12 }]}>Opérateur</Text>
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
              </>
            )}

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
                <Text style={styles.modalBtnText}>
                  {paymentMethod === "cash" ? "Valider et attendre l'opérateur" : "Valider le paiement"}
                </Text>
              )}
            </TouchableOpacity>
            </ScrollView>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  scrollContent: { paddingBottom: 20 },
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
  bannerTextSuccess: {
    color: "#2E7D32",
    fontWeight: "700",
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
  cashInfoBox: {
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: "#FFF8E1",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FBC02D",
    paddingVertical: 9,
    paddingHorizontal: 11,
  },
  cashInfoText: {
    color: "#8D6E63",
    fontSize: 12,
    lineHeight: 17,
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

  //  Modal paiement
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalKeyboard: {
    width: "100%",
    alignItems: "center",
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
