// app/OnboardingScreen.tsx
import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated, StatusBar } from "react-native";
import Onboarding from "react-native-onboarding-swiper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

const BRAND = "#E53935";
const BG = "#FFFFFF";

type OnboardingRef = {
  goToPage: (page: number, animated?: boolean) => void;
};

type UiOverlayProps = {
  currentPage: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
};

export default function OnboardingScreen() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const onboardingRef = useRef<OnboardingRef | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Splash intro (fond rouge BRAND)
  const startIntro = () => {
    Animated.sequence([
      Animated.timing(logoOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.delay(450),
      Animated.timing(logoOpacity, { toValue: 0, duration: 450, useNativeDriver: true }),
    ]).start(() => setShowOnboarding(true));
  };

  const finishOnboarding = async () => {
    await AsyncStorage.setItem("hasSeenOnboarding", "true");
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace("/login");
  };

  if (!ready) return null;

  // Splash rouge
  if (!showOnboarding) {
    return (
      <View style={[styles.splash, { backgroundColor: BRAND }]}>
        <StatusBar barStyle="light-content" />
        <Animated.Image
          source={require("../assets/images/logoTTM.png")}
          style={[styles.logo, { opacity: logoOpacity }]}
          resizeMode="contain"
        />
      </View>
    );
  }

  const pages = [
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
      subtitle: "Demandez une dépanneuse en moins d’une minute.",
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
      subtitle: "Voyez l’arrivée de la dépanneuse sur la carte.",
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
      title: "Pro & sécurisé",
      subtitle: "Dépanneurs vérifiés, assistance disponible 24h/24.",
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: BG }]} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" />

      <Onboarding
        ref={onboardingRef}
        bottomBarHighlight={false}
        showSkip={false} // on gère le X nous-mêmes
        showPagination={false}
        transitionAnimationDuration={320}
        titleStyles={styles.title}
        subTitleStyles={styles.subtitle}
        containerStyles={{ backgroundColor: "transparent" }}
        pageIndexCallback={(index: number) => setCurrentPage(index)}
        pages={pages}
      />
      <UiOverlay
        currentPage={currentPage}
        pageCount={pages.length}
        onPrev={async () => {
          if (currentPage <= 0) return;
          await Haptics.selectionAsync();
          onboardingRef.current?.goToPage(currentPage - 1, true);
        }}
        onNext={async () => {
          await Haptics.selectionAsync();
          if (currentPage >= pages.length - 1) {
            finishOnboarding();
            return;
          }
          onboardingRef.current?.goToPage(currentPage + 1, true);
        }}
        onClose={async () => {
          await Haptics.selectionAsync();
          finishOnboarding();
        }}
      />
    </SafeAreaView>
  );
}

/** ✅ UI overlay: X en haut droite + flèches au milieu + timeline en bas */
function UiOverlay({ currentPage, pageCount, onPrev, onNext, onClose }: UiOverlayProps) {
  const isLast = currentPage === pageCount - 1;

  return (
    <View style={styles.overlayRoot} pointerEvents="box-none">
      {/* X en haut à droite */}
      <View style={styles.topRight} pointerEvents="box-none">
        <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={BRAND} />
        </TouchableOpacity>
      </View>

      {/* Flèches au milieu (extrémités) */}
      <View style={styles.midRow} pointerEvents="box-none">
        <TouchableOpacity
          onPress={onPrev}
          activeOpacity={0.85}
          style={[styles.navBtnGhost, currentPage === 0 && styles.disabledBtn]}
          disabled={currentPage === 0}
          accessibilityLabel="Retour"
        >
          <Ionicons name="chevron-back" size={26} color={BRAND} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onNext}
          activeOpacity={0.9}
          style={styles.navBtnSolid}
          accessibilityLabel={isLast ? "Terminer" : "Suivant"}
        >
          <Ionicons name={isLast ? "checkmark" : "chevron-forward"} size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Timeline en bas (centrée) */}
      <View style={styles.timelineWrap} pointerEvents="none">
        <View style={styles.timelineBar}>
          {Array.from({ length: pageCount }).map((_, i) => {
            const active = i === currentPage;
            return (
              <View
                key={i}
                style={[
                  styles.dot,
                  active ? styles.dotActive : styles.dotInactive,
                ]}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  splash: { flex: 1, justifyContent: "center", alignItems: "center" },
  logo: { width: 170, height: 170 },

  lottie: { width: 240, height: 240, alignSelf: "center" },

  title: {
    color: "#0F172A",
    fontWeight: "900",
    fontSize: 24,
    textAlign: "center",
  },
  subtitle: {
    color: "rgba(15,23,42,0.70)",
    fontSize: 15,
    marginTop: 10,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 16,
  },

  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
  },

  topRight: {
    position: "absolute",
    top: 50,
    right: 15,
  },
  closeBtn: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(229,57,53,0.10)",
  },

  midRow: {
    position: "absolute",
    left: 14,
    right: 14,
    top: "50%",
    marginTop: -26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  navBtnGhost: {
    width: 52,
    height: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(229,57,53,0.10)",
  },
  navBtnSolid: {
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },

  disabledBtn: { opacity: 0.35 },

  // Timeline bottom center
  timelineWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 18,
    alignItems: "center",
  },
  timelineBar: {
    height: 22,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.06)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 999,
  },
  dotActive: {
    width: 22,
    backgroundColor: BRAND,
  },
  dotInactive: {
    width: 8,
    backgroundColor: "rgba(15,23,42,0.18)",
  },
});
