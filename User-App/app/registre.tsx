// app/register.tsx
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();
  const { register, login } = useAuth(); // 👈 utilise directement le contexte

  const handleRegister = async () => {
    setError("");
    setSuccess("");
    try {
      // 1️⃣ Enregistrer l’utilisateur via AuthContext
      await register(name, phone, password);

      // 2️⃣ Auto-login direct
      await login(phone, password);

      // 3️⃣ Redirection
      router.replace("/user");
    } catch (err: any) {
      setError(err.message || "Erreur lors de l’inscription");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inscription</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="Nom complet"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="Téléphone"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />
      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.btn} onPress={handleRegister}>
        <Text style={styles.btnText}>Créer un compte</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/login")}>
        <Text style={styles.link}>Déjà inscrit ? Se connecter</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "bold", textAlign: "center", marginBottom: 20 },
  input: { borderWidth: 1, borderColor: "#ddd", padding: 12, borderRadius: 8, marginVertical: 8 },
  btn: { backgroundColor: "#E53935", padding: 15, borderRadius: 10, alignItems: "center", marginVertical: 10 },
  btnText: { color: "#fff", fontWeight: "bold" },
  error: { color: "red", marginBottom: 10, textAlign: "center" },
  success: { color: "green", marginBottom: 10, textAlign: "center" },
  link: { color: "#E53935", textAlign: "center", marginTop: 10 },
});
