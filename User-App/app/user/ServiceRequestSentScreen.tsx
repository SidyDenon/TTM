import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

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
  const params = useLocalSearchParams<{ requestId?: string | string[]; serviceLabel?: string | string[] }>();
  const requestId = getFirst(params.requestId);
  const serviceLabel = getFirst(params.serviceLabel) || "Service à Domicile";

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
