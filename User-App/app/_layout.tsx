import React, { useEffect, useRef, useState } from "react";
import { Stack, usePathname, useRouter } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { RequestProvider } from "../context/RequestContext";
import { SocketProvider } from "../context/SocketContext";
import SplashScreen from "../components/SplashScreen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../utils/api";
import { requestNotificationPermission, setupNotificationChannel } from "../lib/notifications";
import { getExpoPushTokenSafe } from "../lib/expoNotifications";

/* ---------------- Root Navigator ---------------- */
function RootNavigator() {
  const router = useRouter();
  const { loading, user, token } = useAuth();
  const pathname = usePathname();
  const [splashDone, setSplashDone] = useState(false);
  const pushTokenRef = useRef<string | null>(null);
  const registeredForUser = useRef<string | number | null>(null);

  // 🕐 Splash de 2,5 secondes
  useEffect(() => {
    const timer = setTimeout(() => setSplashDone(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  // 🔔 Prépare notifications (permissions + token) uniquement après authentification
  useEffect(() => {
    if (!user?.id || !token) return;

    let cancelled = false;
    (async () => {
      try {
        const { granted } = await requestNotificationPermission();
        if (!granted) {
          pushTokenRef.current = null;
          return;
        }
        await setupNotificationChannel();
        const result = await getExpoPushTokenSafe();
        if (cancelled) return;
        if (result.token) {
          pushTokenRef.current = result.token;
          console.log("📱 Expo push token prêt:", result.token);
        } else {
          pushTokenRef.current = null;
          console.log("⚠️ Token push indisponible:", result.reason);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("❌ Erreur configuration notifications:", err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, token]);

  // 🔗 Envoi du token au backend lorsque l'utilisateur est authentifié
  useEffect(() => {
    const expoPushToken = pushTokenRef.current;
    const userId = user?.id ?? null;
    if (!userId || !token || !expoPushToken) return;
    if (registeredForUser.current === userId) return;

    const controller = new AbortController();
    (async () => {
      try {
        await fetch(`${API_URL}/user/push-token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          // 🔴 AVANT: { expoPushToken }
          // ✅ MAINTENANT: { token } pour matcher le backend
          body: JSON.stringify({ token: expoPushToken }),
          signal: controller.signal,
        });
        registeredForUser.current = userId;
        console.log("✅ Token push enregistré sur le backend");
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          console.error("❌ Erreur enregistrement token push:", err);
        }
      }
    })();

    return () => controller.abort();
  }, [user, token]);

  // 🚀 Vérifie si c’est la première ouverture → Onboarding
  useEffect(() => {
    if (loading || !splashDone) return;

    const checkFirstLaunch = async () => {
      try {
        const seen = await AsyncStorage.getItem("hasSeenOnboarding");
        if (!seen && !user) {
          console.log("👋 Première ouverture : redirection vers onboarding");
          router.replace("/OnboardingScreen");
        }
      } catch (e) {
        console.warn("⚠️ Erreur vérif onboarding:", e);
      }
    };

    checkFirstLaunch();
  }, [loading, splashDone, user]);

  // 🔐 Oblige le changement de mot de passe si nécessaire
  useEffect(() => {
    if (!user || !token) return;
    const needsPasswordChange = !!user.must_change_password;
    const role = String(user.role || "").toLowerCase();
    const target =
      role === "operator"
        ? "/operator/change-password"
        : "/user/change-password";

    if (needsPasswordChange) {
      if (pathname !== target) {
        router.replace(target);
      }
    }
  }, [user?.must_change_password, user?.role, token, pathname, router]);

  // 🕐 Affiche splash tant que non prêt
  if (!splashDone || loading) {
    return <SplashScreen />;
  }

  // ✅ Navigation principale
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#E53935" },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="login" options={{ animation: "none" }} />
      <Stack.Screen name="registre" options={{ animation: "none" }} />
      <Stack.Screen name="user" />
      <Stack.Screen name="operator" />
      <Stack.Screen name="OnboardingScreen" />
    </Stack>
  );
}

/* ---------------- Root Layout ---------------- */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* ✅ AuthProvider d’abord pour fournir useAuth() */}
      <AuthProvider>
        {/* ✅ Puis SocketProvider (maintenant il peut lire user/token) */}
        <SocketProvider>
          <RequestProvider>
            <RootNavigator />
          </RequestProvider>
        </SocketProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
