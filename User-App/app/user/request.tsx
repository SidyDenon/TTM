import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useRequest } from "../../context/RequestContext";
import { API_BASE } from "../../utils/api";

import DepanneuseIcon from "../../assets/images/depanneuse.png";
import { RemorquageSection } from "../../components/RemorquageSection";

type Service = {
  id: number;
  name: string;
  price: number;
  icon_url?: string | null;
  icon?: string | null;
};

const COLORS = {
  primary: "#E53935",
  primaryDark: "#800000",
  bg: "#f5f5f5",
  card: "#fff",
  text: "#333",
  textMuted: "#555",
  border: "#ddd",
};

// 💰 Formatage des prix en FCFA, sans .00
const formatPrice = (price: number | string): string => {
  const numeric = typeof price === "string" ? Number(price) : price;
  if (Number.isNaN(numeric)) return `${price} FCFA`;

  return `${numeric.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} FCFA`;
};

// Fallback icône: uniquement pour remorquage
const getServiceIcon = (serviceName: string): string => {
  const name = serviceName.toLowerCase();
  if (name.includes("remorqu")) return "truck";
  return "";
};

export default function RequestScreen() {
  const [address, setAddress] = useState("Chargement...");
  const [selectedService, setSelectedService] = useState<number | null>(null);
  const [failedIcons, setFailedIcons] = useState<number[]>([]);

  const [destination, setDestination] = useState(""); // texte destination
  const [destinationCoords, setDestinationCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loadingServices, setLoadingServices] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [loadingLocation, setLoadingLocation] = useState(true);

  const router = useRouter();
  const { photos, setPhotos } = useRequest();

  // ─────────────── 📍 Localisation ───────────────
  useEffect(() => {
    (async () => {
      try {
        const enabled = await Location.hasServicesEnabledAsync();
        if (!enabled) {
          setError(
            "La localisation est désactivée. Activez les services de localisation."
          );
          setAddress("Localisation désactivée");
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setError("Permission refusée : activez la localisation pour continuer.");
          setAddress("Permission de localisation refusée");
          return;
        }

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        setUserLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });

        const geo = await Location.reverseGeocodeAsync(loc.coords);
        if (geo.length > 0) {
          const g = geo[0];
          const label = [g.street, g.city].filter(Boolean).join(", ");
          setAddress(label || "Position déterminée");
        } else {
          setAddress("Position déterminée");
        }
      } catch (e) {
        console.warn("Location error:", e);
        setError(
          "Localisation indisponible. Assurez-vous que les services de localisation sont activés."
        );
        setAddress("Localisation indisponible");
      } finally {
        setLoadingLocation(false);
      }
    })();
  }, []);

  // ─────────────── 🧾 Charger les services ───────────────
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/services/public`);
        const json = await res.json();

        if (res.ok) {
          setServices(json.data || []);
        } else {
          setError(json.error || "Impossible de charger les services.");
        }
      } catch (err) {
        console.error("Erreur chargement services:", err);
        setError("Erreur réseau lors du chargement des services.");
      } finally {
        setLoadingServices(false);
      }
    };
    fetchServices();
  }, []);

  // Petite utilité pour ajouter une photo
  const addPhoto = useCallback(
    (uri: string) => {
      if (photos.length >= 3) {
        setError("Vous pouvez ajouter au maximum 3 photos.");
        return;
      }
      setPhotos([...photos, { uri }]);
    },
    [photos, setPhotos]
  );

  // ─────────────── 📸 Caméra ───────────────
  const openCamera = useCallback(async () => {
    if (photos.length >= 3) {
      setError("Vous pouvez ajouter au maximum 3 photos.");
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      setError("Permission refusée : autorisez l’accès à la caméra.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, // plus de recadrage carré
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      addPhoto(result.assets[0].uri);
    }
  }, [photos.length, addPhoto]);

  // ─────────────── 🖼️ Galerie ───────────────
  const openGallery = useCallback(async () => {
    if (photos.length >= 3) {
      setError("Vous pouvez ajouter au maximum 3 photos.");
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setError("Permission refusée : autorisez l’accès à vos photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, // plus de recadrage carré
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      addPhoto(result.assets[0].uri);
    }
  }, [photos.length, addPhoto]);

  // ─────────────── ❌ Supprimer photo ───────────────
  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  // ─────────────── 🧭 Suivant ───────────────
  const goToResume = useCallback(() => {
    if (selectedService === null) {
      setError("Veuillez sélectionner un service avant de continuer.");
      return;
    }

    const chosenService = services.find((s) => s.id === selectedService);
    if (!chosenService) {
      setError("Service introuvable. Veuillez réessayer.");
      return;
    }

    const isRemorquage = chosenService.name.toLowerCase().includes("remorqu");

    if (isRemorquage && !destination.trim()) {
      setError("Veuillez indiquer la destination finale pour le remorquage.");
      return;
    }

    router.push({
      pathname: "/user/resume",
      params: {
        service: chosenService.id,
        serviceLabel: chosenService.name,
        servicePrice: chosenService.price,
        address,
        destination: isRemorquage ? destination.trim() : "",
        destLat: destinationCoords?.latitude
          ? String(destinationCoords.latitude)
          : "",
        destLng: destinationCoords?.longitude
          ? String(destinationCoords.longitude)
          : "",
      },
    });
  }, [selectedService, services, address, destination, destinationCoords, router]);

  const isNextDisabled = selectedService === null;

  const currentService = services.find((s) => s.id === selectedService);
  const isCurrentRemorquage = currentService
    ? currentService.name.toLowerCase().includes("remorqu")
    : false;

  // ─────────────── 🖼️ Rendu ───────────────
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <ScrollView
          style={styles.container}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <Text style={styles.title}>DEMANDE</Text>

          {/* Adresse */}
          <View style={styles.card}>
            <Ionicons name="location" size={24} color={COLORS.primary} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.cardTitle}>Adresse</Text>
              {loadingLocation ? (
                <View
                  style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}
                >
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={[styles.cardSubtitle, { marginLeft: 8 }]}>
                    Localisation en cours...
                  </Text>
                </View>
              ) : (
                <Text style={styles.cardSubtitle}>{address}</Text>
              )}
              <Text style={[styles.cardSubtitle, { marginTop: 4, fontSize: 11 }]}>
                Cette adresse sera envoyée à l’opérateur.
              </Text>
            </View>
          </View>

          {/* Services */}
          <Text style={styles.sectionIntro}>Choisissez le type d’aide :</Text>

          {loadingServices ? (
            <ActivityIndicator
              size="large"
              color={COLORS.primary}
              style={{ marginVertical: 20 }}
            />
          ) : (
            <View style={styles.servicesGrid}>
              {services.map((srv) => {
                const isSelected = selectedService === srv.id;
                const isRemorquage = srv.name.toLowerCase().includes("remorqu");
                // API_BASE contient souvent /api : on enlève ce suffixe pour servir les fichiers statiques
                const baseHost = API_BASE.replace(/\/api$/, "");
                const faMatch = srv.icon_url?.match(/fa:([^/]+)/);
                const isFaIcon = Boolean(faMatch);
                const rawFaName =
                  (srv.icon as string | null | undefined) ||
                  (isFaIcon ? faMatch?.[1] ?? "" : "");
                const faName = rawFaName === "500-px" ? "500px" : rawFaName; // correction 500px
                const brandNames = new Set([
                  "500px",
                  "accessible-icon",
                  "facebook",
                  "google",
                  "twitter",
                  "whatsapp",
                  "instagram",
                  "linkedin",
                  "youtube",
                  "apple",
                  "android",
                  "microsoft",
                ]);
                const isBrand = faName ? brandNames.has(faName) || /^[0-9]/.test(faName) : false;
                let iconUri: string | null = null;
                if (srv.icon_url && !isFaIcon) {
                  iconUri = srv.icon_url.startsWith("http")
                    ? srv.icon_url
                    : `${baseHost}${srv.icon_url}`;
                }
                const showImage = iconUri && !failedIcons.includes(srv.id);

                return (
                  <TouchableOpacity
                    key={srv.id}
                    style={[
                      styles.serviceCard,
                      isSelected && styles.serviceCardSelected,
                    ]}
                    onPress={() => setSelectedService(srv.id)}
                    activeOpacity={0.8}
                  >
                    {faName ? (
                      <FontAwesome5
                        name={faName as any}
                        brand={isBrand}
                        solid={!isBrand}
                        size={26}
                        color={isSelected ? "#fff" : COLORS.primaryDark}
                        style={{ marginBottom: 6 }}
                      />
                    ) : showImage && iconUri ? (
                      <Image
                        source={{ uri: iconUri }}
                        style={[
                          styles.serviceIconImage,
                          { tintColor: isSelected ? "#fff" : COLORS.primaryDark },
                        ]}
                        resizeMode="contain"
                        onError={() =>
                          setFailedIcons((prev) =>
                            prev.includes(srv.id) ? prev : [...prev, srv.id]
                          )
                        }
                      />
                    ) : isRemorquage ? (
                      <Image
                        source={DepanneuseIcon}
                        style={[
                          styles.serviceIconImage,
                          { tintColor: isSelected ? "#fff" : COLORS.primaryDark },
                        ]}
                        resizeMode="contain"
                      />
                    ) : null}

                    <Text
                      style={[
                        styles.serviceTitle,
                        isSelected && { color: "#fff" },
                      ]}
                    >
                      {srv.name}
                    </Text>

                    <Text style={{ color: isSelected ? "#fff" : "#666" }}>
                      {formatPrice(srv.price)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Remorquage : destination + carte (composant séparé) */}
          <RemorquageSection
            visible={isCurrentRemorquage}
            destination={destination}
            setDestination={setDestination}
            destinationCoords={destinationCoords}
            setDestinationCoords={setDestinationCoords}
            userLocation={userLocation}
            colors={COLORS}
          />

          {/* Photos */}
          <View style={styles.uploadBox}>
            <Text style={{ fontWeight: "bold", marginBottom: 10 }}>
              Ajouter une photo (max. 3)
            </Text>

            {photos.length > 0 && (
              <View style={styles.photosRow}>
                {photos.map((photo, index) => (
                  <View key={index} style={styles.photoWrapper}>
                    <Image source={{ uri: photo.uri }} style={styles.image} />
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removePhoto(index)}
                    >
                      <Ionicons name="close-circle" size={22} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.btn, photos.length >= 3 && styles.btnDisabled]}
                onPress={openCamera}
                disabled={photos.length >= 3}
              >
                <Ionicons name="camera" size={20} color="#fff" />
                <Text style={styles.btnText}>Caméra</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, photos.length >= 3 && styles.btnDisabled]}
                onPress={openGallery}
                disabled={photos.length >= 3}
              >
                <Ionicons name="images" size={20} color="#fff" />
                <Text style={styles.btnText}>Galerie</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Suivant */}
          <TouchableOpacity
            style={[styles.nextBtn, isNextDisabled && styles.nextBtnDisabled]}
            onPress={goToResume}
            disabled={isNextDisabled}
          >
            <Text style={styles.nextText}>SUIVANT →</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Erreur */}
        <Modal visible={!!error} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Ionicons
                name="warning"
                size={50}
                color={COLORS.primary}
                style={{ marginBottom: 10 }}
              />
              <Text style={styles.modalTitle}>Erreur</Text>
              <Text style={styles.modalText}>{error}</Text>

              <TouchableOpacity style={styles.modalBtn} onPress={() => setError(null)}>
                <Text style={styles.modalBtnText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 15, paddingTop: 0 },
  title: { fontSize: 18, fontWeight: "bold", textAlign: "center", marginVertical: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    padding: 15,
    borderRadius: 10,
    marginVertical: 6,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: "bold", marginLeft: 10, color: COLORS.text },
  cardSubtitle: { fontSize: 12, color: COLORS.textMuted, marginLeft: 10 },
  sectionIntro: {
    fontSize: 15,
    fontWeight: "600",
    marginVertical: 10,
    textAlign: "center",
    color: COLORS.text,
  },
  servicesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  serviceCard: {
    width: "48%",
    backgroundColor: COLORS.card,
    paddingVertical: 20,
    borderRadius: 12,
    alignItems: "center",
    marginVertical: 6,
    elevation: 2,
  },
  serviceCardSelected: { backgroundColor: COLORS.primary },
  serviceTitle: { marginTop: 8, fontSize: 15, fontWeight: "bold", color: COLORS.text },
  serviceIconImage: {
    width: 40,
    height: 40,
    marginBottom: 6,
  },
  uploadBox: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    alignItems: "center",
    marginVertical: 10,
  },
  row: { flexDirection: "row", columnGap: 10, marginTop: 10 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: { color: "#fff", marginLeft: 6, fontWeight: "bold" },
  photosRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photoWrapper: { position: "relative" },
  image: { width: 100, height: 100, borderRadius: 10, margin: 5 },
  removeBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#fff",
    borderRadius: 50,
  },
  nextBtn: {
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginVertical: 20,
  },
  nextBtnDisabled: {
    opacity: 0.5,
  },
  nextText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    backgroundColor: COLORS.card,
    padding: 25,
    borderRadius: 15,
    width: "80%",
    alignItems: "center",
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 10, color: COLORS.primary },
  modalText: { fontSize: 14, color: COLORS.textMuted, textAlign: "center", marginBottom: 20 },
  modalBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  modalBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
