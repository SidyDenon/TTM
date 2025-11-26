// app/reset-password.tsx
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { apiFetch } from "../utils/api";

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams();
  const identifier = typeof params.identifier === "string" ? params.identifier : "";
  const code = typeof params.code === "string" ? params.code : "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleReset = async () => {
    setError("");
    setMessage("");

    if (newPassword !== confirmPassword) {
      setError("⚠️ Les mots de passe ne correspondent pas");
      return;
    }

    try {
      await apiFetch("/reset-password", {
        method: "POST",
        body: JSON.stringify({ identifier, code, newPassword }),
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
      <Text style={styles.title}>Réinitialiser le mot de passe</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="Nouveau mot de passe"
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
      />

      <TextInput
        style={styles.input}
        placeholder="Confirmer le mot de passe"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      <TouchableOpacity style={styles.btn} onPress={handleReset}>
        <Text style={styles.btnText}>Réinitialiser</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace("/login")}>
        <Text style={styles.link}>Retour à la connexion</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 20, textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#ccc", padding: 12, borderRadius: 8, marginBottom: 10 },
  btn: { backgroundColor: "#E53935", padding: 15, borderRadius: 10, alignItems: "center", marginTop: 10 },
  btnText: { color: "#fff", fontWeight: "bold" },
  error: { color: "red", textAlign: "center", marginBottom: 10 },
  success: { color: "green", textAlign: "center", marginBottom: 10 },
  link: { color: "#E53935", textAlign: "center", marginTop: 15 },
});
