import React, { useEffect, useState, useRef } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Alert,
  Animated,
  Dimensions,
  ScrollView,
} from "react-native";
import MapView, { Marker, Callout, Region, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import * as Animatable from "react-native-animatable";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import Protected from "../../context/protected";
import { useSocket } from "../../context/SocketContext";
import { SupportModal } from "../../components/SupportModal";
import { API_URL } from "../../utils/api";

const FALLBACK_REGION: Region = {
  latitude: 12.6392,
  longitude: -8.0029,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

function HomeContent() {
  const [region, setRegion] = useState<Region | null>(null);
  const [loading, setLoading] = useState(true);
  const { logout, user, token } = useAuth();
  const { isConnected } = useSocket();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);

  // --- états du menu ---
  const [menuVisible, setMenuVisible] = useState(false);
  const [supportVisible, setSupportVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(Dimensions.get("window").width)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const openMenu = () => {
    setMenuVisible(true);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeMenu = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: Dimensions.get("window").width,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setMenuVisible(false));
  };

  // 🚀 Vérifie si une mission est active avant d'afficher la carte
  useEffect(() => {
    const checkActiveMission = async () => {
      try {
        const res = await fetch(`${API_URL}/requests/active`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();

        const activeMission = Array.isArray(json.data) ? json.data[0] : json.data;

        if (activeMission && activeMission.status !== "terminee") {
          router.replace("/user/SuiviMissionScreen");
          return;
        }
      } catch (err) {
        console.error("❌ Erreur lors de la vérification de mission active:", err);
      } finally {
        setLoading(false);
      }
    };

    checkActiveMission();
  }, [token, router]);

  // 📍 Récupération position du client
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLoading(false);
        Alert.alert("Permission refusée", "Active la localisation pour continuer.");
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert(
          "Localisation désactivée",
          "Active les services de localisation. Nous utilisons une position par défaut."
        );
      }

      try {
        const location = await Location.getCurrentPositionAsync({});
        setRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } catch (err) {
        Alert.alert(
          "Localisation indisponible",
          "Impossible de récupérer ta position actuelle. Nous utilisons la position par défaut (Bamako)."
        );
        setRegion(FALLBACK_REGION);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 🧭 Recentrer la carte
  const recenterMap = async () => {
    if (!mapRef.current) return;
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert(
          "Localisation désactivée",
          "Active les services de localisation. Utilisation d'une position par défaut."
        );
      }
      const location = await Location.getCurrentPositionAsync({});
      const newRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(newRegion);
      mapRef.current.animateToRegion(newRegion, 1000);
    } catch (err) {
      setRegion(FALLBACK_REGION);
      mapRef.current.animateToRegion(FALLBACK_REGION, 1000);
      Alert.alert(
        "Localisation indisponible",
        "Impossible de récupérer ta position. Position par défaut (Bamako) utilisée."
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#E53935" />
        <Text style={{ marginTop: 10 }}>Chargement...</Text>
      </View>
    );
  }

  if (!region) {
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyIcon}>
          <Ionicons name="location-outline" size={36} color="#E53935" />
        </View>
        <Text style={styles.emptyTitle}>Localisation indisponible</Text>
        <Text style={styles.emptySubtitle}>
          Active la localisation ou réessaie pour afficher les dépanneuses proches.
        </Text>
        <View style={styles.emptyActions}>
          <TouchableOpacity style={styles.primaryBtn} onPress={recenterMap}>
            <Ionicons name="refresh" size={18} color="#fff" />
            <Text style={styles.primaryText}>Réessayer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => {
              setRegion(FALLBACK_REGION);
            }}
          >
            <Ionicons name="map" size={18} color="#E53935" />
            <Text style={styles.secondaryText}>Position par défaut</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 🗺️ Carte Google Maps */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        mapType="standard"
        showsUserLocation
        followsUserLocation
        style={StyleSheet.absoluteFillObject}
        region={region}
      >
        {/* 📍 Marqueur utilisateur */}
        <Marker coordinate={region}>
          <Animatable.View
            animation="pulse"
            iterationCount="infinite"
            easing="ease-out"
            style={{ alignItems: "center" }}
          >
            <Ionicons name="location-sharp" size={40} color="#E53935" />
          </Animatable.View>
          <Callout>
            <Text style={{ fontWeight: "bold" }}>Moi</Text>
          </Callout>
        </Marker>
      </MapView>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>
          <Text style={{ color: "#E53935" }}>TT</Text>M
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {/* petit indicateur socket */}
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isConnected ? "#4CAF50" : "#FFC107" },
            ]}
          />
          <TouchableOpacity onPress={openMenu} style={styles.profileBtn}>
            <MaterialIcons name="person-outline" size={28} color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bouton principal */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.helpBtn}
          onPress={() => router.push("/user/request")}
        >
          <Text style={styles.helpText}>🚨DEMANDER UNE DÉPANNEUSE</Text>
        </TouchableOpacity>
      </View>

      {/* Bouton recentrage (match le style du SuiviMission) */}
      <TouchableOpacity style={styles.recenterBtn} onPress={recenterMap}>
        <Ionicons name="locate" size={20} color="#fff" />
      </TouchableOpacity>

      {/* ✅ Menu latéral */}
      {menuVisible && (
        <Animated.View style={[styles.menuOverlay, { opacity: fadeAnim }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeMenu}>
            <Animated.View
              style={[
                styles.menuContainer,
                { transform: [{ translateX: slideAnim }] },
              ]}
              onStartShouldSetResponder={() => true}
            >
              <TouchableOpacity style={styles.menuClose} onPress={closeMenu}>
                <MaterialIcons name="close" size={26} color="#E53935" />
              </TouchableOpacity>

              <View style={styles.menuHeader}>
                <MaterialIcons name="person" size={50} color="#999" />
                <Text style={styles.menuName}>{user?.name || "Client"}</Text>
                <Text style={{ color: "#666", fontSize: 13 }}>{user?.phone}</Text>
              </View>

              <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    closeMenu();
                    router.push("/user/parametre");
                  }}
                >
                  <MaterialIcons name="settings" size={22} color="#E53935" />
                  <Text style={styles.menuText}>Paramètres</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    closeMenu();
                router.push("/user/history/index");
              }}
            >
              <MaterialIcons name="history" size={22} color="#E53935" />
              <Text style={styles.menuText}>Historique</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                closeMenu();
                setSupportVisible(true);
              }}
            >
              <MaterialIcons name="support-agent" size={22} color="#E53935" />
              <Text style={styles.menuText}>Service client</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, { marginTop: 30 }]}
              onPress={() => {
                closeMenu();
                logout();
                  }}
                >
                  <MaterialIcons name="logout" size={22} color="#E53935" />
                  <Text style={[styles.menuText, { color: "#E53935" }]}>
                    Déconnexion
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      )}
      <SupportModal visible={supportVisible} onClose={() => setSupportVisible(false)} />
    </View>
  );
}

