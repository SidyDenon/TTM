import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { SUPPORT_PHONE, SUPPORT_WHATSAPP_LINK } from "../config/support";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function SupportModal({ visible, onClose }: Props) {
  const handleCall = () => {
    Linking.openURL(`tel:${SUPPORT_PHONE}`);
    onClose();
  };

  const handleWhatsApp = () => {
    Linking.openURL(SUPPORT_WHATSAPP_LINK);
    onClose();
  };

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Service client</Text>
          <Text style={styles.subtitle}>Choisissez un canal de contact</Text>

          <TouchableOpacity style={styles.actionBtn} onPress={handleCall}>
            <MaterialIcons name="call" size={20} color="#fff" />
            <Text style={styles.actionText}>Appeler {SUPPORT_PHONE}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, styles.whatsapp]} onPress={handleWhatsApp}>
            <MaterialIcons name="chat" size={20} color="#fff" />
            <Text style={styles.actionText}>WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 20,
  },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 6 },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 20 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E53935",
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  whatsapp: {
    backgroundColor: "#25D366",
  },
  actionText: { color: "#fff", fontWeight: "600" },
  closeBtn: {
    marginTop: 4,
    alignItems: "center",
    paddingVertical: 10,
  },
  closeText: { color: "#555", fontWeight: "600" },
});

