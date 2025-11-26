// app/login.tsx
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen() {
  const [identifier, setIdentifier] = useState<string>(""); // 📌 champ unique
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const router = useRouter();
  const { login } = useAuth();

  const handleLogin = async () => {
    setError("");
    try {
      const loggedUser = await login(identifier, password); // 🔑 envoie identifier + password

      // Redirection selon rôle
      if (loggedUser.role === "operator") {
        router.replace("/operator");
      } else {
        router.replace("/user");
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Erreur de connexion");
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connexion</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Champ unique pour téléphone ou email */}
      <TextInput
        style={styles.input}
        placeholder="Téléphone (client) ou Email (opérateur)"
        value={identifier}
        onChangeText={setIdentifier}
        keyboardType="default" // 📌 accepte email ou numéro
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.btn} onPress={handleLogin}>
        <Text style={styles.btnText}>Se connecter</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/forgot-password")}>
        <Text style={styles.link}>Mot de passe oublié ?</Text>
      </TouchableOpacity>


      <TouchableOpacity onPress={() => router.push("/registre")}>
        <Text style={styles.link}>Pas de compte ? S’inscrire</Text>
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
  link: { color: "#E53935", textAlign: "center", marginTop: 10 },
});


