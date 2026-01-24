import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../../context/AuthContext";
import { API_URL } from "../../../utils/api";
import { formatCurrency } from "../../../utils/format";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import Loader from "../../../components/Loader";

type Mission = {
  id: number;
  service?: string;
  address?: string;
  status?: string;
  estimated_price?: number;
  created_at?: string;
};

export default function HistoryList() {
  const { token } = useAuth();
  const router = useRouter();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_URL}/requests?page=1&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setMissions(Array.isArray(json?.data) ? json.data : []);
    } catch (e) {
      console.error("❌ Erreur chargement historique:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const renderRow = ({ item }: { item: Mission }) => {
    const fadeAnim = new Animated.Value(1);
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() =>
          router.push({
            pathname: "/user/history/[id]",
            params: { id: String(item.id) },
          })
        }
        onPressIn={() => Animated.timing(fadeAnim, { toValue: 0.6, duration: 100, useNativeDriver: true }).start()}
        onPressOut={() => Animated.timing(fadeAnim, { toValue: 1, duration: 100, useNativeDriver: true }).start()}
      >
        <Animated.View style={[styles.row, { opacity: fadeAnim }]}>
          <Text style={[styles.cell, styles.bold]}>{item.id}</Text>
          <Text style={[styles.cell, { flex: 2 }]} numberOfLines={1}>
            {item.service || "—"}
          </Text>
          <Text style={[styles.cell, { flex: 1.2, color: "#4CAF50" }]}>
            {item.estimated_price ? formatCurrency(item.estimated_price) : "—"}
          </Text>
          <View style={[styles.cell, { flex: 1.2 }]}>
            <Text style={[styles.badge, badgeColor(item.status)]}>
              {item.status || "—"}
            </Text>
          </View>
          <Text style={[styles.cell, { flex: 1.5, color: "#777", fontSize: 12 }]}>
            {item.created_at
              ? new Date(item.created_at).toLocaleDateString("fr-FR")
              : "—"}
          </Text>
          <MaterialIcons name="chevron-right" size={22} color="#bbb" />
        </Animated.View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Loader />
        <Text style={{ marginTop: 10 }}>Chargement de l'historique…</Text>
      </View>
    );
  }

  if (!missions.length) {
    return (
      <View style={styles.center}>
        <MaterialIcons name="history" size={50} color="#ccc" />
        <Text style={{ marginTop: 10, color: "#666" }}>
          Aucune mission trouvée.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header du tableau */}
      <View style={styles.tableHeader}>
        <Text style={[styles.headerText, { flex: 1 }]}>ID</Text>
        <Text style={[styles.headerText, { flex: 2 }]}>Service</Text>
        <Text style={[styles.headerText, { flex: 1.2 }]}>Prix</Text>
        <Text style={[styles.headerText, { flex: 1.2 }]}>Statut</Text>
        <Text style={[styles.headerText, { flex: 1.5 }]}>Date</Text>
      </View>

      {/* Liste */}
      <FlatList
        data={missions.filter((m) => String(m.status || '').toLowerCase() === 'terminee')}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderRow}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#E53935"]}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={{ paddingBottom: 50 }}
      />
    </SafeAreaView>
  );
}

function badgeColor(status?: string) {
  const s = String(status || "").toLowerCase();
  if (s === "terminee")
    return { backgroundColor: "#E8F5E9", color: "#2E7D32" };
  if (s.startsWith("annule"))
    return { backgroundColor: "#FFEBEE", color: "#C62828" };
  return { backgroundColor: "#FFF8E1", color: "#EF6C00" };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  tableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f5f5f5",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerText: {
    fontWeight: "bold",
    fontSize: 13,
    color: "#333",
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
  },
  cell: { flex: 1, fontSize: 13, color: "#111" },
  bold: { fontWeight: "bold" },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    textAlign: "center",
    fontSize: 12,
    overflow: "hidden",
  },
  separator: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginHorizontal: 14,
  },
});
