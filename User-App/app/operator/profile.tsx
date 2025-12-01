import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#E53935" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mon Profil</Text>
      </View>

      {/* Infos */}
      <View style={styles.infoCard}>
        <MaterialIcons name="person" size={40} color="#E53935" />
        <Text style={styles.name}>{user?.name || "Opérateur"}</Text>
        <Text style={styles.phone}>{user?.phone || "Téléphone indisponible"}</Text>
        <Text style={styles.role}>{user?.role || "Rôle non défini"}</Text>
      </View>

      {/* Bouton modifier */}
      <TouchableOpacity
        style={styles.editBtn}
        onPress={() => router.push("/operator/parametre")}
      >
        <Text style={styles.editText}>Modifier mes informations</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  backBtn: { marginRight: 10 },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#E53935" },
  infoCard: {
    alignItems: "center",
    backgroundColor: "#f8f8f8",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  name: { fontSize: 20, fontWeight: "bold", marginTop: 10 },
  phone: { fontSize: 14, color: "#666", marginTop: 4 },
  role: { fontSize: 13, color: "#999", marginTop: 2 },
  editBtn: {
    backgroundColor: "#E53935",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  editText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
