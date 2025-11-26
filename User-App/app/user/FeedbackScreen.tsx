// app/user/FeedbackScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { API_URL } from "../../utils/api";

export default function FeedbackScreen() {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { missionId } = useLocalSearchParams<{ missionId?: string }>();

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert("⚠️ Attention", "Veuillez donner une note avant d’envoyer.");
      return;
    }

    try {
      setLoading(true);

      // ✅ Envoi du feedback à ton backend
      await fetch(`${API_URL}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mission_id: missionId,
          rating,
          comment,
        }),
      });

      setLoading(false);
      Alert.alert("✅ Merci !", "Votre avis a bien été enregistré.", [
        {
          text: "OK",
          onPress: () => router.replace("/user"),
        },
      ]);
    } catch (err) {
      setLoading(false);
      console.error("❌ Erreur envoi feedback:", err);
      Alert.alert("❌ Erreur", "Impossible d’envoyer votre avis. Réessayez plus tard.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1, width: "100%", alignItems: "center" }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Text style={styles.title}>Merci pour votre confiance 🙏</Text>
        <Text style={styles.subtitle}>Évaluez votre expérience TowTruck Mali</Text>

        {/* ⭐ système de notation */}
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((i) => (
            <TouchableOpacity key={i} onPress={() => setRating(i)}>
              <MaterialIcons
                name={i <= rating ? "star" : "star-border"}
                size={44}
                color="#E53935"
                style={styles.star}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Champ commentaire */}
        <TextInput
          style={styles.input}
          placeholder="Ajoutez un commentaire (optionnel)"
          value={comment}
          onChangeText={setComment}
          multiline
        />

        <TouchableOpacity
          style={[styles.btn, loading && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.btnText}>
            {loading ? "Envoi en cours..." : "Envoyer mon avis"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace("/user")}>
          <Text style={styles.link}>Ignorer et retourner à l’accueil</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#E53935",
    marginTop: 20,
  },
  subtitle: {
    fontSize: 15,
    color: "#666",
    marginBottom: 25,
    textAlign: "center",
  },
  stars: { flexDirection: "row", marginBottom: 25 },
  star: { marginHorizontal: 5 },
  input: {
    width: "100%",
    minHeight: 100,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    marginBottom: 25,
    fontSize: 14,
    textAlignVertical: "top",
  },
  btn: {
    backgroundColor: "#E53935",
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: "center",
    width: "100%",
    marginBottom: 20,
  },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  link: {
    color: "#333",
    fontSize: 14,
    textDecorationLine: "underline",
    textAlign: "center",
  },
});
