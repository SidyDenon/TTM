import React, { useEffect, useState } from "react";
import { Stack, usePathname, useRouter } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { RequestProvider } from "../context/RequestContext";
import { SocketProvider } from "../context/SocketContext";
import SplashScreen from "../components/SplashScreen";
import AsyncStorage from "@react-native-async-storage/async-storage";

/* ---------------- Root Navigator ---------------- */
function RootNavigator() {
  const router = useRouter();
  const { loading, user, token } = useAuth();
  const pathname = usePathname();
  const [splashDone, setSplashDone] = useState(false);

  //  Splash de 2,5 secondes
  useEffect(() => {
    const timer = setTimeout(() => setSplashDone(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  //  Vérifie si c’est la première ouverture → Onboarding
  useEffect(() => {
    if (loading || !splashDone) return;

    const checkFirstLaunch = async () => {
      try {
        const seen = await AsyncStorage.getItem("hasSeenOnboarding");
        if (!seen && !user) {
          console.log(" Première ouverture : redirection vers onboarding");
          router.replace("/OnboardingScreen");
        }
      } catch (e) {
        console.warn(" Erreur vérif onboarding:", e);
      }
    };

    checkFirstLaunch();
  }, [loading, splashDone, user]);

  //  Oblige le changement de mot de passe si nécessaire
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

  //  Affiche splash tant que non prêt
  if (!splashDone || loading) {
    return <SplashScreen />;
  }

  //  Navigation principale
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
      {/*  AuthProvider d’abord pour fournir useAuth() */}
      <AuthProvider>
        {/*  Puis SocketProvider (maintenant il peut lire user/token) */}
        <SocketProvider>
          <RequestProvider>
            <RootNavigator />
          </RequestProvider>
        </SocketProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
