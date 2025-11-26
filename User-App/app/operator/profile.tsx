import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function ProfileScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#E53935" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>👤 Mon Profil</Text>
      </View>

      {/* Infos */}
      <View style={styles.infoCard}>
        <MaterialIcons name="person" size={40} color="#E53935" />
        <Text style={styles.name}>Sékou Touré</Text>
        <Text style={styles.phone}>+223 70 00 00 00</Text>
      </View>

      {/* Bouton modifier */}
      <TouchableOpacity style={styles.editBtn}>
        <Text style={styles.editText}>✏️ Modifier mes informations</Text>
      </TouchableOpacity>
    </View>
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
  editBtn: {
    backgroundColor: "#E53935",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  editText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
