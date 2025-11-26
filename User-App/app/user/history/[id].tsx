import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../../context/AuthContext";
import { API_URL } from "../../../utils/api";
import { MaterialIcons } from "@expo/vector-icons";
import { formatCurrency } from "../../../utils/format";
import { SafeAreaView } from "react-native-safe-area-context";

export default function MissionDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [loading, setLoading] = useState(true);
  const [mission, setMission] = useState<any>(null);

  useEffect(() => {
    const fetchMission = async () => {
      try {
        const res = await fetch(`${API_URL}/requests/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok) {
          console.warn("⚠️ GET /requests/:id non OK:", json);
          setMission(null);
          // Redirige vers la liste s'il n'y a pas d'accès à ce détail
          setTimeout(() => router.replace("/user/history"), 300);
          return;
        }
        const payload = json?.data ?? json;
        if (payload && payload.id) setMission(payload);
        else {
          console.warn("⚠️ Payload inattendu pour /requests/:id:", payload);
          setMission(null);
          setTimeout(() => router.replace("/user/history"), 300);
        }
      } catch (err) {
        console.error("❌ Erreur chargement mission:", err);
        setMission(null);
      } finally {
        setLoading(false);
      }
    };
    fetchMission();
  }, [id, token]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#E53935" />
        <Text style={{ marginTop: 10 }}>Chargement de la mission...</Text>
      </View>
    );
  }

  if (!mission) {
    return (
      <View style={styles.loader}>
        <MaterialIcons name="error-outline" size={40} color="#999" />
        <Text style={{ marginTop: 10 }}>Mission introuvable</Text>
      </View>
    );
  }

  const { id: missionId, service, address, description, status, operator_name, operator_phone, lat, lng, estimated_price, price, created_at } = mission;
  const amount = Number(estimated_price ?? price ?? 0) || 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={26} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Détails de la mission</Text>
        <View style={{ width: 26 }} />
      </View>

      {Number(lat) && Number(lng) ? (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            latitude: Number(lat) || 0,
            longitude: Number(lng) || 0,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
        >
          <Marker coordinate={{ latitude: Number(lat), longitude: Number(lng) }} title="Lieu du dépannage" pinColor="#E53935" />
        </MapView>
      ) : (
        <View style={styles.noMap}>
          <Text style={{ color: "#999" }}>📍 Localisation non disponible</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.title}>Mission #{missionId}</Text>
        <Text style={styles.info}>🔧 Type: <Text style={styles.bold}>{service || "Non précisé"}</Text></Text>
        <Text style={styles.info}>📍 Adresse: <Text style={styles.bold}>{address || "Non précisée"}</Text></Text>
        {description ? <Text style={styles.info}>📝 Description: <Text style={styles.bold}>{description}</Text></Text> : null}
        <Text style={styles.info}>📅 Date: <Text style={styles.bold}>{created_at ? new Date(created_at).toLocaleString() : "—"}</Text></Text>
        <Text style={styles.info}>💰 Prix: <Text style={[styles.bold, { color: '#4CAF50' }]}>{formatCurrency(amount)}</Text></Text>
        <Text style={styles.info}>📦 Statut: <Text style={[styles.bold, { color: (status === 'terminee' ? '#4CAF50' : status?.startsWith('annule') ? '#E53935' : '#FF9800') }]}>{String(status || '').toUpperCase()}</Text></Text>
      </View>

      <View style={styles.operatorCard}>
        <Text style={styles.subtitle}>👨‍🔧 Opérateur assigné</Text>
        <Text style={styles.info}>Nom: <Text style={styles.bold}>{operator_name || 'Non renseigné'}</Text></Text>
        <Text style={styles.info}>Téléphone: <Text style={styles.bold}>{operator_phone || 'Non renseigné'}</Text></Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 15 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#E53935' },
  map: { height: 200, borderRadius: 10, margin: 15 },
  noMap: { height: 200, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5', margin: 15, borderRadius: 10 },
  card: { backgroundColor: '#fafafa', marginHorizontal: 15, marginBottom: 10, borderRadius: 10, padding: 15, borderLeftWidth: 4, borderLeftColor: '#E53935' },
  operatorCard: { backgroundColor: '#fefefe', marginHorizontal: 15, borderRadius: 10, padding: 15, borderLeftWidth: 4, borderLeftColor: '#E53935', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3 },
  title: { fontWeight: 'bold', fontSize: 16, marginBottom: 10 },
  subtitle: { fontWeight: 'bold', fontSize: 15, color: '#E53935', marginBottom: 8 },
  info: { color: '#444', marginVertical: 3 },
  bold: { fontWeight: 'bold', color: '#000' },
});
