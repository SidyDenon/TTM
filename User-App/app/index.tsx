import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";
import useNotifications from "../hooks/useNotifications"; // ✅ importe ton hook

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // ✅ Active notifications push + socket globalement
  useNotifications();

  useEffect(() => {
    if (!loading) {
      if (user) {
        if (user.role === "operator") {
          router.replace("/operator");
        } else {
          router.replace("/user");
        }
      } else {
        router.replace("/login");
      }
    }
  }, [loading, user]);

  return null;
}
