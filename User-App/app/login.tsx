// app/login.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useAuth } from "../context/AuthContext";
import Toast from "react-native-toast-message";
import { MaterialIcons } from "@expo/vector-icons";
import LottieView from "../components/Lottie";

const logo = require("../assets/images/logo1.png");
const loginAnim = require("../assets/animations/ttmload.json");

export default function LoginScreen() {
  type Mode = "login" | "register";
  const pathname = usePathname();
  const initialMode: Mode = pathname?.includes("registre") ? "register" : "login";
  const [mode, setMode] = useState<Mode>(initialMode);

  const [identifier, setIdentifier] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [regName, setRegName] = useState<string>("");
  const [regPhone, setRegPhone] = useState<string>("");
  const [regPassword, setRegPassword] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [focusedField, setFocusedField] = useState<
    "identifier" | "password" | "name" | "phone" | "regPassword" | null
  >(null);

  const router = useRouter();
  const { login, register } = useAuth();
  const [loggingIn, setLoggingIn] = useState(false);

  // ✅ animated pill (0 = login, 1 = register)
  const pillAnim = useRef(new Animated.Value(initialMode === "login" ? 0 : 1)).current;

  // ✅ for responsive translateX
  const [segmentWidth, setSegmentWidth] = useState(0);
  const pillTranslateX = pillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, segmentWidth / 2], // half of container
  });

  useEffect(() => {
    if (Platform.OS === "android") {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

  const switchMode = (next: Mode) => {
    // (optional) animate layout changes in form
    LayoutAnimation.configureNext(
      LayoutAnimation.create(
        350,
        LayoutAnimation.Types.easeInEaseOut,
        LayoutAnimation.Properties.opacity
      )
    );

    setMode(next);
    setError("");
    setFocusedField(null);

    Animated.timing(pillAnim, {
      toValue: next === "login" ? 0 : 1,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const handleLogin = async () => {
    setError("");
    setLoggingIn(true);
    try {
      const loggedUser = await login(identifier, password);
      const target = loggedUser.role === "operator" ? "/operator" : "/user";
      setTimeout(() => {
        router.replace(target);
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur de connexion";
      setError(msg);
      setLoggingIn(false);
      Toast.show({
        type: "error",
        position: "top",
        text1: "Connexion échouée",
        text2: msg,
        visibilityTime: 3000,
        topOffset: 55,
      });
    }
  };

  const handleRegister = async () => {
    setError("");
    try {
      await register(regName, regPhone, regPassword);
      await login(regPhone, regPassword);
      router.replace("/user");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l’inscription";
      setError(msg);
    }
  };

  return (
    <View style={styles.container}>
      {loggingIn && (
        <View style={styles.loadingOverlay}>
          <LottieView source={loginAnim} autoPlay loop style={styles.loadingAnim} />
        </View>
      )}
      <View style={styles.header}>
        <Image source={logo} style={styles.logo} resizeMode="contain" />
      </View>

      <View style={styles.card}>
        {/* ✅ TOGGLE */}
        <View
          style={styles.segment}
          onLayout={(e) => setSegmentWidth(e.nativeEvent.layout.width)}
        >
          <Animated.View
            style={[
              styles.segmentPill,
              {
                transform: [{ translateX: pillTranslateX }],
              },
            ]}
          />

          <TouchableOpacity style={styles.segmentBtn} onPress={() => switchMode("login")}>
            <Text style={mode === "login" ? styles.segmentActiveText : styles.segmentText}>
              Connexion
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.segmentBtn} onPress={() => switchMode("register")}>
            <Text style={mode === "register" ? styles.segmentActiveText : styles.segmentText}>
              Inscription
            </Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {mode === "login" ? (
          <>
            <Text style={styles.label}>Telephone ou Email</Text>
            <View
              style={[
                styles.inputWrap,
                focusedField === "identifier" && styles.inputWrapActive,
              ]}
            >
              <MaterialIcons name="phone" size={20} color="#000" />
              <TextInput
                style={styles.input}
                placeholder="Telephone ou Email"
                value={identifier}
                onChangeText={setIdentifier}
                keyboardType="default"
                autoCapitalize="none"
                placeholderTextColor="#8c8c8c"
                onFocus={() => setFocusedField("identifier")}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <Text style={styles.label}>Mot de passe</Text>
            <View
              style={[
                styles.inputWrap,
                focusedField === "password" && styles.inputWrapActive,
              ]}
            >
              <MaterialIcons name="lock" size={20} color="#000" />
              <TextInput
                style={styles.input}
                placeholder="Mot de passe"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                placeholderTextColor="#8c8c8c"
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <TouchableOpacity style={styles.btn} onPress={handleLogin}>
              <Text style={styles.btnText}>Se connecter</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push("/forgot-password")}>
              <Text style={styles.link}>Mot de passe oublié ?</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => switchMode("register")}>
              <Text style={styles.link}>Pas de compte ? S’inscrire</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.label}>Nom</Text>
            <View style={[styles.inputWrap, focusedField === "name" && styles.inputWrapActive]}>
              <MaterialIcons name="person" size={20} color="#000" />
              <TextInput
                style={styles.input}
                placeholder="Nom complet"
                value={regName}
                onChangeText={setRegName}
                placeholderTextColor="#8c8c8c"
                onFocus={() => setFocusedField("name")}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <Text style={styles.label}>Téléphone</Text>
            <View style={[styles.inputWrap, focusedField === "phone" && styles.inputWrapActive]}>
              <MaterialIcons name="phone" size={20} color="#000" />
              <TextInput
                style={styles.input}
                placeholder="Votre numéro de téléphone"
                value={regPhone}
                onChangeText={setRegPhone}
                keyboardType="phone-pad"
                placeholderTextColor="#8c8c8c"
                onFocus={() => setFocusedField("phone")}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <Text style={styles.label}>Mot de passe</Text>
            <View
              style={[
                styles.inputWrap,
                focusedField === "regPassword" && styles.inputWrapActive,
              ]}
            >
              <MaterialIcons name="lock" size={20} color="#000" />
              <TextInput
                style={styles.input}
                placeholder="Votre mot de passe"
                secureTextEntry
                value={regPassword}
                onChangeText={setRegPassword}
                placeholderTextColor="#8c8c8c"
                onFocus={() => setFocusedField("regPassword")}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <TouchableOpacity style={styles.btn} onPress={handleRegister}>
              <Text style={styles.btnText}>Créer un compte</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => switchMode("login")}>
              <Text style={styles.link}>Déjà inscrit ? Se connecter</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    backgroundColor: "#E53935",
    height: 220,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: { width: 180, height: 120 },
  card: {
    marginTop: -40,
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: "#efefef",
    borderRadius: 22,
    padding: 4,
    marginBottom: 18,
    position: "relative",
    overflow: "hidden",
  },
  segmentPill: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 4,
    width: "50%",
    backgroundColor: "#fff",
    borderRadius: 18,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 18,
    alignItems: "center",
    zIndex: 1,
  },
  segmentText: { color: "#9a9a9a", fontWeight: "600" },
  segmentActiveText: { color: "#111", fontWeight: "700" },
  label: { fontSize: 14, fontWeight: "700", marginBottom: 8, marginTop: 4 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#dcdcdc",
    paddingHorizontal: 12,
    height: 48,
    borderRadius: 24,
    marginBottom: 14,
  },
  inputWrapActive: {
    borderColor: "#E53935",
  },
  input: { flex: 1, fontSize: 14, color: "#222" },
  btn: {
    backgroundColor: "#E53935",
    paddingVertical: 14,
    borderRadius: 26,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 6,
  },
  btnText: { color: "#fff", fontWeight: "700" },
  error: { color: "#E53935", marginBottom: 10, textAlign: "center" },
  link: { color: "#E53935", textAlign: "center", marginTop: 6 },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
    elevation: 50,
  },
  loadingAnim: { width: 300, height: 300 },
});
