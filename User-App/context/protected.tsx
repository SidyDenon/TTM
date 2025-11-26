import React, { ReactNode, useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "./AuthContext";

export default function Protected({ children }: { children: ReactNode }) {
  const { token, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !token) {
      router.replace("/login"); // ✅ redirection après rendu
    }
  }, [loading, token]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#E53935" />
      </View>
    );
  }

  if (!token) {
    return null; // rien le temps que ça redirige
  }

  return <>{children}</>;
}
