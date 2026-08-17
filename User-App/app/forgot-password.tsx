// app/forgot-password.tsx
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image } from "react-native";
import { apiFetch } from "../utils/api";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

const logo = require("../assets/images/logo1.png");

export default function ForgotPasswordScreen() {
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleForgot = async () => {
  if (loading) return;
  setError("");
  if (!identifier.trim()) {
    setError("Saisissez votre email ou votre numéro de téléphone.");
    return;
  }
  setLoading(true);

  try {
    await apiFetch("/forgot-password", {
      method: "POST",
      body: JSON.stringify({ identifier: identifier.trim() }),
    });

    router.push({
      pathname: "/reset-password",
      params: { identifier: identifier.trim() },
    });
  } catch (err: unknown) {
    if (err instanceof Error) setError(err.message);
    else setError("Erreur inconnue");
  } finally {
    setLoading(false);
  }
};


  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image source={logo} style={styles.logo} resizeMode="contain" />
      </View>

      <View style={styles.card}>
        <View style={styles.segment}>
          <Text style={styles.segmentTitle}>Récupération du mot de passe</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>Email ou Téléphone</Text>
        <View style={[styles.inputWrap, styles.inputWrapActive]}>
          <MaterialIcons name="phone" size={20} color="#000" />
          <TextInput
            style={styles.input}
            placeholder="Email ou Téléphone"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            placeholderTextColor="#8c8c8c"
          />
        </View>

        <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleForgot} disabled={loading}>
          <Text style={styles.btnText}>{loading ? "Envoi en cours..." : "Envoyer"}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>Retour en arrière</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    backgroundColor: "#E53935",
    height: 220,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: { width: 180, height: 120 },
  card: {
    marginTop: -40,
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
  },
  segment: {
    backgroundColor: "#efefef",
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  segmentTitle: { textAlign: "center", fontWeight: "700", color: "#222" },
  label: { fontSize: 14, fontWeight: "700", marginBottom: 8 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#dcdcdc",
    paddingHorizontal: 12,
    height: 48,
    borderRadius: 24,
    marginBottom: 18,
  },
  inputWrapActive: {
    borderColor: "#E53935",
  },
  input: { flex: 1, fontSize: 14, color: "#222" },
  btn: {
    backgroundColor: "#E53935",
    paddingVertical: 14,
    borderRadius: 26,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 6,
  },
  btnText: { color: "#fff", fontWeight: "700" },
  btnDisabled: { opacity: 0.6 },
  error: { color: "#E53935", textAlign: "center", marginBottom: 10 },
  link: { color: "#E53935", textAlign: "center", marginTop: 10 },
});
