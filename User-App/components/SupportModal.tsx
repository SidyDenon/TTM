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
import { useEffect, useState, useMemo } from "react";
import { SUPPORT_PHONE, SUPPORT_WHATSAPP, SUPPORT_WHATSAPP_LINK } from "../config/support";
import { API_URL } from "../utils/api";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function SupportModal({ visible, onClose }: Props) {
  const [phone, setPhone] = useState(SUPPORT_PHONE);
  const [whatsapp, setWhatsapp] = useState(SUPPORT_WHATSAPP);
  const [email, setEmail] = useState("support@ttm.com");

  useEffect(() => {
    let cancelled = false;
    const loadConfig = async () => {
      try {
        const res = await fetch(`${API_URL.replace(/\/+$/, "")}/config/public`);
        const data = await res.json();
        if (!res.ok) return;
        if (cancelled) return;
        if (data.support_phone) setPhone(String(data.support_phone));
        if (data.support_whatsapp) setWhatsapp(String(data.support_whatsapp));
        if (data.support_email) setEmail(String(data.support_email));
      } catch {
        /* silent fallback */
      }
    };
    if (visible) loadConfig();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const whatsappLink = useMemo(() => {
    const normalized = String(whatsapp || "")
      .replace(/\s+/g, "")
      .replace(/^\+/, "")
      .replace(/^00/, "");
    return `https://wa.me/${normalized}`;
  }, [whatsapp]);

  const handleCall = () => {
    Linking.openURL(`tel:${phone}`);
    onClose();
  };

  const handleWhatsApp = () => {
    Linking.openURL(whatsappLink);
    onClose();
  };

  const handleEmail = () => {
    Linking.openURL(`mailto:${email}`);
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
            <Text style={styles.actionText}>Appeler {phone}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, styles.whatsapp]} onPress={handleWhatsApp}>
            <MaterialIcons name="chat" size={20} color="#fff" />
            <Text style={styles.actionText}>WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, styles.email]} onPress={handleEmail}>
            <MaterialIcons name="email" size={20} color="#fff" />
            <Text style={styles.actionText}>Email</Text>
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
  email: {
    backgroundColor: "#6b7280",
  },
  actionText: { color: "#fff", fontWeight: "600" },
  closeBtn: {
    marginTop: 4,
    alignItems: "center",
    paddingVertical: 10,
  },
  closeText: { color: "#555", fontWeight: "600" },
});
