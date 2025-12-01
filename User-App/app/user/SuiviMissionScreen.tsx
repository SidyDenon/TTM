// SuiviMissionScreen.tsx
import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useSuiviMissionLogic } from "./SuiviMissionLogic";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "expo-router";
import { MissionStepper } from "../../components/MissionStepper";

const BASE_STEPS = [
  { key: "demande", label: "Demande" },
  { key: "acceptee", label: "Acceptée" },
  { key: "en_route", label: "En route" },
  { key: "sur_place", label: "Sur place" },
  { key: "terminee", label: "Terminée" },
];

const REMORQUAGE_STEP = { key: "remorquage", label: "Remorquage" };

export default function SuiviMissionScreen() {
  const {
    mission,
    loading,
    operatorLocation,
    routeCoords,
    isFallbackRoute,
    eta,
    distance,
    operatorPhone,
    mission: missionData,
    statusText,
    canCancel,
    heureArrivee,
    notification,
    fadeAnim,
    rotation,
    tracksViewChanges,
    mapRef,
    hasSupportPhone,
    cancelMission,
    callOperator,
    callSupport,
  } = useSuiviMissionLogic();

  const { logout, user } = useAuth();
  const router = useRouter();

  const [menuVisible, setMenuVisible] = useState(false);
  const [operatorBoxVisible, setOperatorBoxVisible] = useState(false);
  const [callMenuOpen, setCallMenuOpen] = useState(false);

  const slideAnim = useRef(
    new Animated.Value(Dimensions.get("window").width)
  ).current;
  const fadeAnimMenu = useRef(new Animated.Value(0)).current;

  const openMenu = () => {
    setMenuVisible(true);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnimMenu, {
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
      Animated.timing(fadeAnimMenu, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setMenuVisible(false));
  };

  // 🔄 Bouton recenter
  const recenter = () => {
    if (!mapRef.current || !mission) return;

    const points = [{ latitude: mission.lat, longitude: mission.lng }];

    if (headingToDestination && hasDestinationCoords) {
      points.push({
        latitude: Number(mission.dest_lat),
        longitude: Number(mission.dest_lng),
      });
    }

    if (operatorLocation) points.push(operatorLocation);

    if (points.length === 1) {
      mapRef.current.animateToRegion(
        {
          latitude: mission.lat,
          longitude: mission.lng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        500
      );
    } else {
      mapRef.current.fitToCoordinates(points, {
        edgePadding: { top: 120, right: 80, bottom: 330, left: 80 },
        animated: true,
      });
    }
  };

  const isTowingMission =
    typeof mission?.service === "string" &&
    mission.service.toLowerCase().includes("remorqu");

  const hasDestinationCoords =
    typeof mission?.dest_lat === "number" &&
    !Number.isNaN(mission?.dest_lat ?? NaN) &&
    typeof mission?.dest_lng === "number" &&
    !Number.isNaN(mission?.dest_lng ?? NaN);

  const headingToDestination =
    isTowingMission &&
    hasDestinationCoords &&
    mission?.status === "remorquage";

  const displayedDistance =
    (isTowingMission && typeof mission?.total_km === "number"
      ? mission.total_km
      : null) ??
    (typeof distance === "number" ? distance : null);

  const steps = useMemo(() => {
    if (!isTowingMission) return BASE_STEPS;
    return [
      BASE_STEPS[0],
      BASE_STEPS[1],
      BASE_STEPS[2],
      BASE_STEPS[3],
      REMORQUAGE_STEP,
      BASE_STEPS[4],
    ];
  }, [isTowingMission]);

  const currentStepIndex = useMemo(() => {
    if (!mission?.status) return 0;
    const idx = steps.findIndex((step) => step.key === mission.status);
    return idx >= 0 ? idx : 0;
  }, [mission?.status, steps]);

  // 🧼 Nettoyer le status : on enlève tout ce qui vient après un tiret / en-dash
  const cleanStatusText = useMemo(() => {
    if (!statusText) return "";
    const parts = statusText.split(/[-–—]/); // -, –, —
    return parts[0].trim();
  }, [statusText]);

  /* ----------- UI ----------- */
  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#E53935" />
        <Text style={{ marginTop: 8 }}>Chargement de la mission…</Text>
      </SafeAreaView>
    );
  }

  if (!mission) {
    return (
      <SafeAreaView style={styles.center}>
        <MaterialIcons name="info-outline" size={48} color="#E53935" />
        <Text style={styles.noMissionText}>Aucune mission en cours.</Text>
      </SafeAreaView>
    );
  }

  const canCallOperator =
    !!operatorPhone &&
    ["acceptee", "en_route", "sur_place", "remorquage"].includes(
      mission.status ?? ""
    );

  const handleCallOperator = () => {
    setCallMenuOpen(false);
    callOperator();
  };

  const handleCallSupport = () => {
    setCallMenuOpen(false);
    callSupport();
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.logo}>
          <Text style={{ color: "#E53935" }}>TT</Text>M
        </Text>
        <TouchableOpacity onPress={openMenu} style={styles.profileBtn}>
          <MaterialIcons name="person-outline" size={26} color="#000" />
        </TouchableOpacity>
      </View>

      {/* MAP */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        showsUserLocation
        initialRegion={{
          latitude: mission!.lat,
          longitude: mission!.lng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {/* Client */}
        <Marker
          coordinate={{ latitude: mission!.lat, longitude: mission!.lng }}
          title="Votre position"
          pinColor="#E53935"
        />

        {/* Destination finale */}
        {hasDestinationCoords && (
          <Marker
            coordinate={{
              latitude: Number(mission!.dest_lat),
              longitude: Number(mission!.dest_lng),
            }}
            pinColor="#1B5E20"
            title="Destination finale"
            description={mission?.destination || "Adresse finale"}
          />
        )}

        {/* Dépanneur */}
        {operatorLocation && (
          <Marker
            coordinate={operatorLocation}
            title="Dépanneur"
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={90}
            tracksViewChanges={tracksViewChanges}
          >
            <Animated.Image
              source={require("../../assets/images/towtruck.png")}
              style={{
                width: 52,
                height: 52,
                transform: [
                  {
                    rotate: rotation.interpolate({
                      inputRange: [-180, 180],
                      outputRange: ["-180deg", "180deg"],
                    }),
                  },
                ],
              }}
              resizeMode="contain"
            />
          </Marker>
        )}

        {/* Route */}
        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeWidth={5}
            strokeColor={isFallbackRoute ? "#9E9E9E" : "#E53935"}
          />
        )}
      </MapView>

      {/* 🔄 BOUTON RECENTRER */}
      <TouchableOpacity style={styles.recenterBtn} onPress={recenter}>
        <MaterialIcons name="my-location" size={20} color="#fff" />
      </TouchableOpacity>

      {/* SPEED DIAL APPEL */}
      <View style={styles.callFabContainer}>
        {callMenuOpen && (
          <View style={styles.callMenu}>
            {canCallOperator && (
              <TouchableOpacity
                style={[styles.callFab, styles.callFabOperator]}
                onPress={handleCallOperator}
                activeOpacity={0.8}
              >
                <MaterialIcons name="phone" size={18} color="#fff" />
                <Text style={styles.callFabLabel}>Dépanneur</Text>
              </TouchableOpacity>
            )}

            {hasSupportPhone && (
              <TouchableOpacity
                style={[styles.callFab, styles.callFabSupport]}
                onPress={handleCallSupport}
                activeOpacity={0.8}
              >
                <MaterialIcons name="support-agent" size={18} color="#fff" />
                <Text style={styles.callFabLabel}>Support</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <TouchableOpacity
          style={styles.mainCallFab}
          onPress={() => setCallMenuOpen((prev) => !prev)}
          activeOpacity={0.85}
        >
          <MaterialIcons
            name={callMenuOpen ? "close" : "phone"}
            size={24}
            color="#fff"
          />
        </TouchableOpacity>
      </View>

      {/* Annulation */}
     

      {/* INFO BOX */}
      <View style={styles.infoContainer}>
        <View style={styles.infoHeaderRow}>
          <Text style={styles.status}>{cleanStatusText}</Text>
        
          {mission.operatorName && (
            <TouchableOpacity
              style={styles.operatorChip}
              onPress={() => setOperatorBoxVisible(true)}
              activeOpacity={0.8}
            >
              <MaterialIcons name="person" size={14} color="#fff" />
              <Text style={styles.operatorChipText}>
                {mission.operatorName}
                
              </Text>
            </TouchableOpacity>
          )}
          
        </View>
        {isTowingMission && hasDestinationCoords && (
          <Text style={styles.destinationInfo}>
            🎯 Destination :{" "}
            {mission.destination
              ? mission.destination
              : `${Number(mission.dest_lat).toFixed(4)}, ${Number(mission.dest_lng).toFixed(4)}`}
          </Text>
        )}
           {canCancel && (
        <TouchableOpacity style={styles.cancelBtn} onPress={cancelMission}>
          <MaterialIcons name="cancel" size={20} color="#fff" />
          <Text style={styles.cancelText}>Annuler la mission</Text>
        </TouchableOpacity>
      )}
        <Text style={styles.address}>
          {mission.address || "Adresse du client"}
        </Text>

        {mission.status === "en_route" && typeof eta === "number" && (
          <View style={styles.etaRow}>
            <MaterialIcons name="access-time" size={16} color="#FFC107" />
            <Text style={styles.time}>
              Arrivé dans {Math.round(eta)} min
            </Text>
          </View>
        )}

        {typeof mission.total_km === "number" && (
            <View style={styles.totalKmBox} >
              <Text style={styles.totalKmLabel}>Kilométrage total</Text>
              <Text style={styles.totalKmValue}>{mission.total_km.toFixed(1)} km</Text>
            </View>
        )}

        <View style={styles.subInfoRow}>
          {heureArrivee && (
            <Text style={styles.timeSub}>Heure estimée : {heureArrivee}</Text>
          )}
          {typeof displayedDistance === "number" && (
            <Text style={styles.timeSub}>
              {isTowingMission ? "Distance totale" : "Distance"} :{" "}
              {displayedDistance.toFixed(1)} km
            </Text>
          )}
        </View>

        {/* Stepper */}
        <MissionStepper steps={steps} currentIndex={currentStepIndex} />
      </View>

      {/* TOAST */}
      {notification && (
        <Animated.View style={[styles.toast, { opacity: fadeAnim }]}>
          <Text style={styles.toastText}>{notification}</Text>
        </Animated.View>
      )}

      {/* MENU */}
      {menuVisible && (
        <Animated.View
          style={[styles.menuOverlay, { opacity: fadeAnimMenu }]}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={closeMenu}
          >
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
                <Text style={{ color: "#666", fontSize: 13 }}>
                  {user?.phone}
                </Text>
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

      {/* 🔴 BOX INFOS OPÉRATEUR */}
      {operatorBoxVisible && (
        <TouchableOpacity
          style={styles.operatorOverlay}
          activeOpacity={1}
          onPress={() => setOperatorBoxVisible(false)}
        >
          <View style={styles.operatorBox}>
            <View style={styles.operatorBoxHeader}>
              <View style={styles.operatorAvatar}>
                <MaterialIcons name="person" size={30} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.operatorName}>
                  {mission.operatorName || "Opérateur assigné"}
                </Text>
                <Text style={styles.operatorSubtitle}>
                  Opérateur assigné à votre mission
                </Text>
              </View>
              <TouchableOpacity onPress={() => setOperatorBoxVisible(false)}>
                <MaterialIcons name="close" size={22} color="#888" />
              </TouchableOpacity>
            </View>

            <View style={styles.operatorInfoRow}>
              <MaterialIcons name="phone" size={18} color="#E53935" />
              <Text style={styles.operatorInfoText}>
                {operatorPhone || "Téléphone non disponible"}
              </Text>
            </View>

            <View style={styles.operatorInfoRow}>
              <MaterialIcons name="assignment" size={18} color="#E53935" />
              <Text style={styles.operatorInfoText}>
                Statut mission : {cleanStatusText || "En cours"}
              </Text>
            </View>

            {mission.address && (
              <View style={styles.operatorInfoRow}>
                <MaterialIcons name="location-on" size={18} color="#E53935" />
                <Text style={styles.operatorInfoText} numberOfLines={2}>
                  Destination : {mission.address}
                </Text>
              </View>
            )}

            {typeof distance === "number" && (
              <View style={styles.operatorInfoRow}>
                <MaterialIcons name="map" size={18} color="#E53935" />
                <Text style={styles.operatorInfoText}>
                  Distance estimée : {distance.toFixed(1)} km
                </Text>
              </View>
            )}

            {!!mission.id && (
              <View style={styles.operatorInfoRow}>
                <MaterialIcons
                  name="confirmation-number"
                  size={18}
                  color="#E53935"
                />
                <Text style={styles.operatorInfoText}>
                  N° de mission : {mission.id}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

/* -------- STYLES -------- */

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  noMissionText: {
    color: "#E53935",
    fontSize: 16,
    marginTop: 12,
    fontWeight: "600",
  },

  header: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    zIndex: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  logo: { fontSize: 22, fontWeight: "bold" },
  profileBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: "#fff",
  },

  // Recentrer
  recenterBtn: {
    position: "absolute",
    right: 20,
    bottom: 260,
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
    zIndex: 90,
  },

  // Speed dial appel
  callFabContainer: {
    position: "absolute",
    right: 20,
    bottom: 140,
    alignItems: "center",
    zIndex: 90,
  },

  callMenu: {
    marginBottom: 10,
    alignItems: "flex-end",
    gap: 8,
  },

  callFab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    elevation: 7,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },

  callFabOperator: {
    backgroundColor: "#4CAF50",
  },

  callFabSupport: {
    backgroundColor: "#E53935",
  },

  callFabLabel: {
    color: "#fff",
    fontSize: 12,
    marginLeft: 6,
    fontWeight: "600",
  },

  mainCallFab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#4CAF50",
    alignItems: "center",
    justifyContent: "center",
    elevation: 9,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },

  cancelBtn: {
    position: "relative",
    width: 200,
    paddingVertical: 10,
    borderRadius: 19,
    backgroundColor: "#FF5252",
    flexDirection: "row",
    justifyContent:"center",
    textAlign: "center",
    gap: 6,
    zIndex: 90,
    left:100,
  },

  cancelText: { color: "#fff", fontWeight: "600", fontSize: 13 },

  infoContainer: {
    position: "absolute",
    bottom: 20,
    left: 15,
    right: 15,
    backgroundColor: "#111111ee",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#333",
    elevation: 10,
  },

  infoHeaderRow: {
    flexDirection: "row",
    justifyContent:"center",
    gap: 10,
    marginBottom: 4,
    alignItems: "center",
  },
  destinationInfo: {
    color: "#ddd",
    fontSize: 13,
    marginBottom: 6,
    textAlign: "center",
  },

  status: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  address: { color: "#ddd", fontSize: 14, textAlign: "center", marginBottom: 8 },

  operatorChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E53935",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  operatorChipText: {
    color: "#fff",
    fontSize: 11,
    marginLeft: 4,
    fontWeight: "600",
  },

  etaRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginBottom: 4,
  },

  time: { color: "#bbb", fontSize: 13 },
  timeSub: { color: "#999", fontSize: 11, flex: 1, textAlign: "center" },

  subInfoRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  totalKmBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
    backgroundColor: "#1b1b1b",
    borderRadius: 10,
    marginBottom: 6,
  },
  totalKmLabel: { color: "#ccc", fontSize: 12, fontWeight: "600" },
  totalKmValue: { color: "#fff", fontSize: 14, fontWeight: "800" },

  toast: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: "#E53935",
    paddingVertical: 12,
    borderRadius: 10,
    paddingHorizontal: 18,
  },

  toastText: { color: "#fff", textAlign: "center", fontWeight: "600" },

  menuOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
    zIndex: 1000,

  },

  menuContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: "75%",
    backgroundColor: "#fff",
    padding: 20,
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

  menuText: { marginLeft: 12, fontSize: 15, color: "#333" },

  // Overlay + box opérateur
  operatorOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 60,
  },
  operatorBox: {
    width: "85%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    elevation: 8,
  },
  operatorBoxHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  operatorAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#E53935",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  operatorName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
  },
  operatorSubtitle: {
    fontSize: 12,
    color: "#777",
    marginTop: 2,
  },
  operatorInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  operatorInfoText: {
    marginLeft: 8,
    fontSize: 13,
    color: "#444",
    flex: 1,
  },
});