export default function HomeScreen() {
  return (
    <Protected>
      <HomeContent />
    </Protected>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#fff",
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#ffe5e5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#222", marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: "#666", textAlign: "center", marginBottom: 16 },
  emptyActions: { flexDirection: "row", gap: 10 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#E53935",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E53935",
  },
  secondaryText: { color: "#E53935", fontWeight: "700", fontSize: 14 },
  header: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 100,
  },
  logo: { fontSize: 22, fontWeight: "bold", color: "#000" },
  profileBtn: { padding: 5 },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
  },
  helpBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E53935",
    paddingVertical: 14,
    borderRadius: 12,
    elevation: 3,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  helpText: { color: "#fff", fontSize: 16, fontWeight: "bold" },

  // bouton recenter harmonisé avec SuiviMission
  recenterBtn: {
    position: "absolute",
    bottom: 115, // juste au-dessus du bouton principal
    right: 20,
    backgroundColor: "#333",
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },

  // ✅ Styles menu latéral
  menuOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
    zIndex: 500,
  },
  menuContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: "75%",
    backgroundColor: "#fff",
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    paddingTop: 20,
  },
  menuClose: { alignSelf: "flex-end", marginBottom: 10 },
  menuHeader: { alignItems: "center", marginBottom: 20 },
  menuName: { fontSize: 18, fontWeight: "bold", marginTop: 8 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  menuText: { fontSize: 15, marginLeft: 12, color: "#333" },
});
