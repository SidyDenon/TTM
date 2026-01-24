import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import LottieView from "lottie-react-native";

const logoutAnim = require("../../assets/animations/ttmload.json");

export default function ParametreScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = () => {
    Alert.alert("Déconnexion", "Voulez-vous vraiment vous déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Oui",
        onPress: () => {
          setLoggingOut(true);
          setTimeout(() => {
            logout();
          }, 1600);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      {loggingOut && (
        <View style={styles.logoutOverlay}>
          <LottieView
            source={logoutAnim}
            autoPlay
            loop
            style={styles.logoutAnim}
          />
        </View>
      )}
      <View style={styles.headerRow}>
        <MaterialIcons name="settings" size={22} color="#E53935" />
        <Text style={styles.header}>Paramètres</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.infoRow}>
          <View style={styles.infoLeft}>
            <MaterialIcons name="person" size={20} color="#E53935" />
            <Text style={styles.label}>Nom</Text>
          </View>
          <Text style={styles.value}>{user?.name || "Non défini"}</Text>
        </View>
        <View style={styles.infoRow}>
          <View style={styles.infoLeft}>
            <MaterialIcons name="phone" size={20} color="#E53935" />
            <Text style={styles.label}>Téléphone</Text>
          </View>
          <Text style={styles.value}>{user?.phone || "Non défini"}</Text>
        </View>
      </View>

      <View style={styles.list}>
        <TouchableOpacity style={styles.option} onPress={() => router.push("/operator/profile")}>
          <View style={styles.optionLeft}>
            <MaterialIcons name="badge" size={22} color="#E53935" />
            <Text style={styles.optionText}>Modifier profil</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.option} onPress={() => router.push("/operator/change-password")}>
          <View style={styles.optionLeft}>
            <MaterialIcons name="lock" size={22} color="#E53935" />
            <Text style={styles.optionText}>Changer mot de passe</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.option} onPress={() => router.push("/legal/cgu")}>
          <View style={styles.optionLeft}>
            <MaterialIcons name="article" size={22} color="#E53935" />
            <Text style={styles.optionText}>Conditions générales</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color="#999" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <MaterialIcons name="logout" size={20} color="#fff" />
        <Text style={styles.logoutText}>Déconnexion</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 8 },
  header: { fontSize: 20, fontWeight: "bold", color: "#E53935" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#eee",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  infoLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontSize: 14, color: "#666" },
  value: { fontSize: 15, fontWeight: "700", color: "#1A1A1A" },
  list: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eee",
    overflow: "hidden",
    marginBottom: 24,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f2f2f2",
  },
  optionLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  optionText: { fontSize: 15, color: "#333" },
  logoutBtn: {
    backgroundColor: "#E53935",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  logoutText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  logoutOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
    elevation: 50,
  },
  logoutAnim: { width: 300, height: 300 },
});
