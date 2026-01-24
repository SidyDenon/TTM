import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  StyleSheet,
  Image,
  TextInput,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRequest } from "../../context/RequestContext";
import { API_URL } from "../../utils/api";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import Loader from "../../components/Loader";

type Params = {
  service?: string | string[];
  serviceLabel?: string | string[];
  address?: string | string[];
  description?: string | string[];
  servicePrice?: string | string[];
  destination?: string | string[];
  destLat?: string | string[];
  destLng?: string | string[];
};

const COLORS = {
  primary: "#E53935",
  bg: "#fafafa",
  card: "#fff",
  text: "#111",
  textMuted: "#555",
  border: "#eee",
};

// utilitaire pour prendre la première valeur si c'est un tableau
const getFirst = (v?: string | string[]) =>
  Array.isArray(v) ? v[0] : v ?? "";

// 💰 Formatage propre en FCFA
const formatPrice = (price: string | string[] | undefined): string | null => {
  if (!price) return null;
  const raw = getFirst(price);
  const numeric = Number(raw);
  if (Number.isNaN(numeric)) return `${raw} FCFA`;

  return `${numeric.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} FCFA`;
};

export default function Resume() {
  const { token } = useAuth();
  const router = useRouter();
  const { photos } = useRequest();

  const params = useLocalSearchParams<Params>();

  const service = getFirst(params.service);
  const serviceLabel = getFirst(params.serviceLabel);
  const address = getFirst(params.address);
  const description = getFirst(params.description);
  const destination = getFirst(params.destination);
  const destLat = getFirst(params.destLat);
  const destLng = getFirst(params.destLng);

  const formattedPrice = formatPrice(params.servicePrice);

  const [loading, setLoading] = useState(false);
  const [desc, setDesc] = useState(description || "");

  // 🔍 savoir si on est sur un remorquage
  const isRemorquage = serviceLabel
    ? serviceLabel.toLowerCase().includes("remorqu")
    : false;

  // 🔐 Rediriger proprement si pas connecté
  useEffect(() => {
    if (!token) {
      Alert.alert("❌ Erreur", "Vous devez être connecté pour faire une demande", [
        { text: "OK", onPress: () => router.replace("/login") },
      ]);
    }
  }, [token]);

  if (!token) return null;

  const handleConfirm = async () => {
    try {
      if (!service) {
        Alert.alert("❌ Erreur", "Service manquant. Reprenez la demande.");
        return;
      }

      setLoading(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("❌ Permission refusée", "Impossible de récupérer la localisation.");
        setLoading(false);
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert(
          "⚠️ Localisation désactivée",
          "Activez les services de localisation pour continuer."
        );
        setLoading(false);
        return;
      }

      let loc;
      try {
        loc = await Location.getCurrentPositionAsync({});
      } catch (error) {
        Alert.alert(
          "⚠️ Localisation indisponible",
          "Impossible de récupérer votre position actuelle."
        );
        setLoading(false);
        return;
      }

      const { latitude, longitude } = loc.coords;
      const geo = await Location.reverseGeocodeAsync(loc.coords);
      const zone = geo.length > 0 ? geo[0].city || geo[0].region : null;

      const formData = new FormData();
      formData.append("service", String(service));
      formData.append("description", desc.trim());
      formData.append("lat", latitude.toString());
      formData.append("lng", longitude.toString());
      formData.append("address", address || "");
      formData.append("zone", zone || "");

      // 🧭 Infos de remorquage (destination + coords finales) → seulement pour remorquage
      if (isRemorquage) {
        if (destination) {
          formData.append("destination", destination);
        }
        if (destLat && destLng) {
          formData.append("dest_lat", destLat);
          formData.append("dest_lng", destLng);
        }
      }

      photos.forEach((photo, i) => {
        const uri = photo.uri.startsWith("file://") ? photo.uri : `file://${photo.uri}`;
        const name = (photo as any).fileName || `photo_${i}.jpg`;
        const type = (photo as any).mimeType || "image/jpeg";

        formData.append("photos", {
          uri,
          name,
          type,
        } as any);
      });

      const res = await fetch(`${API_URL}/requests`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur serveur");

      const requestId = data?.data?.id;
      if (!requestId) {
        throw new Error("ID de la mission introuvable dans la réponse");
      }

      router.replace({
        pathname: "/user/SearchingOperatorsScreen",
        params: { requestId: String(requestId) },
      });
    } catch (err: any) {
      console.error("❌ Erreur envoi demande:", err);
      Alert.alert("❌ Erreur", err.message || "Impossible d’envoyer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Résumé de votre demande</Text>

        <View style={styles.section}>
          <Text style={styles.label}>Service</Text>
          <Text style={styles.value}>{serviceLabel || "-"}</Text>

          {formattedPrice && (
            <>
              <Text style={styles.label}>Tarif</Text>
              <Text style={styles.value}>{formattedPrice}</Text>
            </>
          )}

          <Text style={styles.label}>Adresse de prise en charge</Text>
          <Text style={styles.value}>{address || "Adresse non définie"}</Text>

          {/* 🧭 Destination remorquage (affichée uniquement pour remorquage) */}
          {isRemorquage && (
            <>
              <Text style={styles.label}>Destination finale</Text>
              <Text style={styles.value}>
                {destination || "Destination non définie"}
              </Text>
            </>
          )}

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.input}
            placeholder="Ajoutez une description (optionnel)"
            value={desc}
            onChangeText={setDesc}
            multiline
          />

          <Text style={styles.label}>Photos</Text>
          <Text style={styles.value}>{photos.length} photo(s)</Text>

          {photos.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 8 }}
            >
              {photos.map((photo, i) => (
                <Image key={i} source={{ uri: photo.uri }} style={styles.photo} />
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={styles.cancelText}>Modifier</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.confirmButton]}
            onPress={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <Loader />
            ) : (
              <Text style={styles.confirmText}>Confirmer</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: COLORS.bg },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: COLORS.primary,
    textAlign: "center",
    marginBottom: 25,
  },
  section: {
    backgroundColor: COLORS.card,
    padding: 18,
    borderRadius: 15,
    marginBottom: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textMuted,
    marginBottom: 3,
  },
  value: {
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 12,
  },
  input: {
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    textAlignVertical: "top",
    minHeight: 70,
    marginBottom: 15,
  },
  photo: {
    width: 90,
    height: 90,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    marginHorizontal: 6,
    elevation: 2,
  },
  cancelButton: {
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  confirmButton: { backgroundColor: COLORS.primary },
  cancelText: { color: COLORS.primary, fontWeight: "600", fontSize: 15 },
  confirmText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
