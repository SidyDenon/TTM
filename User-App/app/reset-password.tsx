// app/reset-password.tsx
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { apiFetch } from "../utils/api";
import { MaterialIcons } from "@expo/vector-icons";

const logo = require("../assets/images/logo1.png");

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams();
  const identifier = typeof params.identifier === "string" ? params.identifier : "";
  const presetCode = typeof params.code === "string" ? params.code : "";

  const [code, setCode] = useState(presetCode);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleReset = async () => {
    setError("");
    setMessage("");

    if (!code.trim()) {
      setError("⚠️ Code requis");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("⚠️ Les mots de passe ne correspondent pas");
      return;
    }

    try {
      await apiFetch("/reset-password", {
        method: "POST",
        body: JSON.stringify({ identifier, code: code.trim(), newPassword }),
      });

      setMessage("✅ Mot de passe réinitialisé avec succès");
      setTimeout(() => router.replace("/login"), 1500);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("Erreur inconnue");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image source={logo} style={styles.logo} resizeMode="contain" />
      </View>

      <View style={styles.card}>
        <View style={styles.segment}>
          <Text style={styles.segmentTitle}>Réinitialisation du mot de passe</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}

        <Text style={styles.label}>Code</Text>
        <View style={[styles.inputWrap, styles.inputWrapActive]}>
          <MaterialIcons name="lock" size={20} color="#000" />
          <TextInput
            style={styles.input}
            placeholder="Entrer le code reçu"
            value={code}
            onChangeText={setCode}
            placeholderTextColor="#8c8c8c"
          />
        </View>

        <Text style={styles.label}>Nouveau mot de passe</Text>
        <View style={styles.inputWrap}>
          <MaterialIcons name="lock" size={20} color="#000" />
          <TextInput
            style={styles.input}
            placeholder="Votre nouveau mot de passe"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
            placeholderTextColor="#8c8c8c"
          />
        </View>

        <Text style={styles.label}>Rétapez votre mot de passe</Text>
        <View style={styles.inputWrap}>
          <MaterialIcons name="lock" size={20} color="#000" />
          <TextInput
            style={styles.input}
            placeholder="Confirmer mot de passe"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholderTextColor="#8c8c8c"
          />
        </View>

        <TouchableOpacity style={styles.btn} onPress={handleReset}>
          <Text style={styles.btnText}>Réinitialiser</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={async () => {
            if (!identifier) {
              router.replace("/forgot-password");
              return;
            }
            try {
              await apiFetch("/forgot-password", {
                method: "POST",
                body: JSON.stringify({ identifier }),
              });
              setMessage("✅ Code renvoyé");
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Erreur lors du renvoi";
              setError(msg);
            }
          }}
        >
          <Text style={styles.link}>Pas de code ? Renvoyer</Text>
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
    marginBottom: 14,
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
  error: { color: "#E53935", textAlign: "center", marginBottom: 10 },
  success: { color: "#24a148", textAlign: "center", marginBottom: 10 },
  link: { color: "#E53935", textAlign: "center", marginTop: 10 },
});
