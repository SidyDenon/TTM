import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from "react-native";
import { Ionicons, MaterialIcons, FontAwesome } from "@expo/vector-icons";

type Props = {
  id: number | string;
  type: string;
  address: string;
  distance: string;
  price: string;
  onAccept: () => void;
  onDetails: () => void;
  style?: ViewStyle;
};

const MissionTicketCard: React.FC<Props> = ({
  id,
  type,
  address,
  distance,
  price,
  onAccept,
  onDetails,
  style,
}) => (
  <View style={[styles.card, style]}>
    <View style={styles.dashColumn}>
      {Array.from({ length: 14 }).map((_, i) => (
        <View key={i} style={styles.dash} />
      ))}
    </View>

    <View style={styles.content}>
      <View style={styles.titleRow}>
        <Ionicons name="location-sharp" size={18} color="#D32F2F" />
        <Text style={styles.title}>{`Mission #${id} ${type}`}</Text>
      </View>

      <View style={styles.lineRow}>
        <MaterialIcons name="place" size={16} color="#666" />
        <Text style={styles.secondary}>{address}</Text>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <MaterialIcons name="map" size={16} color="#666" />
          <Text style={styles.metaText}>{distance}</Text>
        </View>
        <View style={styles.metaItem}>
          <FontAwesome name="money" size={15} color="#222" />
          <Text style={styles.price}>{price}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
          <Text style={styles.acceptText}>Accepter</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.detailsBtn} onPress={onDetails}>
          <Text style={styles.detailsText}>Voir détails</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  dashColumn: {
    width: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  dash: {
    width: 2,
    height: 8,
    backgroundColor: "#D9D9D9",
    borderRadius: 4,
    marginVertical: 3,
  },
  content: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  title: { marginLeft: 6, fontSize: 16, fontWeight: "700", color: "#222" },
  lineRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  secondary: { marginLeft: 6, fontSize: 13, color: "#666", flexShrink: 1 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 10,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontSize: 14, color: "#666", fontWeight: "500" },
  price: { fontSize: 14, color: "#222", fontWeight: "700" },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  acceptBtn: {
    backgroundColor: "#2EAD55",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  acceptText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  detailsBtn: {
    backgroundColor: "#F3F3F3",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  detailsText: { color: "#1A1A1A", fontSize: 14, fontWeight: "600" },
});

export default MissionTicketCard;
