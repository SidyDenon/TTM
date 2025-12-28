import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import MapView, { Marker, MapPressEvent } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";

type Coords = { latitude: number; longitude: number };

type Props = {
  visible: boolean;
  destination: string;
  setDestination: (value: string) => void;
  destinationCoords: Coords | null;
  setDestinationCoords: (coords: Coords | null) => void;
  userLocation: Coords | null;
  colors: {
    primary: string;
    primaryDark: string;
    bg: string;
    card: string;
    text: string;
    textMuted: string;
    border: string;
  };
};

// ⚠️ Mets ici ta vraie clé API (ou via env si tu préfères)
const GOOGLE_PLACES_API_KEY = "AIzaSyABd2koHf-EyzT8Nj9kTJp1fUWYizbjFNI";

type PlacePrediction = {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
};

export const RemorquageSection: React.FC<Props> = ({
  visible,
  destination,
  setDestination,
  destinationCoords,
  setDestinationCoords,
  userLocation,
  colors,
}) => {
  const [showMap, setShowMap] = useState(false);
  const [query, setQuery] = useState(destination);
  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [mapPreparing, setMapPreparing] = useState(false); // ⬅️ pour le géocodage avant d’ouvrir la carte
  const [satellite, setSatellite] = useState(false);

  useEffect(() => {
    setQuery(destination);
  }, [destination]);

  useEffect(() => {
    if (!userLocation) return;
    (async () => {
      try {
        const geo = await Location.reverseGeocodeAsync(userLocation);
        const first = geo[0];
        if (first?.isoCountryCode) {
          setCountryCode(first.isoCountryCode.toLowerCase());
        }
      } catch {
        // pas grave si ça échoue
      }
    })();
  }, [userLocation]);

  // 🔍 Autocomplete Google Places
  useEffect(() => {
    if (!GOOGLE_PLACES_API_KEY) {
      console.warn("❌ GOOGLE_PLACES_API_KEY manquante");
      return;
    }

    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      setSuggestError(null);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        setLoadingSuggestions(true);
        setSuggestError(null);

        const params = new URLSearchParams({
          input: query.trim(),
          key: GOOGLE_PLACES_API_KEY,
          language: "fr",
        });

        if (userLocation) {
          params.append("location", `${userLocation.latitude},${userLocation.longitude}`);
          params.append("radius", "50000");
        }

        if (countryCode) {
          params.append("components", `country:${countryCode}`);
        }

        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`;
        const res = await fetch(url);
        const json = await res.json();

        console.log("🔎 Places Autocomplete:", json.status, json.error_message);

        if (json.status === "OK") {
          setSuggestions(json.predictions || []);
        } else {
          setSuggestions([]);
          setSuggestError(json.error_message || `Erreur Google Places (${json.status})`);
        }
      } catch (err) {
        console.warn("Erreur autocomplete Google Places:", err);
        setSuggestions([]);
        setSuggestError("Erreur réseau lors de la récupération des suggestions.");
      } finally {
        setLoadingSuggestions(false);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [query, userLocation, countryCode]);

  const handleMapPress = (e: MapPressEvent) => {
    setDestinationCoords(e.nativeEvent.coordinate);
  };

  const handleConfirmMapDestination = async () => {
    if (!destinationCoords) {
      setShowMap(false);
      return;
    }

    try {
      const geo = await Location.reverseGeocodeAsync(destinationCoords);
      if (geo.length > 0) {
        const g = geo[0];
        const label = [g.street, g.city].filter(Boolean).join(", ");
        setDestination(
          label ||
            `${destinationCoords.latitude.toFixed(5)}, ${destinationCoords.longitude.toFixed(5)}`
        );
      } else {
        setDestination(
          `${destinationCoords.latitude.toFixed(5)}, ${destinationCoords.longitude.toFixed(5)}`
        );
      }
    } catch {
      setDestination(
        `${destinationCoords.latitude.toFixed(5)}, ${destinationCoords.longitude.toFixed(5)}`
      );
    } finally {
      setShowMap(false);
      setSuggestions([]);
      setSuggestError(null);
    }
  };

  const initialLat =
    destinationCoords?.latitude || userLocation?.latitude || 12.65;
  const initialLng =
    destinationCoords?.longitude || userLocation?.longitude || -8.0;

  if (!visible) return null;

  // 👉 Quand on clique sur une suggestion
  const handleSelectSuggestion = async (item: PlacePrediction) => {
    try {
      setSuggestions([]);
      setLoadingSuggestions(true);
      setSuggestError(null);

      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${item.place_id}&key=${GOOGLE_PLACES_API_KEY}&language=fr`;
      const res = await fetch(url);
      const json = await res.json();

      console.log("📍 Places Details:", json.status, json.error_message);

      if (json.status === "OK") {
        const loc = json.result.geometry.location;
        setDestinationCoords({
          latitude: loc.lat,
          longitude: loc.lng,
        });

        const main = item.structured_formatting?.main_text || "";
        const secondary = item.structured_formatting?.secondary_text || "";
        const label = secondary ? `${main} - ${secondary}` : item.description;

        setDestination(label);
        setQuery(label);
      } else {
        setDestination(item.description);
        setQuery(item.description);
        setSuggestError(json.error_message || `Erreur Place Details (${json.status})`);
      }
    } catch (err) {
      console.warn("Erreur Place Details:", err);
      setDestination(item.description);
      setQuery(item.description);
      setSuggestError("Erreur réseau lors de la récupération des détails du lieu.");
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // 🗺️ Ouvrir la carte en se basant d’abord sur le texte saisi
  const openMapFromDestination = async () => {
    try {
      setMapPreparing(true);

      // Si on n’a pas encore de coords mais qu’il y a un texte → géocodage
      if (!destinationCoords && query.trim().length >= 3 && GOOGLE_PLACES_API_KEY) {
        const params = new URLSearchParams({
          address: query.trim(),
          key: GOOGLE_PLACES_API_KEY,
        });
        if (countryCode) {
          params.append("components", `country:${countryCode}`);
        }

        const url = `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`;
        const res = await fetch(url);
        const json = await res.json();

        console.log("🧭 Geocode:", json.status, json.error_message);

        if (json.status === "OK" && json.results.length > 0) {
          const loc = json.results[0].geometry.location;
          setDestinationCoords({
            latitude: loc.lat,
            longitude: loc.lng,
          });
        }
      }

      // on ouvre la carte ensuite (initialRegion utilisera destinationCoords si dispo)
      setShowMap(true);
    } catch (err) {
      console.warn("Erreur Geocoding:", err);
      setShowMap(true); // on ouvre quand même la carte centrée sur userLocation
    } finally {
      setMapPreparing(false);
    }
  };

  return (
    <>
      <View style={[styles.box, { backgroundColor: colors.card }]}>
        <Text style={[styles.label, { color: colors.text }]}>
          Destination finale (remorquage)
        </Text>

        <TextInput
          style={[
            styles.input,
            { borderColor: colors.border, color: colors.text },
          ]}
          placeholder="Ex : Aéroport, Kita, Garage Diarra..."
          placeholderTextColor="#999"
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setDestination(text);
          }}
        />

        {/* Suggestions */}
        {loadingSuggestions && (
          <View style={styles.suggestionsLoading}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}

   {!loadingSuggestions && suggestions.length > 0 && (
  <View style={[styles.suggestionsBox, { borderColor: colors.border }]}>
    <ScrollView keyboardShouldPersistTaps="handled">
      {suggestions.map((item) => {
        const main = item.structured_formatting?.main_text || item.description;
        const secondary = item.structured_formatting?.secondary_text || "";

        return (
          <TouchableOpacity
            key={item.place_id}
            style={styles.suggestionItem}
            onPress={() => handleSelectSuggestion(item)}
          >
            <Ionicons
              name="location-outline"
              size={18}
              color={colors.textMuted}
              style={{ marginRight: 8 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.suggestionMain, { color: colors.text }]}>
                {main}
              </Text>
              {!!secondary && (
                <Text
                  style={[
                    styles.suggestionSecondary,
                    { color: colors.textMuted },
                  ]}
                >
                  {secondary}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  </View>
)}


        {!!suggestError && (
          <Text style={[styles.suggestErrorText, { color: colors.textMuted }]}>
            {suggestError}
          </Text>
        )}

        <View style={{ flexDirection: "row", marginTop: 6 }}>
          <Ionicons name="information-circle" size={16} color={colors.textMuted} />
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            {"  "}
            Le tarif sera calculé en fonction du kilométrage opérateur → vous → destination.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.mapBtn, { backgroundColor: colors.primary }]}
          onPress={openMapFromDestination}
          disabled={mapPreparing}
        >
          {mapPreparing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="map" size={18} color="#fff" />
              <Text style={styles.mapBtnText}>Choisir sur la carte</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Modal Carte */}
      <Modal visible={showMap} animationType="slide">
        <View style={{ flex: 1 }}>
          <MapView
            style={{ flex: 1 }}
            mapType={satellite ? "satellite" : "standard"}
            onPress={handleMapPress}
            initialRegion={{
              latitude: initialLat,
              longitude: initialLng,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            {(destinationCoords || userLocation) && (
              <Marker
                coordinate={destinationCoords || (userLocation as Coords)}
                draggable
                onDragEnd={(e) => setDestinationCoords(e.nativeEvent.coordinate)}
              />
            )}
          </MapView>

          <View style={styles.mapFooter}>
            <TouchableOpacity
              style={[
                styles.mapFooterBtn,
                styles.mapFooterBtnToggle,
                { borderColor: colors.primary },
              ]}
              onPress={() => setSatellite((s) => !s)}
            >
              <Ionicons
                name={satellite ? "eye-off-outline" : "eye-outline"}
                size={18}
                color={colors.primary}
              />
              <Text
                style={[
                  styles.mapFooterBtnTextToggle,
                  { color: colors.primary, marginLeft: 6 },
                ]}
              >
                {satellite ? "Vue plan" : "Vue satellite"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.mapFooterBtn,
                styles.mapFooterBtnCancel,
                { borderColor: colors.primary },
              ]}
              onPress={() => setShowMap(false)}
            >
              <Text
                style={[styles.mapFooterBtnTextCancel, { color: colors.primary }]}
              >
                Annuler
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.mapFooterBtn,
                styles.mapFooterBtnConfirm,
                { backgroundColor: colors.primary },
                !destinationCoords && { opacity: 0.6 },
              ]}
              onPress={handleConfirmMapDestination}
              disabled={!destinationCoords}
            >
              <Text style={styles.mapFooterBtnTextConfirm}>Confirmer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  box: {
    padding: 15,
    borderRadius: 10,
    marginVertical: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  hint: {
    flex: 1,
    fontSize: 11,
    marginTop: 4,
  },
  mapBtn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 6,
  },
  mapBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },

  suggestionsLoading: {
    marginTop: 6,
  },
  suggestionsBox: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 8,
    maxHeight: 200,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  suggestionMain: {
    fontSize: 14,
    fontWeight: "500",
  },
  suggestionSecondary: {
    fontSize: 11,
    marginTop: 2,
  },
  suggestErrorText: {
    marginTop: 4,
    fontSize: 11,
  },

  mapFooter: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#eee",
    gap: 6,
  },
  mapFooterBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  mapFooterBtnCancel: {
    backgroundColor: "#fff",
    borderWidth: 1,
  },
  mapFooterBtnConfirm: {},
  mapFooterBtnToggle: {
    flexDirection: "row",
    justifyContent: "center",
    borderWidth: 1,
  },
  mapFooterBtnTextToggle: {
    fontWeight: "700",
    fontSize: 14,
  },
  mapFooterBtnTextCancel: {
    fontWeight: "600",
  },
  mapFooterBtnTextConfirm: {
    color: "#fff",
    fontWeight: "600",
  },
});
