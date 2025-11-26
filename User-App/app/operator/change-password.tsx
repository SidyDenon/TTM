import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { API_URL } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "expo-router";

export default function ChangePassword() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { token, refreshUser } = useAuth();
  const router = useRouter();

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Erreur", "Les mots de passe ne correspondent pas");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current: oldPassword,
          new: newPassword,
          confirm: confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Erreur", data.error || "Impossible de changer le mot de passe");
        return;
      }

      await refreshUser();
      Alert.alert("✅ Succès", "Mot de passe modifié avec succès !", [
        { text: "OK", onPress: () => router.replace("/operator") },
      ]);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("❌ Erreur API:", err);
      Alert.alert("Erreur", "Impossible de contacter le serveur");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>🔑 Changer mon mot de passe</Text>

      <View style={styles.inputGroup}>
        <MaterialIcons name="lock-outline" size={20} color="#E53935" />
        <TextInput
          style={styles.input}
          placeholder="Ancien mot de passe"
          placeholderTextColor="#888"
          secureTextEntry
          value={oldPassword}
          onChangeText={setOldPassword}
        />
      </View>

      <View style={styles.inputGroup}>
        <MaterialIcons name="lock" size={20} color="#E53935" />
        <TextInput
          style={styles.input}
          placeholder="Nouveau mot de passe"
          placeholderTextColor="#888"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
        />
      </View>

      <View style={styles.inputGroup}>
        <MaterialIcons name="lock" size={20} color="#E53935" />
        <TextInput
          style={styles.input}
          placeholder="Confirmer le mot de passe"
          placeholderTextColor="#888"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
      </View>

      <TouchableOpacity style={styles.btn} onPress={handleChangePassword}>
        <Text style={styles.btnText}>✅ Modifier</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 20, color: "#E53935" },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 15,
  },
  input: { flex: 1, padding: 12, color: "#000" },
  btn: {
    backgroundColor: "#E53935",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
