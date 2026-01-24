import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { API_URL } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { formatCurrency } from "../../utils/format";
import Loader from "../../components/Loader";

const DEFAULT_COMMISSION = 12; // % aligné avec dashboard admin

type Mission = {
  id: number;
  ville: string;
  type: string;
  adresse: string;
  estimated_price?: number;
  commission_percent?: number | null;
  finished_at?: string;
  status: string;
  destination?: string | null;
  dest_lat?: number | null;
  dest_lng?: number | null;
};

export default function OperatorHistory() {
  const { token } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("Tous");

  // Charger missions  terminees
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_URL}/operator/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        const normalized = (data.data || []).map((m: any) => ({
          id: m.id,
          ville: m.ville,
          type: m.service,
          adresse: m.address,
          estimated_price: m.estimated_price,
          commission_percent:
            m.commission_percent != null ? Number(m.commission_percent) : null,
          finished_at: m.finished_at,
          status: m.status,
          destination: m.destination,
          dest_lat: m.dest_lat != null ? Number(m.dest_lat) : null,
          dest_lng: m.dest_lng != null ? Number(m.dest_lng) : null,
        }));

        setMissions(normalized);
      } catch (err) {
        console.error("❌ Erreur historique:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [token]);

  const types = ["Tous", ...new Set(missions.map((m) => m.type))];

  const filteredMissions = missions.filter(
    (m) => typeFilter === "Tous" || m.type === typeFilter
  );

  const formatDestination = (item: Mission) => {
    if (!item.type?.toLowerCase().includes("remorqu")) return null;
    if (item.destination && item.destination.trim().length > 0) {
      return item.destination;
    }
    if (
      typeof item.dest_lat === "number" &&
      !Number.isNaN(item.dest_lat) &&
      typeof item.dest_lng === "number" &&
      !Number.isNaN(item.dest_lng)
    ) {
      return `${item.dest_lat.toFixed(4)}, ${item.dest_lng.toFixed(4)}`;
    }
    return "Non définie";
  };

  const renderTicket = ({ item }: { item: Mission }) => {
    const destinationLabel = formatDestination(item);
    const commission = Number.isFinite(item.commission_percent ?? NaN)
      ? Number(item.commission_percent)
      : DEFAULT_COMMISSION;
    const netPrice =
      item.estimated_price != null && Number.isFinite(item.estimated_price)
        ? Math.max(0, Number(item.estimated_price) * (1 - commission / 100))
        : null;

    return (
      <View style={styles.ticketWrapper}>
        <View style={styles.ticket}>
          <View style={styles.ticketHeader}>
            <View style={styles.ticketTitle}>
              <Text style={styles.missionTitle}>Mission #{item.id}</Text>
            </View>
            <Text
              style={[
                styles.status,
                item.status === "terminee" ? styles.statusDone : styles.statusOther,
              ]}
            >
              {item.status}
            </Text>
          </View>

          <View style={styles.ticketBody}>
            <Text style={styles.info}>
              <MaterialIcons name="place" size={14} color="#888" /> {item.adresse}
            </Text>
            <Text style={styles.info}>
              <MaterialIcons name="location-city" size={14} color="#888" /> {item.ville}
            </Text>
            {destinationLabel && (
              <Text style={styles.info}>
                <MaterialIcons name="flag" size={14} color="#888" /> Destination :{" "}
                {destinationLabel}
              </Text>
            )}
            {netPrice != null && (
              <Text style={styles.infoPrice}>{formatCurrency(netPrice)}</Text>
            )}
          </View>

          <View style={styles.ticketFooter}>
            <MaterialIcons name="event" size={16} color="#aaa" />
            <Text style={styles.footerText}>
              {item.finished_at
                ? new Date(item.finished_at).toLocaleString()
                : "Date inconnue"}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <Loader />
        <Text>Chargement historique...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Filtres */}
      <View style={styles.filterRow}>
        {types.map((t, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.filterBtn,
              typeFilter === t && styles.filterActive,
            ]}
            onPress={() => setTypeFilter(t)}
          >
            <Text
              style={
                typeFilter === t ? styles.filterTextActive : styles.filterText
              }
            >
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Liste missions */}
      {filteredMissions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ color: "#888" }}>⚠️ Aucun historique disponible</Text>
        </View>
      ) : (
        <FlatList
          data={filteredMissions}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderTicket}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 10 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  filterRow: { flexDirection: "row", marginBottom: 10 },
  filterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#f2f2f2",
    borderRadius: 15,
    marginRight: 8,
  },
  filterActive: { backgroundColor: "#E53935" },
  filterText: { color: "#333" },
  filterTextActive: { color: "#fff", fontWeight: "bold" },
  ticketWrapper: {
    paddingVertical: 6,
  },
  ticket: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  ticketHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  ticketTitle: {
    flexDirection: "row",
    alignItems: "center",
  },
  missionTitle: { fontWeight: "bold", fontSize: 16 },
  status: { fontSize: 13, fontWeight: "bold", textTransform: "uppercase" },
  statusDone: { color: "#1B5E20" },
  statusOther: { color: "#E53935" },
  ticketBody: {
    borderTopWidth: 1,
    borderTopColor: "#f4f4f4",
    paddingTop: 10,
    marginTop: 5,
  },
  info: {
    fontSize: 13,
    color: "#444",
    marginBottom: 4,
  },
  infoPrice: {
    fontSize: 14,
    fontWeight: "bold",
    marginTop: 4,
    color: "#E53935",
  },
  ticketFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 10,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f4f4f4",
  },
  footerText: { fontSize: 12, color: "#777" },
  empty: { flex: 1, justifyContent: "center", alignItems: "center" },
});
