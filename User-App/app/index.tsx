import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";
import useNotifications from "../hooks/useNotifications"; // ✅ importe ton hook
import { initApiBase, getApiUrl } from "../config/urls";
export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        await initApiBase(); // 🔥 auto-selection LOCAL -> PROD
        const api = getApiUrl();
        console.log("📡 API URL après init :", api);
        const res = await fetch(`${api}/ping`);
        console.log("📡 Ping status :", res.status);
      } catch (e) {
        console.log("📡 Ping failed :", e);
      }
    })();
  }, []);
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
