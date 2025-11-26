import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  StatusBar,
} from "react-native";
import Onboarding from "react-native-onboarding-swiper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import * as Haptics from "expo-haptics";

export default function OnboardingScreen() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const logoOpacity = useRef(new Animated.Value(0)).current;

  // 🔍 Vérifie si l'utilisateur a déjà vu l’onboarding
  useEffect(() => {
    const check = async () => {
      const seen = await AsyncStorage.getItem("hasSeenOnboarding");
      if (seen) router.replace("/login");
      else {
        setReady(true);
        startIntro();
      }
    };
    check();
  }, []);

  // ⚡ Animation du logo d’intro
  const startIntro = () => {
    Animated.sequence([
      Animated.timing(logoOpacity, { toValue: 1, duration: 1200, useNativeDriver: true }),
      Animated.delay(1200),
      Animated.timing(logoOpacity, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start(() => setShowOnboarding(true));
  };

  const finishOnboarding = async () => {
    await AsyncStorage.setItem("hasSeenOnboarding", "true");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace("/login");
  };

  if (!ready) return null;

  // 🟥 Intro : logo fade-in/fade-out
  if (!showOnboarding) {
    return (
      <LinearGradient colors={["#E53935", "#000"]} style={styles.splash}>
        <StatusBar barStyle="light-content" />
        <Animated.Image
          source={require("../assets/images/logoTTM.png")}
          style={[styles.logo, { opacity: logoOpacity }]}
          resizeMode="contain"
        />
      </LinearGradient>
    );
  }

  // 🧭 Écrans d’onboarding
  return (
    <LinearGradient colors={["#E53935", "#000"]} style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" />
      <Onboarding
        bottomBarHighlight={false}
        onSkip={finishOnboarding}
        onDone={finishOnboarding}
        transitionAnimationDuration={800}
        titleStyles={styles.title}
        subTitleStyles={styles.subtitle}
        containerStyles={{ backgroundColor: "transparent" }}
        DotComponent={({ selected }: { selected: boolean }) => (
          <View
            style={{
              width: 8,
              height: 8,
              marginHorizontal: 4,
              borderRadius: 4,
              backgroundColor: selected ? "#fff" : "#777",
            }}
          />
        )}
        pages={[
          {
            backgroundColor: "transparent",
            image: (
              <LottieView
                source={require("../assets/animations/truck.json")}
                autoPlay
                loop
                style={styles.lottie}
              />
            ),
            title: "Dépannage express",
            subtitle: "Trouvez une dépanneuse proche de vous en quelques clics.",
          },
          {
            backgroundColor: "transparent",
            image: (
              <LottieView
                source={require("../assets/animations/roadassist.json")} // 🆘 nouvelle animation
                autoPlay
                loop
                style={styles.lottie}
              />
            ),
            title: "Assistance fiable 24h/24",
            subtitle: "Nos équipes sont disponibles partout, à tout moment.",
          },
          {
            backgroundColor: "transparent",
            image: (
              <LottieView
                source={require("../assets/animations/mechanic.json")}
                autoPlay
                loop
                style={styles.lottie}
              />
            ),
            title: "Des pros de confiance",
            subtitle: "Tous nos dépanneurs sont vérifiés et notés par nos clients.",
          },
          {
            backgroundColor: "transparent",
            image: (
              <LottieView
                source={require("../assets/animations/map.json")}
                autoPlay
                loop
                style={styles.lottie}
              />
            ),
            title: "Suivi en temps réel",
            subtitle: "Suivez votre dépanneuse directement sur la carte.",
          },
        ]}
        SkipButtonComponent={() => (
          <TouchableOpacity onPress={finishOnboarding} style={styles.skipBtn}>
            <Text style={styles.skipText}>Passer</Text>
          </TouchableOpacity>
        )}
        DoneButtonComponent={() => (
          <AnimatedButton onPress={finishOnboarding} text="Commencer" />
        )}
      />
    </LinearGradient>
  );
}

/* 🎞️ Bouton animé “Commencer” avec dégradé */
const AnimatedButton = ({ onPress, text }: { onPress: () => void; text: string }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={["#fff", "#FFD6D6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.doneBtn}
        >
          <Text style={styles.doneText}>{text}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 180,
    height: 180,
  },
  lottie: {
    width: 250,
    height: 250,
    alignSelf: "center",
  },
  title: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 22,
    textAlign: "center",
  },
  subtitle: {
    color: "#f1f1f1",
    fontSize: 15,
    marginTop: 10,
    textAlign: "center",
  },
  skipBtn: {
    marginRight: 15,
  },
  skipText: {
    color: "#fff",
    fontWeight: "600",
  },
  doneBtn: {
    marginRight: 15,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: "#fff",
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  doneText: {
    color: "#E53935",
    fontWeight: "bold",
    fontSize: 16,
  },
});
