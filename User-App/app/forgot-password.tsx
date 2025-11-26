// app/forgot-password.tsx
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal } from "react-native";
import { apiFetch } from "../utils/api";
import OTPInput from "./OTPInput"; // ⚡ Mets bien dans /components
import { useRouter } from "expo-router";

export default function ForgotPasswordScreen() {
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [showOTP, setShowOTP] = useState(false);
  const [otp, setOtp] = useState(""); // 6 chiffres
  const router = useRouter();

  const handleForgot = async () => {
  setError("");

  try {
    const res = await apiFetch("/forgot-password", {
      method: "POST",
      body: JSON.stringify({ identifier }),
    });

    // res.channel = "email" ou "sms"
    console.log("Code envoyé via :", res.channel);

    setShowOTP(true); // 🔥 ouvre le popup OTP
  } catch (err: unknown) {
    if (err instanceof Error) setError(err.message);
    else setError("Erreur inconnue");
  }
};


  const handleVerifyOTP = async () => {
    try {
      await apiFetch("/verify-code", {
        method: "POST",
        body: JSON.stringify({ identifier, code: otp }),
      });

      setShowOTP(false);

      // ✅ Redirection avec params
      router.push({
        pathname: "/reset-password",
        params: { identifier, code: otp },
      });
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mot de passe oublié</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="Email ou Téléphone"
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
      />

      <TouchableOpacity style={styles.btn} onPress={handleForgot}>
        <Text style={styles.btnText}>Envoyer</Text>
      </TouchableOpacity>

      {/* Popup OTP */}
     <Modal visible={showOTP} animationType="slide" transparent>
    <View style={styles.modalContainer}>
    <View style={styles.modalContent}>
      <Text style={styles.title}>Entrez le code reçu</Text>

      <OTPInput code={otp} setCode={setOtp} length={6} />

      <TouchableOpacity style={styles.btn} onPress={handleVerifyOTP}>
        <Text style={styles.btnText}>Vérifier</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleForgot}>
        <Text style={styles.link}>Pas reçu ? Renvoyer</Text>
      </TouchableOpacity>

      {/* 🔥 Nouveau bouton Fermer */}
      <TouchableOpacity onPress={() => setShowOTP(false)}>
        <Text style={[styles.link, { marginTop: 10, color: "gray" }]}>Fermer</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 20, textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#ccc", padding: 12, borderRadius: 8, marginBottom: 10, textAlign: "center", fontSize: 18 },
  btn: { backgroundColor: "#E53935", padding: 15, borderRadius: 10, alignItems: "center", marginTop: 10 },
  btnText: { color: "#fff", fontWeight: "bold" },
  error: { color: "red", textAlign: "center", marginBottom: 10 },
  link: { color: "#E53935", textAlign: "center", marginTop: 15 },
  modalContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" },
  modalContent: { backgroundColor: "#fff", padding: 20, borderRadius: 10, width: "80%" },
});
