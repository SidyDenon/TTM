import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { API_URL } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import Loader from "../../components/Loader";

export default function OperatorChangePassword() {
  const router = useRouter();
  const { token, refreshUser } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleChangePassword = async () => {
    setErrorMsg(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Erreur", "Tous les champs sont obligatoires.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Erreur", "Le nouveau mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Erreur", "Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current: currentPassword,
          new: newPassword,
          confirm: confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const message = data.error || "Erreur lors du changement de mot de passe.";
        throw new Error(message);
      }

      await refreshUser();
      Alert.alert("✅ Succès", "Mot de passe mis à jour.", [
        { text: "OK", onPress: () => router.replace("/operator") },
      ]);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error("❌ Erreur:", err.message);
      const message = err.message || "Une erreur est survenue.";
      setErrorMsg(message);
      Alert.alert("Erreur", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={26} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Changer le mot de passe</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* Formulaire */}
      <View style={styles.form}>
        <Text style={styles.label}>Mot de passe actuel</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          placeholder="••••••••"
          value={currentPassword}
          onChangeText={setCurrentPassword}
        />

        <Text style={styles.label}>Nouveau mot de passe</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          placeholder="••••••••"
          value={newPassword}
          onChangeText={setNewPassword}
        />

        <Text style={styles.label}>Confirmer le nouveau mot de passe</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          placeholder="••••••••"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        <TouchableOpacity
          style={[styles.btn, loading && { opacity: 0.6 }]}
          onPress={handleChangePassword}
          disabled={loading}
        >
          {loading ? (
            <Loader />
          ) : (
            <Text style={styles.btnText}>Mettre à jour</Text>
          )}
        </TouchableOpacity>

        {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: "#fff",
  },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#E53935" },

  form: { padding: 20 },
  label: { color: "#555", fontWeight: "600", marginTop: 15, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#fafafa",
  },
  btn: {
    backgroundColor: "#E53935",
    marginTop: 30,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  errorText: { color: "#E53935", marginTop: 12, fontWeight: "600" },
});
