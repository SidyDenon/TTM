// app/SplashScreen.tsx
import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";

export default function SplashScreen() {
  const ttmOpacity = useRef(new Animated.Value(0)).current;
  const ttmScale = useRef(new Animated.Value(0.5)).current;
  const subOpacity = useRef(new Animated.Value(0)).current;
  const subTranslateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // Animation séquencée
    Animated.sequence([
      // ⚡ Apparition brutale de TTM
      Animated.parallel([
        Animated.timing(ttmOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(ttmScale, {
          toValue: 1,
          friction: 5,
          tension: 100,
          useNativeDriver: true,
        }),
      ]),
      // ⏳ petit délai avant le sous-titre
      Animated.delay(200),
      // ⚡ TOW TRUCK MALI qui sort d’en bas
      Animated.parallel([
        Animated.timing(subOpacity, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        }),
        Animated.timing(subTranslateY, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.Text
        style={[
          styles.ttm,
          { opacity: ttmOpacity, transform: [{ scale: ttmScale }] },
        ]}
      >
        TTM
      </Animated.Text>
      <Animated.Text
        style={[
          styles.sub,
          { opacity: subOpacity, transform: [{ translateY: subTranslateY }] },
        ]}
      >
        TOW TRUCK MALI
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E53935", // 🔥 fond rouge thème TTM
    justifyContent: "center",
    alignItems: "center",
  },
  ttm: {
    fontSize: 72,
    fontWeight: "bold",
    color: "#fff", // blanc pur
    letterSpacing: 2,
  },
  sub: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "600",
    color: "#fff", // blanc pur
    letterSpacing: 1,
  },
});
