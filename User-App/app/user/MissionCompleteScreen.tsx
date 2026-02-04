import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import LottieView from "../../components/Lottie";

export default function MissionCompleteScreen() {
  const router = useRouter();
  const { missionId } = useLocalSearchParams<{ missionId?: string }>();

  // Animations stables (useRef pour éviter reset)
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    // Apparition fluide
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();

    // Bloquer le bouton retour
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      router.replace("/user");
      return true;
    });

    return () => backHandler.remove();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* ✅ Animation Lottie (camion ou succès) */}
        <LottieView
          source={require("../../assets/animations/success.json")} // 🔧 à placer dans /assets/animations
          autoPlay
          loop={false}
          style={styles.lottie}
        />

        <Text style={styles.title}>Mission  terminée 🎉</Text>
        <Text style={styles.subtitle}>
          Merci d’avoir utilisé{" "}
          <Text style={{ fontWeight: "bold", color: "#E53935" }}>
            TowTruck Mali
          </Text>
          !
        </Text>

        <View style={styles.card}>
          <Text style={styles.info}>
            ✅ Votre dépanneur a bien terminé la mission.
          </Text>
          <Text style={styles.info}>
            Nous espérons que tout s’est bien passé !
          </Text>
        </View>

        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() =>
            router.replace({
              pathname: "/user/FeedbackScreen",
              params: { missionId },
            })
          }
        >
          <Text style={styles.btnText}>Donner mon avis</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace("/user")}>
          <Text style={styles.link}>Retour à l’accueil</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  content: { alignItems: "center", paddingHorizontal: 30 },
  lottie: { width: 220, height: 220, marginBottom: 20 },
  title: { fontSize: 26, fontWeight: "bold", color: "#E53935", marginBottom: 10 },
  subtitle: { fontSize: 15, color: "#555", textAlign: "center", marginBottom: 25 },
  card: {
    backgroundColor: "#fafafa",
    borderRadius: 12,
    padding: 15,
    width: "100%",
    marginBottom: 25,
    elevation: 3,
  },
  info: { fontSize: 14, color: "#444", textAlign: "center", marginBottom: 5 },
  btnPrimary: {
    backgroundColor: "#E53935",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 10,
    marginBottom: 15,
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  link: {
    color: "#333",
    textDecorationLine: "underline",
    fontSize: 14,
  },
});
