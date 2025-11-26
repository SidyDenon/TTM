import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";

export default function ParametreScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert("Déconnexion", "Voulez-vous vraiment vous déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Oui", onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <Text style={styles.header}>⚙️ Paramètres</Text>

      {/* Infos utilisateur */}
      <View style={styles.card}>
        <Text style={styles.label}>👤 Nom</Text>
        <Text style={styles.value}>{user?.name || "Non défini"}</Text>

        <Text style={styles.label}>📞 Téléphone</Text>
        <Text style={styles.value}>{user?.phone || "Non défini"}</Text>
      </View>

      {/* Options */}
      <TouchableOpacity style={styles.option} onPress={() => router.push("/operator/profile")}>
        <MaterialIcons name="person" size={22} color="#E53935" />
        <Text style={styles.optionText}>Modifier profil</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.option} onPress={() => router.push("/operator/change-password")}>
        <MaterialIcons name="lock" size={22} color="#E53935" />
        <Text style={styles.optionText}>Changer mot de passe</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.option} onPress={() => router.push("/legal/cgu")}>
        <MaterialIcons name="description" size={22} color="#E53935" />
        <Text style={styles.optionText}>Conditions générales</Text>
      </TouchableOpacity>

      {/* Déconnexion */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>🚪 Déconnexion</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  header: { fontSize: 20, fontWeight: "bold", color: "#E53935", marginBottom: 20 },
  card: {
    backgroundColor: "#fafafa",
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#E53935",
  },
  label: { fontSize: 13, color: "#666", marginTop: 8 },
  value: { fontSize: 15, fontWeight: "bold", color: "#000" },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  optionText: { marginLeft: 10, fontSize: 15, color: "#333" },
  logoutBtn: {
    backgroundColor: "#E53935",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 30,
  },
  logoutText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
